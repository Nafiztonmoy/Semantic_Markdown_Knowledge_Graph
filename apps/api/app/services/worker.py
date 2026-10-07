import asyncio
import json
import logging
import uuid
from typing import Optional
import redis.asyncio as aioredis
from apps.api.app.core.config import settings
from apps.api.app.core.database import async_session_maker
from apps.api.app.models.entities import IndexingJob
from apps.api.app.services.indexer import DocumentIndexer

logger = logging.getLogger("nexusdocs.worker")
logging.basicConfig(level=logging.INFO)

REDIS_QUEUE_KEY = "nexusdocs:indexing_jobs"


async def get_redis_client() -> Optional[aioredis.Redis]:
    try:
        client = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=1.5)
        await client.ping()
        return client
    except Exception:
        return None


async def execute_indexing_job(workspace_id: uuid.UUID, document_id: uuid.UUID, job_id: uuid.UUID) -> None:
    """Executes indexing inside a fresh database session."""
    async with async_session_maker() as db:
        indexer = DocumentIndexer(db)
        try:
            logger.info(f"Processing job {job_id} for doc {document_id}")
            await indexer.index_document(document_id, job_id)
            logger.info(f"Job {job_id} succeeded")
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}", exc_info=True)


async def dispatch_job(
    workspace_id: uuid.UUID, document_id: uuid.UUID, job_type: str = "index_document"
) -> IndexingJob:
    """
    Creates an IndexingJob row and enqueues to Redis or spawns an asyncio background task.
    """
    async with async_session_maker() as db:
        job = IndexingJob(
            workspace_id=workspace_id,
            document_id=document_id,
            job_type=job_type,
            status="queued",
            progress=0.0,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

        job_payload = {
            "job_id": str(job.id),
            "workspace_id": str(workspace_id),
            "document_id": str(document_id),
            "job_type": job_type,
        }

        redis = await get_redis_client()
        if redis:
            try:
                await redis.rpush(REDIS_QUEUE_KEY, json.dumps(job_payload))
                await redis.aclose()
                return job
            except Exception as e:
                logger.warning(f"Failed to enqueue to Redis ({e}), falling back to async task runner")

        # In-process asynchronous task runner fallback
        asyncio.create_task(execute_indexing_job(workspace_id, document_id, job.id))
        return job


async def run_worker_loop():
    logger.info("Starting NexusDocs background worker...")
    while True:
        try:
            redis = await get_redis_client()
            if not redis:
                logger.info("Redis not reachable. Worker waiting 5s...")
                await asyncio.sleep(5)
                continue

            # Blocking pop with 5s timeout
            item = await redis.blpop(REDIS_QUEUE_KEY, timeout=5)
            if item:
                _, data_str = item
                data = json.loads(data_str)
                job_id = uuid.UUID(data["job_id"])
                workspace_id = uuid.UUID(data["workspace_id"])
                document_id = uuid.UUID(data["document_id"])
                await execute_indexing_job(workspace_id, document_id, job_id)

            await redis.aclose()
        except Exception as e:
            logger.error(f"Worker loop error: {e}")
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(run_worker_loop())
