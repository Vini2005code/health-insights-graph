from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import DashboardChart
from ..schemas import DashboardChartCreate, DashboardChartOut

router = APIRouter(prefix="/dashboard-charts", tags=["dashboard"])

MAX_CHARTS = 10


@router.get("", response_model=list[DashboardChartOut])
async def list_charts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DashboardChart).order_by(DashboardChart.position.asc()))
    return result.scalars().all()


@router.post("", response_model=DashboardChartOut, status_code=status.HTTP_201_CREATED)
async def create_chart(payload: DashboardChartCreate, db: AsyncSession = Depends(get_db)):
    count = (await db.execute(select(func.count(DashboardChart.id)))).scalar_one()
    if count >= MAX_CHARTS:
        raise HTTPException(400, f"Limite de {MAX_CHARTS} gráficos no dashboard atingido")
    chart = DashboardChart(**payload.model_dump())
    db.add(chart)
    await db.commit()
    await db.refresh(chart)
    return chart


@router.delete("/{chart_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chart(chart_id: UUID, db: AsyncSession = Depends(get_db)):
    chart = await db.get(DashboardChart, chart_id)
    if not chart:
        raise HTTPException(404, "Gráfico não encontrado")
    await db.delete(chart)
    await db.commit()