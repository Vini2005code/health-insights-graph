#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip > /dev/null
pip install -r requirements.txt

if [ ! -f ".env" ]; then
  echo "⚠️  .env não encontrado. Copie .env.example para .env e preencha GROQ_API_KEY + DATABASE_URL."
  exit 1
fi

exec uvicorn app.main:app --reload --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}"