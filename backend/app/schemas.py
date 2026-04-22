from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------- Patients ----------
class PatientBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    age: int = Field(ge=0, le=150)
    gender: str
    diagnosis: str | None = None
    admission_date: date | None = None
    status: str = "ativo"
    notes: str | None = None


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    name: str | None = None
    age: int | None = None
    gender: str | None = None
    diagnosis: str | None = None
    admission_date: date | None = None
    status: str | None = None
    notes: str | None = None


class PatientOut(PatientBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime


# ---------- Conversations & messages ----------
class ConversationCreate(BaseModel):
    title: str = "Nova conversa"


class ConversationUpdate(BaseModel):
    title: str


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    conversation_id: UUID
    role: Literal["user", "assistant"]
    content: str
    chart_data: dict[str, Any] | None = None


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    chart_data: dict[str, Any] | None
    created_at: datetime


# ---------- Dashboard charts ----------
class DashboardChartCreate(BaseModel):
    title: str
    chart_type: str
    chart_data: list[dict[str, Any]] | dict[str, Any]
    x_key: str
    y_key: str
    position: int = 0


class DashboardChartOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    chart_type: str
    chart_data: Any
    x_key: str
    y_key: str
    position: int
    created_at: datetime


# ---------- Chat ----------
class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]