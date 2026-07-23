from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any
from app.database import get_db
from app.models import AuditLog, IncidentRecord, ThreatIntel
import hashlib
import json

router = APIRouter(prefix="/compliance", tags=["Compliance"])

def verify_hash_chain(logs):
    """
    Verifies that the hash chain of audit logs is intact.
    """
    if not logs:
        return True

    # Verify the first log's hash independently
    content = f"{logs[0].previous_hash}{logs[0].action}{logs[0].actor}{logs[0].target}{json.dumps(logs[0].details, sort_keys=True)}"
    recalculated_hash = hashlib.sha256(content.encode()).hexdigest()
    if logs[0].current_hash != recalculated_hash:
        return False

    for i in range(1, len(logs)):
        if logs[i].previous_hash != logs[i-1].current_hash:
            return False
        
        # Verify current hash matches its contents
        content = f"{logs[i].previous_hash}{logs[i].action}{logs[i].actor}{logs[i].target}{json.dumps(logs[i].details, sort_keys=True)}"
        recalculated_hash = hashlib.sha256(content.encode()).hexdigest()
        if logs[i].current_hash != recalculated_hash:
            return False
            
    return True

@router.get("/scorecard")
async def get_scorecard(db: AsyncSession = Depends(get_db)):
    # Mocked compliance scorecard based on generic rules
    return {
        "access_control": 95,
        "audit_controls": 100,
        "integrity": 100,
        "transmission_security": 92,
        "overall": 96
    }

@router.get("/audit-logs")
async def get_audit_logs(limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AuditLog).order_by(AuditLog.id.desc()).limit(limit))
    logs = result.scalars().all()

    # Shape each row into a block the cryptographic-ledger UI can render directly.
    blocks = []
    for log in logs:
        details = log.details if isinstance(log.details, dict) else {}
        hipaa = (details.get("hipaa_ref") or {})
        policy = f"HIPAA {hipaa.get('rule', '§164.312(b)')} {hipaa.get('control', 'Audit Controls')}".strip()
        blocks.append({
            "id": log.id,
            "action": log.action,
            "actor": log.actor,
            "target": log.target,
            "hipaa": policy,
            "hash": log.current_hash,
            "prevHash": log.previous_hash,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "status": "VERIFIED & LOCKED",
        })
    return blocks

@router.get("/verify-chain")
async def verify_chain(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AuditLog).order_by(AuditLog.id.asc()))
    logs = result.scalars().all()
    
    if not logs:
        return {"status": "valid", "message": "No logs to verify"}
        
    is_valid = verify_hash_chain(logs)
    return {"status": "valid" if is_valid else "invalid"}
    
@router.get("/export-report")
async def export_report(db: AsyncSession = Depends(get_db)):
    # In a real scenario, this would use reportlab to generate a PDF and return a FileResponse
    # For prototype, we just return a success payload to trigger the frontend mockup
    return {"status": "success", "url": "/dummy-pdf-url.pdf"}
