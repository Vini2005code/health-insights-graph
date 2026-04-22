from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import lifespan_db
from .routers import chat, conversations, dashboard, patients

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with lifespan_db():
        yield


app = FastAPI(
    title="Primordial Data API",
    version="1.0.0",
    description="Backend FastAPI + GROQ para análise de dados clínicos.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patients.router)
app.include_router(conversations.router)
app.include_router(dashboard.router)
app.include_router(chat.router)


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "model": settings.GROQ_MODEL}