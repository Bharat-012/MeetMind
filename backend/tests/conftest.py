"""Test fixtures and database configuration."""
import os
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core import database
from app.core.database import Base, get_db
from app.core.config import settings
import app.models  # noqa: F401
from app.main import app

# Ensure unit tests use fast isolated mock providers by default
settings.ASR_PROVIDER = "mock"
settings.DIARIZATION_PROVIDER = "mock"
settings.LLM_PROVIDER = "mock"
settings.EMBEDDING_PROVIDER = "mock"

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_meetmind.db"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

TestAsyncSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

# Patch global database engine and sessionmaker for tests so background tasks share test DB
database.engine = test_engine
database.AsyncSessionLocal = TestAsyncSessionLocal


@pytest.fixture(scope="session", autouse=True)
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
async def setup_test_database():
    """Create all tables before each test and drop them after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    # Remove SQLite file if created
    if os.path.exists("./test_meetmind.db"):
        try:
            os.remove("./test_meetmind.db")
        except OSError:
            pass


@pytest.fixture
async def db_session():
    """Provide a clean async database session for unit tests."""
    async with TestAsyncSessionLocal() as session:
        yield session


@pytest.fixture
async def client(db_session):
    """Provide an HTTPX AsyncClient with overridden database dependency."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
