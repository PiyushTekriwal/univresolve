package com.kiit.resolve.model;

public enum SlaStatus {
    ON_TRACK,
    AT_RISK,
    OVERDUE;

    public static SlaStatus fromString(String val) {
        if (val == null) return ON_TRACK;
        try {
            return SlaStatus.valueOf(val.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ON_TRACK;
        }
    }
}

