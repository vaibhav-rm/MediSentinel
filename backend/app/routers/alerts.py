from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime

from app.database import get_db
from app.models import Alert as DBAlert, User
from app.schemas import Alert, AlertCreate, AlertUpdate
from app.auth import get_current_active_user, require_analyst

router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("/", response_model=List[Alert])
async def read_alerts(skip: int = 0, limit: int = 100, is_resolved: bool = None, db: AsyncSession = Depends(get_db)):
    query = select(DBAlert)
    if is_resolved is not None:
        query = query.where(DBAlert.is_resolved == is_resolved)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/{alert_id}", response_model=Alert)
async def read_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DBAlert).where(DBAlert.id == alert_id))
    alert = result.scalars().first()
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert

@router.post("/", response_model=Alert)
async def create_alert(alert: AlertCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)): # In practice, AI Agents or backend services will create alerts
    db_alert = DBAlert(**alert.model_dump())
    db.add(db_alert)
    await db.commit()
    await db.refresh(db_alert)
    return db_alert

@router.patch("/{alert_id}/resolve", response_model=Alert)
async def resolve_alert(alert_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_analyst)):
    result = await db.execute(select(DBAlert).where(DBAlert.id == alert_id))
    db_alert = result.scalars().first()
    if not db_alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    db_alert.is_resolved = True
    db_alert.resolved_at = datetime.utcnow()
    db_alert.resolved_by = current_user.id
    
    await db.commit()
    await db.refresh(db_alert)
    return db_alert
