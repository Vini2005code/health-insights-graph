# Primordial Data — Backend Python (FastAPI + GROQ)

Backend equivalente ao que antes rodava no Lovable Cloud (Supabase Edge Functions).
Substitui:

- **Edge function `chat`** → endpoint `POST /chat` (streaming SSE com GROQ).
- **Tabela `patients`** → `GET/POST/PATCH/DELETE /patients`.
- **Tabela `conversations`** + `messages` → `/conversations` e `/conversations/{id}/messages`.
- **Tabela `dashboard_charts`** → `/dashboard-charts` (limite de 10).

Tudo em **Postgres** via SQLAlchemy assíncrono (`asyncpg`). É só apontar o `DATABASE_URL` no `.env`.

---

## 1. Pré-requisitos

- Python 3.11+
- Postgres rodando (local, Docker, Supabase, Neon, Railway, etc.)
- Conta na [GROQ](https://console.groq.com/keys) → gere uma API key

## 2. Setup

```bash
cd backend
cp .env.example .env
# edite .env e preencha GROQ_API_KEY e DATABASE_URL
```

### Rodar (jeito rápido)

```bash
./run.sh
```

### Rodar (jeito manual)

```bash
python3 -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API sobe em `http://localhost:8000`.
Docs interativas: `http://localhost:8000/docs`.

Na primeira execução, se `AUTO_CREATE_TABLES=true`, as tabelas são criadas automaticamente.

## 3. Postgres rápido com Docker

```bash
docker run --name primordial-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=primordial_data \
  -p 5432:5432 -d postgres:16
```

E no `.env`:
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/primordial_data
```

## 4. Endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| GET    | `/health` | Healthcheck |
| GET/POST | `/patients` | Listar / criar paciente |
| GET/PATCH/DELETE | `/patients/{id}` | Detalhe / editar / remover |
| GET/POST | `/conversations` | Listar / criar conversa |
| PATCH/DELETE | `/conversations/{id}` | Renomear / remover |
| GET | `/conversations/{id}/messages` | Mensagens da conversa |
| POST | `/conversations/messages` | Salvar mensagem |
| GET/POST | `/dashboard-charts` | Listar / fixar gráfico (máx 10) |
| DELETE | `/dashboard-charts/{id}` | Remover gráfico |
| POST | `/chat` | Stream SSE (GROQ `llama-3.3-70b-versatile`) |

## 5. Próximo passo: conectar o frontend

No frontend Vite/React (raiz do projeto), crie um `.env.local`:

```
VITE_API_URL=http://localhost:8000
```

Depois, troque as chamadas `supabase.from(...)` e `streamChat` para usar `fetch(`${import.meta.env.VITE_API_URL}/...`)`. Posso fazer essa migração quando você pedir — é o passo natural seguinte.

## 6. Estrutura

```
backend/
├── app/
│   ├── main.py            # FastAPI app + CORS + lifespan
│   ├── config.py          # Settings (lê .env)
│   ├── database.py        # Engine async + session + create_all
│   ├── models.py          # SQLAlchemy: Patient, Conversation, Message, DashboardChart
│   ├── schemas.py         # Pydantic
│   └── routers/
│       ├── patients.py
│       ├── conversations.py
│       ├── dashboard.py
│       └── chat.py        # GROQ streaming + LGPD sanitization
├── requirements.txt
├── run.sh
├── .env.example
└── README.md
```