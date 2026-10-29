"""Database setup, async engine, and session management."""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


class Base(DeclarativeBase):
    pass


# SQLite-specific connection arguments for WAL mode and multi-thread safety
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args=connect_args,
    future=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for providing database sessions per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database tables and run automatic lightweight column migrations."""
    async with engine.begin() as conn:
        # Import models so Base has them registered
        import app.models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)

        # Automatic lightweight migrations for evolved schemas
        from sqlalchemy import text
        migrations = [
            ("decisions", "source_segment_id", "VARCHAR(36)"),
            ("decisions", "model_name", "VARCHAR(100)"),
            ("action_items", "source_segment_id", "VARCHAR(36)"),
            ("action_items", "model_name", "VARCHAR(100)"),
            ("short_transcripts", "model_name", "VARCHAR(100)"),
            ("speakers", "is_confirmed", "BOOLEAN DEFAULT 0"),
            ("meeting_participants", "description", "VARCHAR(1000)"),
            ("speaker_assignments", "assignment_source", "VARCHAR(50) DEFAULT 'MANUAL_CONFIRMED'"),
            ("speaker_assignments", "notes", "VARCHAR(500)"),
        ]
        for table, col, col_type in migrations:
            try:
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
            except Exception:
                # Column already exists or table not yet created
                pass

