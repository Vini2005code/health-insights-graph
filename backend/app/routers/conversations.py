from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Conversation, Message
from ..schemas import (
    ConversationCreate,
    ConversationOut,
    ConversationUpdate,
    MessageCreate,
    MessageOut,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationOut])
async def list_conversations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).order_by(Conversation.updated_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def create_conversation(payload: ConversationCreate, db: AsyncSession = Depends(get_db)):
    conv = Conversation(title=payload.title)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def rename_conversation(
    conversation_id: UUID, payload: ConversationUpdate, db: AsyncSession = Depends(get_db)
):
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(404, "Conversa não encontrada")
    conv.title = payload.title
    await db.commit()
    await db.refresh(conv)
    return conv


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(conversation_id: UUID, db: AsyncSession = Depends(get_db)):
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(404, "Conversa não encontrada")
    await db.delete(conv)
    await db.commit()


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(conversation_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    return result.scalars().all()


@router.post("/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def create_message(payload: MessageCreate, db: AsyncSession = Depends(get_db)):
    conv = await db.get(Conversation, payload.conversation_id)
    if not conv:
        raise HTTPException(404, "Conversa não encontrada")
    msg = Message(**payload.model_dump())
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg