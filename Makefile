.PHONY: help setup dev dev-api dev-web dev-worker test test-backend test-frontend lint format migrate seed clean build-docker up-docker down-docker

help:
	@echo "NexusDocs Commands:"
	@echo "  make setup         - Set up Python and Node dependencies"
	@echo "  make dev           - Run full stack in local dev mode"
	@echo "  make dev-api       - Run FastAPI backend"
	@echo "  make dev-web       - Run Next.js frontend"
	@echo "  make dev-worker    - Run background worker"
	@echo "  make test          - Run all test suites"
	@echo "  make migrate       - Run database migrations"
	@echo "  make seed          - Seed Acme Engineering demo dataset"
	@echo "  make lint          - Lint frontend and backend code"
	@echo "  make up-docker     - Start all services with Docker Compose"
	@echo "  make down-docker   - Stop Docker Compose services"

setup:
	uv venv --python 3.12 .venv
	.venv/Scripts/pip install -e ./apps/api
	cd apps/web && npm install

dev-api:
	.venv/Scripts/python -m uvicorn apps.api.app.main:app --reload --port 8000 --host 0.0.0.0

dev-web:
	cd apps/web && npm run dev

dev-worker:
	.venv/Scripts/python -m apps.api.app.services.worker

migrate:
	.venv/Scripts/python -m alembic -c apps/api/alembic.ini upgrade head

seed:
	.venv/Scripts/python -m apps.api.app.services.seed

test: test-backend test-frontend

test-backend:
	.venv/Scripts/python -m pytest apps/api/tests -v

test-frontend:
	cd apps/web && npm run test

lint:
	.venv/Scripts/python -m ruff check apps/api
	cd apps/web && npm run lint

format:
	.venv/Scripts/python -m ruff format apps/api
	cd apps/web && npm run format

up-docker:
	docker compose up --build -d

down-docker:
	docker compose down -v
