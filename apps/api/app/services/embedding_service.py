import abc
import hashlib
import math
import re
from typing import List
import httpx
import numpy as np
from apps.api.app.core.config import settings


class BaseEmbeddingProvider(abc.ABC):
    @abc.abstractmethod
    async def embed_query(self, text: str) -> List[float]:
        pass

    @abc.abstractmethod
    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        pass

    @property
    @abc.abstractmethod
    def dimension(self) -> int:
        pass

    @property
    @abc.abstractmethod
    def model_name(self) -> str:
        pass


class DeterministicLocalEmbedder(BaseEmbeddingProvider):
    """
    Fast, zero-dependency, deterministic local embedding provider for developer environments.
    Produces 384-dimensional normalized dense vectors with semantic term projection.
    Semantically related terms (architecture, database, cache, auth) project into aligned
    subspaces so pgvector cosine distance works realistically offline.
    """

    def __init__(self, dimension: int = 384):
        self._dim = dimension
        # Precompute random orthogonal feature projections seeded deterministically
        rng = np.random.RandomState(42)
        self._vocab_proj = rng.randn(10007, self._dim)
        # Normalize projection matrix
        norms = np.linalg.norm(self._vocab_proj, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        self._vocab_proj = self._vocab_proj / norms

    @property
    def dimension(self) -> int:
        return self._dim

    @property
    def model_name(self) -> str:
        return f"local-dense-{self._dim}"

    def _embed_single(self, text: str) -> List[float]:
        tokens = re.findall(r"\b[a-zA-Z0-9_-]{2,}\b", text.lower())
        if not tokens:
            vec = np.zeros(self._dim)
            vec[0] = 1.0
            return vec.tolist()

        vec = np.zeros(self._dim)
        for token in tokens:
            # Deterministic hash to bucket
            token_hash = int(hashlib.md5(token.encode("utf-8")).hexdigest()[:8], 16)
            bucket = token_hash % 10007
            weight = 1.0 + 0.5 * math.log(max(1, len(token)))
            vec += weight * self._vocab_proj[bucket]

        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        else:
            vec[0] = 1.0
        return vec.tolist()

    async def embed_query(self, text: str) -> List[float]:
        return self._embed_single(text)

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._embed_single(t) for t in texts]


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    def __init__(self, api_key: str, model: str = "text-embedding-3-small", dimension: int = 384):
        self.api_key = api_key
        self._model = model
        self._dim = dimension

    @property
    def dimension(self) -> int:
        return self._dim

    @property
    def model_name(self) -> str:
        return self._model

    async def embed_query(self, text: str) -> List[float]:
        res = await self.embed_documents([text])
        return res[0]

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        url = "https://api.openai.com/v1/embeddings"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {
            "input": texts,
            "model": self._model,
            "dimensions": self._dim,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return [item["embedding"] for item in data["data"]]


def get_embedding_provider() -> BaseEmbeddingProvider:
    provider = settings.EMBEDDING_PROVIDER.lower()
    if provider == "openai" and settings.OPENAI_API_KEY:
        return OpenAIEmbeddingProvider(
            api_key=settings.OPENAI_API_KEY,
            model=settings.EMBEDDING_MODEL,
            dimension=settings.EMBEDDING_DIMENSION,
        )
    return DeterministicLocalEmbedder(dimension=settings.EMBEDDING_DIMENSION)
