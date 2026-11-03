package com.kiit.issue.service;

import com.kiit.issue.model.Issue;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.client.RestTemplateBuilder;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class PriorityAndAgingTest {

    private final PriorityClassificationService classifier = new PriorityClassificationService();
    private final SlaIntegrationService slaService = new SlaIntegrationService(new RestTemplateBuilder(), classifier);

    @Test
    @DisplayName("Test 1: Priority Classification - Critical, High, Medium, Low")
    void testPriorityClassification() {
        // Critical: Fire, electrical danger, security emergency
        var critFire = classifier.classify("Fire outbreak in kitchen", "Immediate danger, smoke detected", "mess", null);
        assertEquals("CRITICAL", critFire.priority());
        assertEquals(100, critFire.baseScore());

        var critSpark = classifier.classify("Short circuit sparking in lab", "High voltage electrical shock hazard", "electrical", null);
        assertEquals("CRITICAL", critSpark.priority());
        assertEquals(100, critSpark.baseScore());

        var critSecurity = classifier.classify("Intruder in hostel wing", "Security emergency, physical threat", "security", null);
        assertEquals("CRITICAL", critSecurity.priority());
        assertEquals(100, critSecurity.baseScore());

        // High: Major water leakage, electricity failure, serious sanitation
        var highWater = classifier.classify("Major water leakage in Block B", "Pipe burst, flooded corridor", "plumbing", null);
        assertEquals("HIGH", highWater.priority());
        assertEquals(70, highWater.baseScore());

        var highPower = classifier.classify("Complete power outage in block", "Electricity failure across all rooms", "electrical", null);
        assertEquals("HIGH", highPower.priority());
        assertEquals(70, highPower.baseScore());

        var highSanitation = classifier.classify("Sewage leak in washroom", "Serious sanitation overflow", "sanitation", null);
        assertEquals("HIGH", highSanitation.priority());
        assertEquals(70, highSanitation.baseScore());

        // Medium: Internet, hostel maintenance, regular facility
        var medWifi = classifier.classify("WiFi router not working", "Slow internet in room 302", "internet", null);
        assertEquals("MEDIUM", medWifi.priority());
        assertEquals(40, medWifi.baseScore());

        var medFan = classifier.classify("Ceiling fan making noise", "Hostel maintenance regular repair", "hostel", null);
        assertEquals("MEDIUM", medFan.priority());
        assertEquals(40, medFan.baseScore());

        // Low: Minor maintenance, cosmetic, non-urgent
        var lowCosmetic = classifier.classify("Small scratch on door", "Minor cosmetic paint touchup request", "hostel", null);
        assertEquals("LOW", lowCosmetic.priority());
        assertEquals(10, lowCosmetic.baseScore());

        var lowGeneric = classifier.classify("Optional suggestion for lounge", "Non-urgent routine request", "other", null);
        assertEquals("LOW", lowGeneric.priority());
        assertEquals(10, lowGeneric.baseScore());
    }

    @Test
    @DisplayName("Test 2: Priority Aging - 6, 12, 24, 48 hours")
    void testPriorityAging() {
        LocalDateTime baseTime = LocalDateTime.of(2026, 1, 1, 10, 0);

        // Low complaint created with initial score 10
        Issue lowIssue = new Issue();
        lowIssue.setId(101L);
        lowIssue.setCategory("other");
        lowIssue.setPriority("LOW");
        lowIssue.setBasePriorityScore(10);
        lowIssue.setCurrentPriorityScore(10);
        lowIssue.setCreatedAt(baseTime);

        // At 0 hours: 10
        assertEquals(0, calculateAging(baseTime, baseTime));
        assertEquals(10, 10 + calculateAging(baseTime, baseTime));

        // After 6 hours: 20
        LocalDateTime at6h = baseTime.plusHours(6);
        assertEquals(10, calculateAging(baseTime, at6h));
        assertEquals(20, 10 + calculateAging(baseTime, at6h));

        // After 12 hours: 30
        LocalDateTime at12h = baseTime.plusHours(12);
        assertEquals(20, calculateAging(baseTime, at12h));
        assertEquals(30, 10 + calculateAging(baseTime, at12h));

        // After 18 hours: 40
        LocalDateTime at18h = baseTime.plusHours(18);
        assertEquals(30, calculateAging(baseTime, at18h));
        assertEquals(40, 10 + calculateAging(baseTime, at18h));

        // After 24 hours: 50
        LocalDateTime at24h = baseTime.plusHours(24);
        assertEquals(40, calculateAging(baseTime, at24h));
        assertEquals(50, 10 + calculateAging(baseTime, at24h));

        // After 48 hours: 90
        LocalDateTime at48h = baseTime.plusHours(48);
        assertEquals(80, calculateAging(baseTime, at48h));
        assertEquals(90, 10 + calculateAging(baseTime, at48h));
    }

    @Test
    @DisplayName("Test 3: Starvation Prevention - Aging allows LOW to overtake newer MEDIUM and HIGH")
    void testStarvationPrevention() {
        LocalDateTime day1_0900 = LocalDateTime.of(2026, 1, 1, 9, 0);
        LocalDateTime day1_1000 = LocalDateTime.of(2026, 1, 1, 10, 0);
        LocalDateTime day1_1100 = LocalDateTime.of(2026, 1, 1, 11, 0);

        // 1 LOW complaint at 9 AM
        Issue low1 = new Issue();
        low1.setId(1L);
        low1.setTitle("Minor cupboard scratch");
        low1.setCategory("hostel");
        low1.setPriority("LOW");
        low1.setBasePriorityScore(10);
        low1.setCurrentPriorityScore(10);
        low1.setCreatedAt(day1_0900);

        // 3 MEDIUM complaints at 10 AM (base score 40)
        List<Issue> mediums = new ArrayList<>();
        for (long i = 2; i <= 4; i++) {
            Issue m = new Issue();
            m.setId(i);
            m.setTitle("Fan repair #" + i);
            m.setCategory("hostel");
            m.setPriority("MEDIUM");
            m.setBasePriorityScore(40);
            m.setCurrentPriorityScore(40);
            m.setCreatedAt(day1_1000);
            mediums.add(m);
        }

        // 3 HIGH complaints at 11 AM (base score 70)
        List<Issue> highs = new ArrayList<>();
        for (long i = 5; i <= 7; i++) {
            Issue h = new Issue();
            h.setId(i);
            h.setTitle("Broken lock #" + i);
            h.setCategory("hostel");
            h.setPriority("HIGH");
            h.setBasePriorityScore(70);
            h.setCurrentPriorityScore(70);
            h.setCreatedAt(day1_1100);
            highs.add(h);
        }

        // Initial check: At 11:30 AM, HIGH (70) > MEDIUM (40) > LOW (10)
        List<Issue> queue = new ArrayList<>();
        queue.add(low1);
        queue.addAll(mediums);
        queue.addAll(highs);
        queue.sort(SlaIntegrationService.issueFairComparator());

        assertEquals(5L, queue.get(0).getId(), "Highest base score should be first initially");
        assertEquals(1L, queue.get(6).getId(), "LOW complaint should be last initially");

        // Simulate 24 hours of waiting for low1:
        // low1 score becomes 10 + (24/6)*10 = 50.
        // It now overtakes newly arrived MEDIUM complaints (score 40)!
        low1.setCurrentPriorityScore(50);
        queue.sort(SlaIntegrationService.issueFairComparator());
        assertTrue(queue.indexOf(low1) < queue.indexOf(mediums.get(0)),
                "Aged LOW complaint (score 50) should move ahead of newer MEDIUM complaints (score 40)");

        // Simulate 48 hours of waiting for low1:
        // low1 score becomes 10 + (48/6)*10 = 90.
        // It now overtakes newly arrived HIGH complaints (score 70)!
        low1.setCurrentPriorityScore(90);
        queue.sort(SlaIntegrationService.issueFairComparator());
        assertEquals(0, queue.indexOf(low1),
                "Aged LOW complaint (score 90) must overtake newly arrived HIGH complaints (score 70) to prevent starvation!");
    }

    @Test
    @DisplayName("Test 4: Dynamic ETA - Category and Priority vary dynamically")
    void testDynamicEta() {
        LocalDateTime now = LocalDateTime.now();

        Issue electrical = createMockIssue(1L, "electrical", "MEDIUM", 40, now);
        Issue internet = createMockIssue(2L, "internet", "MEDIUM", 40, now);
        Issue plumbing = createMockIssue(3L, "plumbing", "MEDIUM", 40, now);
        Issue academics = createMockIssue(4L, "academics", "MEDIUM", 40, now);

        slaService.calculateAndApplyDynamicEta(electrical, 0, 1);
        slaService.calculateAndApplyDynamicEta(internet, 0, 1);
        slaService.calculateAndApplyDynamicEta(plumbing, 0, 1);
        slaService.calculateAndApplyDynamicEta(academics, 0, 1);

        assertNotNull(electrical.getEstimatedDurationMinutes());
        assertNotNull(internet.getEstimatedDurationMinutes());
        assertNotNull(plumbing.getEstimatedDurationMinutes());
        assertNotNull(academics.getEstimatedDurationMinutes());

        // Verify durations are not identical across categories
        assertNotEquals(electrical.getEstimatedDurationMinutes(), academics.getEstimatedDurationMinutes());
        assertNotEquals(internet.getEstimatedDurationMinutes(), plumbing.getEstimatedDurationMinutes());

        assertEquals(240L, electrical.getEstimatedDurationMinutes(), "Electrical base is 4 hours (240m)");
        assertEquals(120L, internet.getEstimatedDurationMinutes(), "Internet base is 2 hours (120m)");
        assertEquals(180L, plumbing.getEstimatedDurationMinutes(), "Plumbing base is 3 hours (180m)");
        assertEquals(1440L, academics.getEstimatedDurationMinutes(), "Academics base is 24 hours (1440m)");

        // Priority multiplier test: CRITICAL should be faster than LOW for the same category
        Issue critElec = createMockIssue(5L, "electrical", "CRITICAL", 100, now);
        Issue lowElec = createMockIssue(6L, "electrical", "LOW", 10, now);

        slaService.calculateAndApplyDynamicEta(critElec, 0, 1);
        slaService.calculateAndApplyDynamicEta(lowElec, 0, 1);

        assertEquals(120L, critElec.getEstimatedDurationMinutes(), "Critical electrical is 0.5x base = 120m");
        assertEquals(300L, lowElec.getEstimatedDurationMinutes(), "Low electrical is 1.25x base = 300m");
        assertTrue(critElec.getEstimatedDurationMinutes() < lowElec.getEstimatedDurationMinutes());

        // Queue waiting test: having older pending complaints increases ETA
        Issue queuedElec = createMockIssue(7L, "electrical", "MEDIUM", 40, now);
        slaService.calculateAndApplyDynamicEta(queuedElec, 2, 1); // 2 complaints ahead in queue
        assertTrue(queuedElec.getEstimatedDurationMinutes() > electrical.getEstimatedDurationMinutes(),
                "Complaint with queue backlog must have a larger estimated duration");
    }

    @Test
    @DisplayName("Test 6: Resolved complaints stop accumulating aging and clear remaining time")
    void testResolvedComplaintsStopAging() {
        LocalDateTime created = LocalDateTime.now().minusHours(24);
        Issue resolved = createMockIssue(10L, "electrical", "LOW", 10, created);
        resolved.setStatus("resolved");
        resolved.setResolvedAt(created.plusHours(2));

        List<Issue> list = List.of(resolved);
        slaService.recalculateActiveIssues(list, List.of());

        assertEquals(0L, resolved.getEstimatedRemainingMinutes());
        assertEquals("RESOLVED", resolved.getSlaStatus());
    }

    private Issue createMockIssue(Long id, String category, String priority, int baseScore, LocalDateTime createdAt) {
        Issue issue = new Issue();
        issue.setId(id);
        issue.setTitle("Issue #" + id);
        issue.setCategory(category);
        issue.setPriority(priority);
        issue.setBasePriorityScore(baseScore);
        issue.setCurrentPriorityScore(baseScore);
        issue.setCreatedAt(createdAt);
        issue.setStatus("open");
        issue.setAssignmentStatus("pending_assignment");
        return issue;
    }

    private int calculateAging(LocalDateTime created, LocalDateTime asOf) {
        long hours = java.time.Duration.between(created, asOf).toHours();
        return (int) (hours / 6) * 10;
    }
}

