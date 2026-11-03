package com.kiit.issue.service;

import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class PriorityClassificationService {

    public record PriorityResult(String priority, int baseScore) {}

    /**
     * Rule-based priority classification using:
     * - Title
     * - Description
     * - Category
     * - Optional user-selected severity
     */
    public PriorityResult classify(String title, String description, String category, String severity) {
        String t = (title != null ? title : "").toLowerCase(Locale.ROOT);
        String d = (description != null ? description : "").toLowerCase(Locale.ROOT);
        String cat = (category != null ? category : "other").trim().toLowerCase(Locale.ROOT);
        String text = (t + " " + d).trim();

        // 1. Explicit user-selected severity (if provided)
        if (severity != null) {
            String s = severity.trim().toUpperCase(Locale.ROOT);
            if ("CRITICAL".equals(s)) return new PriorityResult("CRITICAL", 100);
            if ("HIGH".equals(s)) return new PriorityResult("HIGH", 70);
            if ("MEDIUM".equals(s)) return new PriorityResult("MEDIUM", 40);
            if ("LOW".equals(s)) return new PriorityResult("LOW", 10);
        }

        // 2. CRITICAL: Fire, electrical danger, security emergency, serious safety threat
        if (containsAny(text,
                "fire", "spark", "sparking", "short circuit", "electrical shock", "electric shock",
                "gas leak", "explosion", "smoke", "burning",
                "security emergency", "intruder", "theft", "robbery", "assault", "violence",
                "weapon", "physical threat", "danger", "hazardous", "life threat", "life-threat",
                "collapse", "ceiling fall", "structural collapse", "medical emergency")) {
            return new PriorityResult("CRITICAL", 100);
        }

        // 3. LOW check for explicit non-urgent / minor / cosmetic phrasing
        // Evaluated before HIGH to prevent "non-urgent" matching "urgent"
        boolean isExplicitlyMinor = containsAny(text,
                "minor", "small scratch", "scratch", "paint", "cosmetic", "creaking",
                "light bulb change", "bulb replacement", "routine", "non-urgent", "non urgent",
                "suggestion", "optional", "low priority", "regular checkup");

        // 4. HIGH: Major water leakage, electricity failure, serious sanitation issue
        boolean isHighCondition = containsAny(text,
                "major water leakage", "water leakage", "water leak", "flooding", "pipe burst", "no water",
                "tank overflow", "submerged",
                "electricity failure", "power outage", "blackout", "no power", "complete outage",
                "voltage fluctuation", "main power failure",
                "serious sanitation", "sewage leak", "sewage overflow", "overflowing toilet", "drain block",
                "broken lock", "door lock broken", "door broken", "window broken",
                "food poisoning", "contaminated water", "severe");

        // Check standalone "urgent" only if NOT negated by "non-urgent"
        if (!isExplicitlyMinor && (isHighCondition || containsWord(text, "urgent"))) {
            return new PriorityResult("HIGH", 70);
        }

        if (isExplicitlyMinor) {
            return new PriorityResult("LOW", 10);
        }

        // 5. MEDIUM: Internet problems, hostel maintenance, regular facility problems
        if (containsAny(text,
                "internet", "wifi", "router", "lan", "slow internet", "network",
                "hostel maintenance", "fan not working", "fan", "light not working", "tube light", "bulb",
                "ac not working", "ac", "air conditioner", "cooler", "lift not working", "lift", "elevator",
                "mess", "food quality", "canteen", "cleanliness", "garbage", "trash", "dustbin", "dirty",
                "academics", "marks", "grade", "exam", "attendance", "portal", "fee")) {
            return new PriorityResult("MEDIUM", 40);
        }

        // 6. Category-based fallback defaults
        return switch (cat) {
            case "security" -> new PriorityResult("HIGH", 70);
            case "electrical", "plumbing", "sanitation", "internet", "hostel", "mess", "academics" ->
                    new PriorityResult("MEDIUM", 40);
            default -> new PriorityResult("LOW", 10); // "other" and generic requests default to LOW
        };
    }

    private boolean containsAny(String text, String... keywords) {
        for (String kw : keywords) {
            if (kw.contains(" ") || kw.contains("-")) {
                if (text.contains(kw)) return true;
            } else {
                if (containsWord(text, kw)) return true;
            }
        }
        return false;
    }

    private boolean containsWord(String text, String word) {
        return Pattern.compile("\\b" + Pattern.quote(word) + "\\b").matcher(text).find();
    }
}
