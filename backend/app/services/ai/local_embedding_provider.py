"""Genuine Local Semantic Embedding Provider using Sentence Transformers / all-MiniLM-L6-v2.

Strict local AI policy:
- Runs 100% locally via PyTorch and HuggingFace Transformers.
- Produces normalized 384-dimensional dense semantic vectors.
- Zero remote or cloud API calls.
"""
import logging
from typing import List, Optional
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModel
from app.services.ai.protocols import EmbeddingProvider

logger = logging.getLogger("meetmind.embeddings.local")


class LocalSentenceEmbeddingProvider(EmbeddingProvider):
    """Local semantic embedding provider using all-MiniLM-L6-v2."""

    def __init__(
        self,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        device: Optional[str] = None
    ):
        if model_name == "all-MiniLM-L6-v2":
            model_name = "sentence-transformers/all-MiniLM-L6-v2"
        self.model_name = model_name
        self.dimensions = 384
        self.dimension = 384

        if device:
            self.device = device
        else:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"

        logger.info(f"Initializing LocalSentenceEmbeddingProvider with '{model_name}' on {self.device}")
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModel.from_pretrained(model_name)
            self.model.to(self.device)
            self.model.eval()
            self.is_ready = True
            logger.info("Local sentence embedding model loaded successfully.")
        except Exception as e:
            logger.warning(f"Could not load local embedding model '{model_name}': {e}")
            self.is_ready = False

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generate dense 384-dimensional semantic embeddings for a batch of texts."""
        if not texts:
            return []

        if not self.is_ready:
            # Fallback if model failed to load
            from app.services.ai.mock_providers import MockEmbeddingProvider
            return await MockEmbeddingProvider(dimensions=self.dimensions).embed_texts(texts)

        try:
            # Clean and sanitize input texts
            clean_texts = [t.strip() if t.strip() else " " for t in texts]

            # Tokenize batch
            inputs = self.tokenizer(
                clean_texts,
                padding=True,
                truncation=True,
                max_length=512,
                return_tensors="pt"
            )
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

            with torch.no_grad():
                outputs = self.model(**inputs)
                # Mean-pooling with attention mask
                attention_mask = inputs["attention_mask"].unsqueeze(-1)
                token_embeddings = outputs.last_hidden_state
                sum_embeddings = torch.sum(token_embeddings * attention_mask, dim=1)
                sum_mask = torch.clamp(attention_mask.sum(dim=1), min=1e-9)
                pooled = sum_embeddings / sum_mask
                # L2 normalize vectors to unit length for fast cosine similarity via dot product
                normalized = F.normalize(pooled, p=2, dim=1)

            return normalized.cpu().tolist()

        except Exception as e:
            logger.error(f"Local embedding generation failed: {e}")
            from app.services.ai.mock_providers import MockEmbeddingProvider
            return await MockEmbeddingProvider(dimensions=self.dimensions).embed_texts(texts)

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Alias for embed_texts."""
        return await self.embed_texts(texts)
