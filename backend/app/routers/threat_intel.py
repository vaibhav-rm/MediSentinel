from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.models import ThreatIntel

router = APIRouter(prefix="/threat-intel", tags=["Threat Intelligence"])

@router.get("/feed")
async def get_feed(limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ThreatIntel).order_by(ThreatIntel.date_added.desc()).limit(limit))
    return result.scalars().all()

@router.post("/inject")
async def inject_threat(indicator: str, type: str, confidence: int, source_feed: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ThreatIntel).where(ThreatIntel.indicator == indicator))
    existing = result.scalars().first()
    if existing:
        existing.confidence = confidence
        existing.source_feed = source_feed
        await db.commit()
        return {"status": "success", "id": existing.id}

    intel = ThreatIntel(
        indicator=indicator,
        type=type,
        confidence=confidence,
        source_feed=source_feed
    )
    db.add(intel)
    await db.commit()
    return {"status": "success", "id": intel.id}
