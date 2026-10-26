package com.kiit.resolve.model;

public enum Priority {
    CRITICAL,
    HIGH,
    MEDIUM,
    LOW;

    public static Priority fromString(String val) {
        if (val == null) return MEDIUM;
        try {
            return Priority.valueOf(val.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return MEDIUM;
        }
    }
}

