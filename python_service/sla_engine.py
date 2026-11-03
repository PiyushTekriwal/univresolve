"""
UNIV-Resolve SLA & Priority Prediction Engine
Handles:
- Priority score calculation (Severity, Impact, Affected Students, Category/Keywords)
- SLA target & deadline calculation (Working hours and Clock hours)
- Aging points calculation & Starvation Prevention
- Priority Escalation (48h rule, 72h to CRITICAL guarantee, SLA breach escalation)
- Estimated Resolution Time (ETR) based on historical data with SLA fallback and workload adjustments
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import math
import re

# ── Configurable Weights & Thresholds ────────────────────────────────────────

SEVERITY_POINTS = {
    "CRITICAL": 40,
    "HIGH": 30,
    "MEDIUM": 20,
    "LOW": 10,
}

IMPACT_POINTS = {
    "UNIVERSITY_WIDE": 30,
    "DEPARTMENT": 20,
    "INDIVIDUAL": 10,
}

PRIORITY_THRESHOLDS = {
    "CRITICAL": 70,
    "HIGH": 50,
    "MEDIUM": 30,
    "LOW": 0,
}

SLA_TARGET_HOURS = {
    "CRITICAL": 4,
    "HIGH": 8,
    "MEDIUM": 24,
    "LOW": 48,
}

# Category severity hints when user does not explicitly supply severity/impact
CATEGORY_DEFAULTS = {
    "security":    {"severity": "HIGH", "impact": "DEPARTMENT"},
    "electrical":  {"severity": "HIGH", "impact": "DEPARTMENT"},
    "internet":    {"severity": "MEDIUM", "impact": "DEPARTMENT"},
    "plumbing":    {"severity": "MEDIUM", "impact": "INDIVIDUAL"},
    "hostel":      {"severity": "MEDIUM", "impact": "INDIVIDUAL"},
    "sanitation":  {"severity": "MEDIUM", "impact": "DEPARTMENT"},
    "mess":        {"severity": "MEDIUM", "impact": "DEPARTMENT"},
    "academics":   {"severity": "MEDIUM", "impact": "INDIVIDUAL"},
    "other":       {"severity": "LOW",    "impact": "INDIVIDUAL"},
}

CRITICAL_KEYWORDS = [
    "emergency", "fire", "shock", "danger", "hazard", "explosion",
    "gas leak", "collapse", "short circuit", "sparking", "life threatening",
    "electrocution", "flood", "flooding", "ceiling collapse"
]

HIGH_KEYWORDS = [
    "urgent", "immediately", "entire hostel", "whole block", "all floors",
    "power cut", "blackout", "no water in hostel", "exam hall", "server down",
    "broken lock", "food poisoning", "contaminated water", "no internet for entire"
]

DEPARTMENT_KEYWORDS = [
    "hostel", "block", "floor", "corridor", "wing", "mess", "canteen", "lab",
    "department", "library", "classroom", "washroom"
]

UNIVERSITY_WIDE_KEYWORDS = [
    "campus", "university", "entire campus", "all hostels", "kiit", "everyone"
]


class SlaEngine:
    def __init__(self, use_working_hours: bool = False):
        """
        :param use_working_hours: If False, uses 24/7 continuous elapsed clock hours (default).
                                  If True, calculates hours during 09:00 - 18:00 Mon-Fri.
        """
        self.use_working_hours = use_working_hours

    # ── Text Analysis & Feature Extraction ────────────────────────────────────

    def infer_severity_and_impact(
        self,
        category: str,
        title: str,
        description: str,
        explicit_severity: Optional[str] = None,
        explicit_impact: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Infers severity and impact from category and text if not explicitly provided.
        Ensures existing complaint submission form does not break.
        """
        severity = (explicit_severity or "").upper()
        impact = (explicit_impact or "").upper()

        combined_text = f"{title or ''} {description or ''}".lower()
        cat_lower = (category or "other").lower()
        defaults = CATEGORY_DEFAULTS.get(cat_lower, {"severity": "LOW", "impact": "INDIVIDUAL"})

        # Infer Severity if missing or invalid
        if severity not in SEVERITY_POINTS:
            if any(k in combined_text for k in CRITICAL_KEYWORDS):
                severity = "CRITICAL"
            elif any(k in combined_text for k in HIGH_KEYWORDS):
                severity = "HIGH"
            else:
                severity = defaults["severity"]

        # Infer Impact if missing or invalid
        if impact not in IMPACT_POINTS:
            if any(k in combined_text for k in UNIVERSITY_WIDE_KEYWORDS):
                impact = "UNIVERSITY_WIDE"
            elif any(k in combined_text for k in DEPARTMENT_KEYWORDS):
                impact = "DEPARTMENT"
            else:
                impact = defaults["impact"]

        return {"severity": severity, "impact": impact}

    # ── Priority Score Calculation ────────────────────────────────────────────

    def calculate_priority_score(
        self,
        severity: str,
        impact: str,
        affected_students: Optional[int] = 1
    ) -> int:
        """
        Base priority score = Severity points + Impact points + Affected students bonus.
        Severity: Critical=40, High=30, Medium=20, Low=10
        Impact: University=30, Department=20, Individual=10
        """
        sev_pts = SEVERITY_POINTS.get(severity.upper(), 10)
        imp_pts = IMPACT_POINTS.get(impact.upper(), 10)

        aff = affected_students or 1
        aff_pts = 0
        if aff > 50:
            aff_pts = 15
        elif aff > 10:
            aff_pts = 10
        elif aff > 1:
            aff_pts = 5

        return sev_pts + imp_pts + aff_pts

    def map_score_to_priority(self, score: int) -> str:
        """Maps numerical priority score to discrete priority level."""
        if score >= PRIORITY_THRESHOLDS["CRITICAL"]:
            return "CRITICAL"
        if score >= PRIORITY_THRESHOLDS["HIGH"]:
            return "HIGH"
        if score >= PRIORITY_THRESHOLDS["MEDIUM"]:
            return "MEDIUM"
        return "LOW"

    # ── SLA Calculation ───────────────────────────────────────────────────────

    def get_sla_target_hours(self, priority: str) -> int:
        return SLA_TARGET_HOURS.get(priority.upper(), 48)

    def add_hours_to_datetime(self, start_dt: datetime, hours: float) -> datetime:
        """
        Adds hours according to whether clock hours or working hours mode is selected.
        """
        if not self.use_working_hours:
            return start_dt + timedelta(hours=hours)

        # Working hours mode: 09:00 - 18:00, Monday through Friday (9 hrs/day)
        current = start_dt
        remaining_minutes = int(hours * 60)

        while remaining_minutes > 0:
            # If weekend (5=Saturday, 6=Sunday), advance to Monday 09:00
            if current.weekday() >= 5:
                days_ahead = 7 - current.weekday()
                current = (current + timedelta(days=days_ahead)).replace(hour=9, minute=0, second=0, microsecond=0)
                continue

            # Before working hours (before 09:00)
            if current.hour < 9:
                current = current.replace(hour=9, minute=0, second=0, microsecond=0)

            # After working hours (after 18:00)
            if current.hour >= 18:
                current = (current + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
                continue

            # In working hours: compute minutes remaining until 18:00 today
            eod = current.replace(hour=18, minute=0, second=0, microsecond=0)
            available_today = int((eod - current).total_seconds() / 60)

            if remaining_minutes <= available_today:
                current += timedelta(minutes=remaining_minutes)
                remaining_minutes = 0
            else:
                remaining_minutes -= available_today
                current = (current + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)

        return current

    def calculate_sla_status(
        self,
        created_at: datetime,
        sla_target_hours: int,
        sla_due_at: datetime,
        resolved_at: Optional[datetime] = None,
        now: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Calculates elapsed time, remaining time, warning status, and breach status.
        """
        now = now or datetime.now()
        is_resolved = resolved_at is not None
        effective_now = resolved_at if is_resolved else now

        elapsed_seconds = max(0.0, (effective_now - created_at).total_seconds())
        elapsed_minutes = int(elapsed_seconds / 60)

        total_target_seconds = sla_target_hours * 3600
        warning_threshold_seconds = 0.75 * total_target_seconds

        remaining_seconds = (sla_due_at - effective_now).total_seconds()
        remaining_minutes = int(remaining_seconds / 60)

        if is_resolved:
            return {
                "sla_status": "RESOLVED",
                "is_breached": resolved_at > sla_due_at,
                "sla_breached_at": sla_due_at if resolved_at > sla_due_at else None,
                "elapsed_minutes": elapsed_minutes,
                "remaining_minutes": 0,
                "actual_resolution_minutes": elapsed_minutes,
            }

        if now > sla_due_at:
            return {
                "sla_status": "BREACHED",
                "is_breached": True,
                "sla_breached_at": sla_due_at,
                "elapsed_minutes": elapsed_minutes,
                "remaining_minutes": remaining_minutes,
                "actual_resolution_minutes": None,
            }

        if elapsed_seconds >= warning_threshold_seconds:
            return {
                "sla_status": "WARNING",
                "is_breached": False,
                "sla_breached_at": None,
                "elapsed_minutes": elapsed_minutes,
                "remaining_minutes": remaining_minutes,
                "actual_resolution_minutes": None,
            }

        return {
            "sla_status": "ON_TRACK",
            "is_breached": False,
            "sla_breached_at": None,
            "elapsed_minutes": elapsed_minutes,
            "remaining_minutes": remaining_minutes,
            "actual_resolution_minutes": None,
        }

    # ── Starvation Prevention & Aging Algorithm ──────────────────────────────

    def calculate_aging_points(self, age_hours: float) -> int:
        """
        Continuous aging score:
        - 0 to 6 hrs: 0 pts
        - 6 to 12 hrs: 5 pts
        - 12 to 24 hrs: 10 pts + (age - 12) * 0.8
        - >= 24 hrs: 20 pts + (age - 24) * 1.0
        """
        if age_hours < 6.0:
            return 0
        if age_hours < 12.0:
            return 5
        if age_hours < 24.0:
            return int(10 + (age_hours - 12.0) * 0.8)
        return int(20 + (age_hours - 24.0) * 1.0)

    def evaluate_priority_escalation(
        self,
        original_priority: str,
        base_priority_score: int,
        age_hours: float,
        is_breached: bool
    ) -> Dict[str, Any]:
        """
        Implements aging escalation and starvation prevention:
        - Unresolved for 24 hours: gains aging points.
        - Unresolved for 48 hours: escalate at least 1 priority level.
        - Unresolved for 72 hours: escalate to CRITICAL (maximum waiting time guarantee).
        - SLA breached: +25 urgency points & escalate priority level.
        """
        aging_score = self.calculate_aging_points(age_hours)
        breach_bonus = 25 if is_breached else 0
        effective_score = base_priority_score + aging_score + breach_bonus

        levels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        orig_prio = original_priority.upper()
        if orig_prio not in levels:
            orig_prio = "LOW"
        orig_idx = levels.index(orig_prio)

        # Minimum required level by aging / breach rules
        min_level_idx = orig_idx
        escalation_reasons = []

        # 72 hours guarantee: absolute escalation to CRITICAL
        if age_hours >= 72.0:
            min_level_idx = max(min_level_idx, levels.index("CRITICAL"))
            escalation_reasons.append("Starvation prevention guarantee (pending >= 72 hours)")
        # 48 hours rule: escalate at least 1 level
        elif age_hours >= 48.0:
            min_level_idx = max(min_level_idx, min(orig_idx + 1, levels.index("CRITICAL")))
            escalation_reasons.append("Aging escalation (pending >= 48 hours)")

        # SLA breach rule: escalate by at least 1 level
        if is_breached and min_level_idx < levels.index("CRITICAL"):
            min_level_idx = max(min_level_idx, min(orig_idx + 1, levels.index("CRITICAL")))
            escalation_reasons.append("SLA deadline breached escalation")

        # Score-based level
        score_level = self.map_score_to_priority(effective_score)
        score_level_idx = levels.index(score_level)

        final_level_idx = max(min_level_idx, score_level_idx, orig_idx)
        effective_priority = levels[final_level_idx]

        is_escalated = final_level_idx > orig_idx
        reason = "; ".join(escalation_reasons) if is_escalated else None

        return {
            "effective_priority": effective_priority,
            "aging_score": aging_score,
            "effective_score": effective_score,
            "is_escalated": is_escalated,
            "escalation_reason": reason,
        }

    # ── Estimated Resolution Time (ETR) ──────────────────────────────────────

    def estimate_resolution_time(
        self,
        category: str,
        effective_priority: str,
        created_at: datetime,
        sla_target_hours: int,
        historical_records: Optional[List[Dict[str, Any]]] = None,
        current_workload: int = 0,
        now: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Calculates Estimated Time to Resolve (ETR):
        1. Checks historical resolved records for (category, priority).
        2. If sufficient (>=3), uses trimmed median/mean historical duration.
        3. Else if category has >=3, uses category average scaled by priority multiplier.
        4. Else uses configurable SLA-based fallback (75% of SLA target).
        5. Adjusts for current worker workload (+10% per active queued task, max +50%).
        6. Returns estimated duration, remaining duration, completion timestamp, and readable string.
        """
        now = now or datetime.now()
        hist = historical_records or []
        cat_lower = (category or "").lower()
        prio_upper = (effective_priority or "LOW").upper()

        matching_cat_prio = [
            r["actual_resolution_minutes"] for r in hist
            if (r.get("category") or "").lower() == cat_lower
            and (r.get("priority") or "").upper() == prio_upper
            and r.get("actual_resolution_minutes") is not None
            and r["actual_resolution_minutes"] > 0
        ]

        prediction_method = "SLA_FALLBACK"
        confidence = "ESTIMATED"
        base_duration_minutes = 0

        if len(matching_cat_prio) >= 3:
            # Use trimmed median/average of historical matching records
            sorted_m = sorted(matching_cat_prio)
            median_val = sorted_m[len(sorted_m) // 2]
            avg_val = sum(sorted_m) / len(sorted_m)
            base_duration_minutes = int((median_val + avg_val) / 2)
            prediction_method = "HISTORICAL_CATEGORY_PRIORITY_AVERAGE"
            confidence = "HIGH"
        else:
            matching_cat = [
                r["actual_resolution_minutes"] for r in hist
                if (r.get("category") or "").lower() == cat_lower
                and r.get("actual_resolution_minutes") is not None
                and r["actual_resolution_minutes"] > 0
            ]
            if len(matching_cat) >= 3:
                cat_avg = sum(matching_cat) / len(matching_cat)
                multipliers = {"CRITICAL": 0.5, "HIGH": 0.75, "MEDIUM": 1.0, "LOW": 1.5}
                base_duration_minutes = int(cat_avg * multipliers.get(prio_upper, 1.0))
                prediction_method = "HISTORICAL_CATEGORY_AVERAGE"
                confidence = "MEDIUM"
            else:
                # SLA fallback: 75% of SLA target hours
                base_duration_minutes = int(sla_target_hours * 60 * 0.75)
                prediction_method = "SLA_TARGET_FALLBACK"
                confidence = "ESTIMATED"

        # Workload backlog adjustment
        workload_adj_pct = min(0.50, 0.10 * max(0, current_workload))
        total_estimated_minutes = int(base_duration_minutes * (1.0 + workload_adj_pct))

        # Time elapsed so far
        age_seconds = max(0.0, (now - created_at).total_seconds())
        age_minutes = int(age_seconds / 60)

        # Remaining minutes (minimum 15 mins to avoid 0/negative predictions for pending tasks)
        remaining_minutes = max(15, total_estimated_minutes - age_minutes)
        estimated_resolution_at = now + timedelta(minutes=remaining_minutes)

        human_readable = self.format_duration_human(remaining_minutes)

        return {
            "estimated_total_minutes": total_estimated_minutes,
            "estimated_remaining_minutes": remaining_minutes,
            "estimated_resolution_at": estimated_resolution_at,
            "estimated_resolution_human": human_readable,
            "prediction_method": prediction_method,
            "confidence": confidence,
            "workload_adjustment_applied": workload_adj_pct > 0,
        }

    @staticmethod
    def format_duration_human(minutes: int) -> str:
        """Formats minutes into readable string: '45 Minutes', '4 Hours', '1 Day and 3 Hours'"""
        if minutes < 60:
            return f"{minutes} Minutes"

        hours = minutes // 60
        rem_min = minutes % 60

        if hours < 24:
            if rem_min == 0:
                return f"{hours} {'Hour' if hours == 1 else 'Hours'}"
            return f"{hours} {'Hour' if hours == 1 else 'Hours'} {rem_min} Mins"

        days = hours // 24
        rem_hours = hours % 24
        day_str = f"{days} {'Day' if days == 1 else 'Days'}"
        if rem_hours == 0:
            return day_str
        return f"{day_str} and {rem_hours} {'Hour' if rem_hours == 1 else 'Hours'}"

    # ── Full Complaint Evaluation ─────────────────────────────────────────────

    def evaluate_complaint(
        self,
        complaint_id: Optional[int],
        title: str,
        category: str,
        description: str,
        created_at: Optional[datetime] = None,
        severity: Optional[str] = None,
        impact: Optional[str] = None,
        affected_students: Optional[int] = 1,
        resolved_at: Optional[datetime] = None,
        historical_records: Optional[List[Dict[str, Any]]] = None,
        current_workload: int = 0,
        now: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Complete end-to-end evaluation of a complaint:
        - Inferred / explicit severity and impact
        - Initial priority and SLA target
        - Aging and starvation prevention check
        - Effective priority calculation
        - SLA due date & status
        - Estimated resolution time (ETR)
        """
        now = now or datetime.now()
        created_at = created_at or now

        # 1. Severity & Impact
        inferred = self.infer_severity_and_impact(
            category=category,
            title=title,
            description=description,
            explicit_severity=severity,
            explicit_impact=impact
        )
        sev = inferred["severity"]
        imp = inferred["impact"]

        # 2. Base priority score & original priority
        base_score = self.calculate_priority_score(sev, imp, affected_students)
        original_priority = self.map_score_to_priority(base_score)

        # 3. Age calculation
        age_seconds = max(0.0, (now - created_at).total_seconds())
        age_hours = age_seconds / 3600.0

        # 4. Initial SLA target & tentative deadline
        sla_target = self.get_sla_target_hours(original_priority)
        tentative_sla_due = self.add_hours_to_datetime(created_at, sla_target)
        is_breached = (now > tentative_sla_due) and (resolved_at is None)

        # 5. Aging escalation & Starvation prevention
        escalation = self.evaluate_priority_escalation(
            original_priority=original_priority,
            base_priority_score=base_score,
            age_hours=age_hours,
            is_breached=is_breached
        )
        effective_priority = escalation["effective_priority"]
        aging_score = escalation["aging_score"]

        # 6. Final SLA target and deadline
        # If priority was escalated, recalculate SLA deadline carefully:
        effective_sla_target = self.get_sla_target_hours(effective_priority)
        effective_sla_due = self.add_hours_to_datetime(created_at, effective_sla_target)

        sla_details = self.calculate_sla_status(
            created_at=created_at,
            sla_target_hours=effective_sla_target,
            sla_due_at=effective_sla_due,
            resolved_at=resolved_at,
            now=now
        )

        # 7. Estimated Resolution Time
        etr = self.estimate_resolution_time(
            category=category,
            effective_priority=effective_priority,
            created_at=created_at,
            sla_target_hours=effective_sla_target,
            historical_records=historical_records,
            current_workload=current_workload,
            now=now
        )

        return {
            "complaint_id": complaint_id,
            "original_priority": original_priority,
            "effective_priority": effective_priority,
            "priority_score": base_score,
            "aging_score": aging_score,
            "effective_score": escalation["effective_score"],
            "severity": sev,
            "impact": imp,
            "sla_target_hours": effective_sla_target,
            "sla_due_at": effective_sla_due.isoformat(),
            "sla_status": sla_details["sla_status"],
            "sla_breached_at": sla_details["sla_breached_at"].isoformat() if sla_details["sla_breached_at"] else None,
            "time_elapsed_minutes": sla_details["elapsed_minutes"],
            "remaining_sla_minutes": sla_details["remaining_minutes"],
            "actual_resolution_minutes": sla_details["actual_resolution_minutes"],
            "estimated_resolution_at": etr["estimated_resolution_at"].isoformat(),
            "estimated_total_minutes": etr["estimated_total_minutes"],
            "estimated_remaining_minutes": etr["estimated_remaining_minutes"],
            "estimated_resolution_human": etr["estimated_resolution_human"],
            "prediction_method": etr["prediction_method"],
            "confidence": etr["confidence"],
            "escalated": escalation["is_escalated"],
            "escalation_reason": escalation["escalation_reason"],
        }

