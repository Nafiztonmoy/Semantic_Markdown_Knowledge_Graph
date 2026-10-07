"""add_fts_and_vector_indexes

Revision ID: 1a20a3e66af4
Revises: 9ca8247bfc84
Create Date: 2026-10-05 20:43:04.155243

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "1a20a3e66af4"
down_revision: Union[str, None] = "9ca8247bfc84"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sections_fts ON document_sections "
        "USING gin(to_tsvector('english', heading_path || ' ' || content_text));"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_documents_fts ON documents "
        "USING gin(to_tsvector('english', title || ' ' || plain_text));"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_embeddings_hnsw ON embedding_records USING hnsw (embedding vector_cosine_ops);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_embeddings_hnsw;")
    op.execute("DROP INDEX IF EXISTS ix_documents_fts;")
    op.execute("DROP INDEX IF EXISTS ix_sections_fts;")
