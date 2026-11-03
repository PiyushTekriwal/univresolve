"""
UNIV-Resolve SLA Management & Prediction Service (FastAPI)
Port: 8002
Endpoints:
- POST /api/sla/evaluate
- POST /api/sla/recalculate
- POST /api/sla/predict
- GET  /api/sla/complaint/{complaint_id}
- GET  /health
"""

import os
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from sla_engine import SlaEngine

app = FastAPI(
    title="UNIV-Resolve SLA & Prediction Service",
    description="Engine for Complaint Priority, SLA Management, Starvation Prevention, and ETR",
    version="1.0.0"
)

# Shared security token for communication between Spring Boot and Python service
INTERNAL_TOKEN = os.getenv("SLA_SERVICE_TOKEN", "univ-resolve-sla-secret-token")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = SlaEngine(use_working_hours=False)


# ── Auth Dependency ──────────────────────────────────────────────────────────

def verify_internal_token(x_internal_token: Optional[str] = Header(None)):
    """Validates the internal authorization token between Spring Boot and Python service."""
    # Allow local development if token is not configured or matches
    if x_internal_token and x_internal_token != INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized internal service token")
    return True


# ── Pydantic Request Models ──────────────────────────────────────────────────

class ComplaintEvaluateRequest(BaseModel):
    complaint_id: Optional[int] = None
    title: str = Field(..., description="Issue title")
    category: str = Field(..., description="Issue category")
    description: str = Field(..., description="Detailed description")
    created_at: Optional[str] = Field(None, description="ISO format creation timestamp")
    severity: Optional[str] = None
    impact: Optional[str] = None
    affected_students: Optional[int] = 1
    resolved_at: Optional[str] = None
    historical_records: Optional[List[Dict[str, Any]]] = None
    current_workload: Optional[int] = 0
    simulated_now: Optional[str] = None  # for testing aging/breaches without waiting


class ComplaintRecalculateItem(BaseModel):
    complaint_id: int
    title: str
    category: str
    description: str
    original_priority: Optional[str] = None
    priority_score: Optional[int] = None
    aging_score: Optional[int] = None
    created_at: str
    sla_target_hours: Optional[int] = None
    sla_due_at: Optional[str] = None
    sla_status: Optional[str] = None
    status: Optional[str] = "open"
    resolved_at: Optional[str] = None
    severity: Optional[str] = None
    impact: Optional[str] = None
    affected_students: Optional[int] = 1
    current_workload: Optional[int] = 0


class BatchRecalculateRequest(BaseModel):
    complaints: List[ComplaintRecalculateItem]
    historical_records: Optional[List[Dict[str, Any]]] = None
    simulated_now: Optional[str] = None


class PredictRequest(BaseModel):
    category: str
    priority: str
    created_at: Optional[str] = None
    sla_target_hours: Optional[int] = 24
    historical_records: Optional[List[Dict[str, Any]]] = None
    current_workload: Optional[int] = 0


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "service": "UNIV-Resolve SLA & Prediction Service",
        "engine_mode": "working_hours" if engine.use_working_hours else "clock_hours",
        "timestamp": datetime.now().isoformat()
    }


@app.post("/api/sla/evaluate")
def evaluate_complaint(req: ComplaintEvaluateRequest, authorized: bool = Depends(verify_internal_token)):
    """
    Evaluates a complaint when submitted or viewed:
    - Calculates Severity, Impact, Priority Score & Level
    - Calculates SLA Target Hours, Due Date, and Status
    - Evaluates Aging & Starvation Escalation
    - Predicts Estimated Resolution Time (ETR)
    """
    created_dt = datetime.fromisoformat(req.created_at) if req.created_at else datetime.now()
    resolved_dt = datetime.fromisoformat(req.resolved_at) if req.resolved_at else None
    now_dt = datetime.fromisoformat(req.simulated_now) if req.simulated_now else datetime.now()

    result = engine.evaluate_complaint(
        complaint_id=req.complaint_id,
        title=req.title,
        category=req.category,
        description=req.description,
        created_at=created_dt,
        severity=req.severity,
        impact=req.impact,
        affected_students=req.affected_students or 1,
        resolved_at=resolved_dt,
        historical_records=req.historical_records or [],
        current_workload=req.current_workload or 0,
        now=now_dt
    )
    return result


@app.post("/api/sla/recalculate")
def recalculate_batch(req: BatchRecalculateRequest, authorized: bool = Depends(verify_internal_token)):
    """
    Batch recalculates aging, effective priority, SLA statuses, and ETR
    for all active complaints. Called by Spring Boot periodic scheduler.
    """
    now_dt = datetime.fromisoformat(req.simulated_now) if req.simulated_now else datetime.now()
    updated_complaints = []

    for item in req.complaints:
        created_dt = datetime.fromisoformat(item.created_at) if item.created_at else now_dt
        resolved_dt = datetime.fromisoformat(item.resolved_at) if item.resolved_at else None

        res = engine.evaluate_complaint(
            complaint_id=item.complaint_id,
            title=item.title,
            category=item.category,
            description=item.description,
            created_at=created_dt,
            severity=item.severity,
            impact=item.impact,
            affected_students=item.affected_students or 1,
            resolved_at=resolved_dt,
            historical_records=req.historical_records or [],
            current_workload=item.current_workload or 0,
            now=now_dt
        )
        updated_complaints.append(res)

    # Sort in fair priority order (Priority Queue):
    # 1. Effective Priority (CRITICAL > HIGH > MEDIUM > LOW)
    # 2. Breached status first
    # 3. Aging Score descending
    # 4. Oldest created_at first (fairness tie-breaker)
    prio_rank = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}

    def sort_key(c):
        p = prio_rank.get(c["effective_priority"], 0)
        is_breached = 1 if c["sla_status"] == "BREACHED" else 0
        aging = c["aging_score"]
        # Invert timestamp for descending sort
        dt = datetime.fromisoformat(c["sla_due_at"]).timestamp()
        return (p, is_breached, aging, -dt)

    sorted_complaints = sorted(updated_complaints, key=sort_key, reverse=True)

    return {
        "count": len(sorted_complaints),
        "recalculated_at": now_dt.isoformat(),
        "complaints": sorted_complaints
    }


@app.post("/api/sla/predict")
def predict_resolution_time(req: PredictRequest, authorized: bool = Depends(verify_internal_token)):
    """On-demand prediction of estimated resolution time."""
    created_dt = datetime.fromisoformat(req.created_at) if req.created_at else datetime.now()
    etr = engine.estimate_resolution_time(
        category=req.category,
        effective_priority=req.priority,
        created_at=created_dt,
        sla_target_hours=req.sla_target_hours or 24,
        historical_records=req.historical_records or [],
        current_workload=req.current_workload or 0,
        now=datetime.now()
    )
    return {
        "category": req.category,
        "priority": req.priority,
        "estimated_total_minutes": etr["estimated_total_minutes"],
        "estimated_remaining_minutes": etr["estimated_remaining_minutes"],
        "estimated_resolution_at": etr["estimated_resolution_at"].isoformat(),
        "estimated_resolution_human": etr["estimated_resolution_human"],
        "prediction_method": etr["prediction_method"],
        "confidence": etr["confidence"]
    }


@app.get("/api/sla/complaint/{complaint_id}")
def get_complaint_sla(complaint_id: int):
    return {
        "complaint_id": complaint_id,
        "status": "ready",
        "message": "Use POST /api/sla/evaluate to evaluate complaint with full attributes"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8002, reload=True)

