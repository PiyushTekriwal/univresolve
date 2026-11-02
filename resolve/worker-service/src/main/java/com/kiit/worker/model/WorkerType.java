package com.kiit.worker.model;

/**
 * Worker specialization — maps 1-to-1 with complaint categories.
 *
 * Category → WorkerType mapping:
 *   electrical  → ELECTRICIAN
 *   plumbing    → PLUMBER
 *   hostel      → CARPENTER
 *   sanitation  → JANITOR
 *   mess        → MESS_WORKER
 *   security    → SECURITY_GUARD
 *   internet    → IT_TECHNICIAN
 *   academics   → ACADEMIC_COORDINATOR
 *   other       → GENERAL_WORKER
 */
public enum WorkerType {
    ELECTRICIAN,
    PLUMBER,
    CARPENTER,
    JANITOR,
    MESS_WORKER,
    SECURITY_GUARD,
    IT_TECHNICIAN,
    ACADEMIC_COORDINATOR,
    GENERAL_WORKER;

    /**
     * Derives the required WorkerType from a complaint category string.
     * Always returns a non-null value (falls back to GENERAL_WORKER).
     */
    public static WorkerType fromCategory(String category) {
        if (category == null) return GENERAL_WORKER;
        return switch (category.trim().toLowerCase()) {
            case "electrical" -> ELECTRICIAN;
            case "plumbing"   -> PLUMBER;
            case "hostel"     -> CARPENTER;
            case "sanitation" -> JANITOR;
            case "mess"       -> MESS_WORKER;
            case "security"   -> SECURITY_GUARD;
            case "internet"   -> IT_TECHNICIAN;
            case "academics"  -> ACADEMIC_COORDINATOR;
            default           -> GENERAL_WORKER;
        };
    }
}
