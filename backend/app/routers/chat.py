import json
from typing import AsyncGenerator

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..models import Patient
from ..schemas import ChatRequest

router = APIRouter(tags=["chat"])

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# LGPD: campos sensíveis removidos antes de enviar à IA
LGPD_BLACKLIST = {"name", "cpf", "rg", "telefone", "email", "endereco", "phone", "address"}


def _sanitize_patients(patients: list[Patient]) -> list[dict]:
    safe: list[dict] = []
    for i, p in enumerate(patients, start=1):
        row = {
            "paciente_id": i,
            "age": p.age,
            "gender": p.gender,
            "diagnosis": p.diagnosis,
            "admission_date": p.admission_date.isoformat() if p.admission_date else None,
            "status": p.status,
        }
        safe.append(row)
    return safe


SYSTEM_PROMPT_TEMPLATE = """Você é o Primordial Data, um assistente inteligente especializado em análise de dados clínicos.

Seu papel NÃO é atuar como médico. Você é um ANALISTA DE DADOS MÉDICOS.
Você NÃO faz diagnósticos, apenas analisa padrões e informações presentes nos dados fornecidos.

========================
REGRAS FUNDAMENTAIS
========================
- Responda SEMPRE em português brasileiro
- Use APENAS os dados fornecidos no contexto
- NUNCA invente informações ou complete dados ausentes
- Se não houver dados suficientes, diga claramente: "Dados insuficientes para análise"
- Seja direto, objetivo e técnico
- NUNCA revele dados pessoais (nome, CPF, etc.) — os dados já estão anonimizados (LGPD)

========================
ESTRUTURA DE RESPOSTA
========================
1. **RESUMO** — Resposta direta e curta à pergunta
2. **ANÁLISE** — Explicação objetiva baseada nos dados
3. **INSIGHTS** (se aplicável) — Padrões, tendências ou observações relevantes
4. **PRÓXIMAS AÇÕES** (opcional) — Sugestões úteis de análise adicional

========================
GERAÇÃO DE GRÁFICOS
========================
Se o usuário solicitar um gráfico, gere SOMENTE um bloco no formato abaixo:

```chart
{{
  "type": "bar | pie | line | area | donut",
  "title": "Título claro e objetivo",
  "data": [{{"categoria": "valor", "quantidade": número}}],
  "xKey": "categoria",
  "yKey": "quantidade"
}}
```

Tipos: bar (até 30 categorias), pie/donut (até 15 fatias, agrupar excedente em "Outros"),
line/area (até 50 pontos). SEMPRE inclua o máximo de categorias relevantes — não resuma artificialmente.
Ordene bar/pie por valor decrescente; line/area por data crescente.

{patient_context}
"""


async def _build_system_prompt(db: AsyncSession) -> str:
    result = await db.execute(select(Patient))
    patients = result.scalars().all()
    if patients:
        safe = _sanitize_patients(patients)
        context = (
            f"\n\nDADOS CLÍNICOS ANONIMIZADOS (LGPD) — Total: {len(patients)} pacientes:\n"
            f"{json.dumps(safe, ensure_ascii=False, indent=2)}"
        )
    else:
        context = "\n\nO usuário não tem pacientes cadastrados ainda."
    return SYSTEM_PROMPT_TEMPLATE.format(patient_context=context)


async def _stream_groq(payload: dict, api_key: str) -> AsyncGenerator[bytes, None]:
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, read=300.0)) as client:
        async with client.stream(
            "POST",
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                raise HTTPException(resp.status_code, body.decode("utf-8", errors="ignore"))
            async for line in resp.aiter_lines():
                if not line:
                    yield b"\n"
                    continue
                # Repassa SSE no formato OpenAI-compatible (data: {...}\n\n)
                yield (line + "\n").encode("utf-8")


@router.post("/chat")
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    if not settings.GROQ_API_KEY:
        raise HTTPException(500, "GROQ_API_KEY não configurada no .env do backend")

    system_prompt = await _build_system_prompt(db)
    payload = {
        "model": settings.GROQ_MODEL,
        "stream": True,
        "temperature": 0.1,
        "messages": [
            {"role": "system", "content": system_prompt},
            *[m.model_dump() for m in req.messages],
        ],
    }
    return StreamingResponse(
        _stream_groq(payload, settings.GROQ_API_KEY),
        media_type="text/event-stream",
    )