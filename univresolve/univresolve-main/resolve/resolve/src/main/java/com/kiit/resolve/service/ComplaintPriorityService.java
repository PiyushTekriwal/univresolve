package com.kiit.resolve.service;

import com.kiit.resolve.model.Issue;
import com.kiit.resolve.model.Priority;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Intelligent Priority Scoring Service for UnivResolve complaints.
 * Centralizes all scoring weights, thresholds, hazard keywords, and category baselines.
 */
@Service
public class ComplaintPriorityService {

    // Category base weights establishing clear, realistic baselines
    private static final Map<String, Integer> CATEGORY_WEIGHTS = Map.of(
            "security", 65,      // Defaults to HIGH
            "electrical", 60,    // Defaults to HIGH (campus electrical hazards)
            "plumbing", 45,      // Defaults to MEDIUM
            "mess", 45,          // Defaults to MEDIUM
            "internet", 40,      // Defaults to MEDIUM
            "hostel", 35,        // Defaults to MEDIUM
            "sanitation", 25,    // Defaults to LOW
            "academics", 20,     // Defaults to LOW
            "other", 20          // Defaults to LOW
    );

    // Severity modifiers
    private static final Map<String, Integer> SEVERITY_BONUSES = Map.of(
            "EMERGENCY", 30,
            "SEVERE", 20,
            "STANDARD", 0,
            "LOW", -15
    );

    // Hazard / emergency keywords that trigger immediate safety escalation
    private static final Set<String> CRITICAL_HAZARD_KEYWORDS = Set.of(
            "fire", "spark", "electric shock", "shock", "gas leak", "smoke",
            "explosion", "electrocution", "short circuit", "collapse", "assault",
            "medical emergency", "hazard", "burn", "exposed wire"
    );

    private static final Set<String> HIGH_URGENCY_KEYWORDS = Set.of(
            "flood", "water leakage", "overflow", "burst pipe", "theft", "broken lock",
            "urgent", "no water", "blackout", "no power", "food poisoning",
            "contaminated", "security breach"
    );

    // Score thresholds
    public static final int THRESHOLD_CRITICAL = 80;
    public static final int THRESHOLD_HIGH = 55;
    public static final int THRESHOLD_MEDIUM = 35;

    /**
     * Determines the appropriate priority for an issue.
     * Prevents client manipulation by validating content, category, severity, and keywords.
     */
    public Priority evaluatePriority(Issue issue) {
        if (issue == null) {
            return Priority.MEDIUM;
        }

        String category = normalize(issue.getCategory());
        String severity = normalizeSeverity(issue.getSeverity());
        String text = (normalize(issue.getTitle()) + " " + normalize(issue.getDescription())).toLowerCase();

        // 1. Check for critical life-safety hazards -> immediate CRITICAL
        if (containsAnyKeyword(text, CRITICAL_HAZARD_KEYWORDS)) {
            return Priority.CRITICAL;
        }

        // 2. Base category weight
        int score = CATEGORY_WEIGHTS.getOrDefault(category, 20);

        // 3. User reported severity (sanitized)
        score += SEVERITY_BONUSES.getOrDefault(severity, 0);

        // 4. Urgency keyword boost
        if (containsAnyKeyword(text, HIGH_URGENCY_KEYWORDS)) {
            score += 25;
        }

        // 5. If client submitted a priority explicitly, validate it against allowed bounds
        if (issue.getPriority() != null) {
            Priority requested = Priority.fromString(issue.getPriority());
            // Clients can request LOW or MEDIUM freely; HIGH or CRITICAL requires sufficient score
            if (requested == Priority.CRITICAL && score >= THRESHOLD_HIGH) {
                return Priority.CRITICAL;
            } else if (requested == Priority.HIGH && score >= THRESHOLD_MEDIUM) {
                return Priority.HIGH;
            } else if (requested == Priority.LOW && score < THRESHOLD_HIGH) {
                return Priority.LOW;
            }
        }

        // 6. Map calculated score to Priority level
        if (score >= THRESHOLD_CRITICAL) {
            return Priority.CRITICAL;
        } else if (score >= THRESHOLD_HIGH) {
            return Priority.HIGH;
        } else if (score >= THRESHOLD_MEDIUM) {
            return Priority.MEDIUM;
        } else {
            return Priority.LOW;
        }
    }

    /**
     * Returns base priority weight for scheduling calculations.
     */
    public double getBasePriorityScore(Priority priority) {
        if (priority == null) return 50.0;
        return switch (priority) {
            case CRITICAL -> 120.0;
            case HIGH -> 80.0;
            case MEDIUM -> 50.0;
            case LOW -> 20.0;
        };
    }

    private boolean containsAnyKeyword(String text, Set<String> keywords) {
        if (text == null || text.isBlank()) return false;
        for (String keyword : keywords) {
            if (Pattern.compile("\\b" + Pattern.quote(keyword) + "\\b", Pattern.CASE_INSENSITIVE).matcher(text).find()) {
                return true;
            }
        }
        return false;
    }

    private String normalize(String s) {
        return s == null ? "" : s.trim().toLowerCase();
    }

    private String normalizeSeverity(String s) {
        if (s == null) return "STANDARD";
        String upper = s.trim().toUpperCase();
        if (SEVERITY_BONUSES.containsKey(upper)) {
            return upper;
        }
        return "STANDARD";
    }
}

