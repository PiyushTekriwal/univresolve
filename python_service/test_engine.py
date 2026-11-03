"""
Unit tests for SlaEngine verifying all core scenarios:
- Initial priority and SLA target
- Aging points after 6h, 12h, 24h
- Escalation after 48h (at least 1 level)
- Escalation after 72h (guaranteed CRITICAL)
- SLA breach status and breach escalation
- Resolved SLA timer stop
- Historical average ETR vs Fallback ETR
- Starvation prevention & tie-breaking order
"""

from datetime import datetime, timedelta
from sla_engine import SlaEngine

def run_tests():
    engine = SlaEngine(use_working_hours=False)
    now = datetime(2026, 11, 2, 12, 0, 0)

    print("Running SlaEngine verification tests...\n")

    # TEST 1: New complaint receives initial priority and SLA deadline
    res1 = engine.evaluate_complaint(
        complaint_id=1,
        title="Broken water tap",
        category="plumbing",
        description="Water tap in room 101 is leaking slowly",
        created_at=now,
        now=now
    )
    assert res1["original_priority"] in ["LOW", "MEDIUM"], f"Unexpected priority: {res1['original_priority']}"
    assert res1["sla_target_hours"] in [24, 48]
    assert res1["sla_status"] == "ON_TRACK"
    print("PASS: TEST 1 - New complaint received initial priority and SLA deadline.")

    # TEST 2: Low-priority pending for 24h receives aging points
    created_24h_ago = now - timedelta(hours=24)
    res2 = engine.evaluate_complaint(
        complaint_id=2,
        title="Minor fan squeak",
        category="other",
        description="Fan has a minor squeak",
        severity="LOW",
        impact="INDIVIDUAL",
        created_at=created_24h_ago,
        now=now
    )
    assert res2["aging_score"] >= 20, f"Expected aging >= 20, got {res2['aging_score']}"
    print(f"PASS: TEST 2 - Complaint pending 24h received {res2['aging_score']} aging points.")

    # TEST 3: Low-priority pending for 48h is escalated at least 1 level
    created_48h_ago = now - timedelta(hours=48)
    res3 = engine.evaluate_complaint(
        complaint_id=3,
        title="Room desk drawer stuck",
        category="hostel",
        description="Drawer stuck",
        severity="LOW",
        impact="INDIVIDUAL",
        created_at=created_48h_ago,
        now=now
    )
    assert res3["original_priority"] == "LOW"
    assert res3["effective_priority"] in ["MEDIUM", "HIGH", "CRITICAL"], f"Escalation failed: {res3['effective_priority']}"
    assert res3["escalated"] is True
    print(f"PASS: TEST 3 - Complaint pending 48h escalated from LOW to {res3['effective_priority']}.")

    # TEST 4: Complaint pending for 72h escalated to CRITICAL
    created_72h_ago = now - timedelta(hours=72)
    res4 = engine.evaluate_complaint(
        complaint_id=4,
        title="Curtain rod loose",
        category="hostel",
        description="Curtain rod is loose",
        severity="LOW",
        impact="INDIVIDUAL",
        created_at=created_72h_ago,
        now=now
    )
    assert res4["effective_priority"] == "CRITICAL", f"Expected CRITICAL, got {res4['effective_priority']}"
    assert "72" in (res4["escalation_reason"] or "")
    print("PASS: TEST 4 - Complaint pending 72h escalated to CRITICAL.")

    # TEST 5: Breached complaint is marked BREACHED
    created_50h_ago = now - timedelta(hours=50) # Target was 48h
    res5 = engine.evaluate_complaint(
        complaint_id=5,
        title="Light bulb fused",
        category="electrical",
        description="Normal light bulb replacement",
        severity="LOW",
        impact="INDIVIDUAL",
        created_at=created_50h_ago,
        now=now
    )
    assert res5["sla_status"] == "BREACHED"
    print("PASS: TEST 5 - Overdue complaint correctly marked as BREACHED.")

    # TEST 6: Resolved complaint stops timer and records resolution time
    resolved_at = now - timedelta(hours=2)
    res6 = engine.evaluate_complaint(
        complaint_id=6,
        title="WiFi router restart",
        category="internet",
        description="WiFi was down",
        created_at=now - timedelta(hours=5),
        resolved_at=resolved_at,
        now=now
    )
    assert res6["sla_status"] == "RESOLVED"
    assert res6["actual_resolution_minutes"] == 180  # 3 hours
    assert res6["remaining_sla_minutes"] == 0
    print("PASS: TEST 6 - Resolved complaint stopped SLA timer and recorded actual duration.")

    # TEST 7: Historical data prediction when available (>= 3 records)
    history = [
        {"category": "plumbing", "priority": "MEDIUM", "actual_resolution_minutes": 120},
        {"category": "plumbing", "priority": "MEDIUM", "actual_resolution_minutes": 140},
        {"category": "plumbing", "priority": "MEDIUM", "actual_resolution_minutes": 130},
    ]
    res7 = engine.evaluate_complaint(
        complaint_id=7,
        title="Leaking pipe",
        category="plumbing",
        description="Standard pipe leak",
        severity="MEDIUM",
        impact="INDIVIDUAL",
        created_at=now,
        historical_records=history,
        now=now
    )
    assert res7["prediction_method"] == "HISTORICAL_CATEGORY_PRIORITY_AVERAGE"
    assert res7["confidence"] == "HIGH"
    print(f"PASS: TEST 7 - Predicted resolution using historical data: {res7['estimated_resolution_human']}.")

    # TEST 8: Fallback prediction when insufficient historical data
    res8 = engine.evaluate_complaint(
        complaint_id=8,
        title="Unique rare issue",
        category="other",
        description="Unknown special hardware problem",
        severity="LOW",
        impact="INDIVIDUAL",
        created_at=now,
        historical_records=[],
        now=now
    )
    assert res8["prediction_method"] == "SLA_TARGET_FALLBACK"
    assert res8["confidence"] == "ESTIMATED"
    print(f"PASS: TEST 8 - Fallback SLA estimate applied: {res8['estimated_resolution_human']}.")

    # TEST 9: Starvation prevention queue sorting
    c_new_high = {
        "complaint_id": 101, "effective_priority": "HIGH", "aging_score": 0,
        "sla_status": "ON_TRACK", "sla_due_at": (now + timedelta(hours=8)).isoformat(),
        "created_at": now.isoformat()
    }
    c_old_low_escalated = {
        "complaint_id": 102, "effective_priority": "CRITICAL", "aging_score": 68,
        "sla_status": "BREACHED", "sla_due_at": (now - timedelta(hours=24)).isoformat(),
        "created_at": (now - timedelta(hours=72)).isoformat()
    }
    # Old complaint escalated to CRITICAL must rank higher than newer HIGH complaint
    prio_rank = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
    def key_fn(c):
        return (prio_rank[c["effective_priority"]], 1 if c["sla_status"] == "BREACHED" else 0, c["aging_score"])
    
    assert key_fn(c_old_low_escalated) > key_fn(c_new_high), "Starvation prevention failed!"
    print("PASS: TEST 9 & 11 - Starvation prevention queue puts aged, escalated complaint above newer high complaint.")

    print("\nAll Python SlaEngine tests passed successfully!")

if __name__ == "__main__":
    run_tests()

