package com.kiit.resolve.service;

import com.kiit.resolve.model.Issue;
import com.kiit.resolve.model.Priority;
import com.kiit.resolve.repository.IssueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ComplaintSchedulingServiceTest {

    private ComplaintSchedulingService schedulingService;
    private SlaPolicyService slaPolicyService;

    @BeforeEach
    void setUp() {
        ComplaintPriorityService priorityService = new ComplaintPriorityService();
        slaPolicyService = new SlaPolicyService();
        IssueRepository issueRepository = (IssueRepository) java.lang.reflect.Proxy.newProxyInstance(
                IssueRepository.class.getClassLoader(),
                new Class<?>[]{IssueRepository.class},
                (proxy, method, args) -> {
                    if ("findByCategoryAndStatus".equals(method.getName()) || "findByStatus".equals(method.getName())) {
                        return java.util.Collections.emptyList();
                    }
                    return null;
                }
        );
        ResolutionTimeEstimationService estimationService = new ResolutionTimeEstimationService(issueRepository);
        schedulingService = new ComplaintSchedulingService(priorityService, slaPolicyService, estimationService);
    }

    @Test
    void testAntiStarvationAgingAllowsOldLowPriorityTicketToSurpassNewMediumTicket() {
        LocalDateTime now = LocalDateTime.of(2026, 10, 20, 12, 0);

        // Ticket A: LOW priority submitted 48 hours ago
        Issue oldLow = new Issue();
        oldLow.setId(1L);
        oldLow.setTitle("Water dispenser dripping");
        oldLow.setCategory("hostel");
        oldLow.setPriority("LOW");
        oldLow.setStatus("open");
        oldLow.setCreatedAt(now.minusHours(48));

        // Ticket B: MEDIUM priority submitted 1 hour ago
        Issue newMed = new Issue();
        newMed.setId(2L);
        newMed.setTitle("Wi-Fi slow in block B");
        newMed.setCategory("internet");
        newMed.setPriority("MEDIUM");
        newMed.setStatus("open");
        newMed.setCreatedAt(now.minusHours(1));

        double scoreOldLow = schedulingService.calculateEffectiveScore(oldLow, now);
        double scoreNewMed = schedulingService.calculateEffectiveScore(newMed, now);

        assertTrue(scoreOldLow > scoreNewMed,
                String.format("Old LOW ticket (score: %.1f) must surpass new MEDIUM ticket (score: %.1f) via aging bonus",
                        scoreOldLow, scoreNewMed));
    }

    @Test
    void testCriticalEmergencyPreemptsQueueInitially() {
        LocalDateTime now = LocalDateTime.of(2026, 10, 20, 12, 0);

        Issue recentCritical = new Issue();
        recentCritical.setId(10L);
        recentCritical.setTitle("Fire alarm sounding");
        recentCritical.setCategory("security");
        recentCritical.setPriority("CRITICAL");
        recentCritical.setStatus("open");
        recentCritical.setCreatedAt(now.minusMinutes(10));

        Issue standardOpen = new Issue();
        standardOpen.setId(11L);
        standardOpen.setTitle("Routine tap wash");
        standardOpen.setCategory("plumbing");
        standardOpen.setPriority("MEDIUM");
        standardOpen.setStatus("open");
        standardOpen.setCreatedAt(now.minusHours(5));

        List<Issue> ranked = schedulingService.rankQueue(List.of(standardOpen, recentCritical), now);

        assertEquals(recentCritical.getId(), ranked.get(0).getId(),
                "Critical emergency must be ranked first in queue");
    }

    @Test
    void testResolvedComplaintsExcludedFromPendingQueue() {
        LocalDateTime now = LocalDateTime.now();

        Issue openIssue = new Issue();
        openIssue.setId(1L);
        openIssue.setStatus("open");
        openIssue.setPriority("MEDIUM");
        openIssue.setCreatedAt(now.minusHours(2));

        Issue resolvedIssue = new Issue();
        resolvedIssue.setId(2L);
        resolvedIssue.setStatus("resolved");
        resolvedIssue.setPriority("HIGH");
        resolvedIssue.setCreatedAt(now.minusHours(20));

        List<Issue> ranked = schedulingService.rankQueue(List.of(openIssue, resolvedIssue), now);

        assertEquals(1, ranked.size(), "Resolved issues must be excluded from pending queue");
        assertEquals(1L, ranked.get(0).getId());
    }

    @Test
    void testOverdueSlaEscalatesUrgencyScore() {
        LocalDateTime now = LocalDateTime.of(2026, 10, 20, 12, 0);

        Issue overdueIssue = new Issue();
        overdueIssue.setId(5L);
        overdueIssue.setCategory("electrical");
        overdueIssue.setPriority("HIGH");
        overdueIssue.setStatus("open");
        // Created 40 hours ago (HIGH electrical SLA is ~10-12 hours)
        overdueIssue.setCreatedAt(now.minusHours(40));
        overdueIssue.setSlaDeadline(now.minusHours(25));

        double bonus = slaPolicyService.getSlaUrgencyBonus(overdueIssue, now);
        assertTrue(bonus >= 50.0, "Overdue SLA must receive a high urgency bonus >= 50");
    }

    @Test
    void testDeterministicTieBreakingFifo() {
        LocalDateTime baseTime = LocalDateTime.of(2026, 10, 20, 10, 0);

        Issue issueEarlier = new Issue();
        issueEarlier.setId(20L);
        issueEarlier.setPriority("MEDIUM");
        issueEarlier.setStatus("open");
        issueEarlier.setCreatedAt(baseTime.minusMinutes(30));

        Issue issueLater = new Issue();
        issueLater.setId(21L);
        issueLater.setPriority("MEDIUM");
        issueLater.setStatus("open");
        issueLater.setCreatedAt(baseTime);

        List<Issue> ranked = schedulingService.rankQueue(List.of(issueLater, issueEarlier), baseTime);

        assertEquals(20L, ranked.get(0).getId(), "Earlier submitted complaint must win tie-break (FIFO)");
    }

    @Test
    void testUnresolvedComplaintPastDeadlineIsMarkedOverdue() {
        LocalDateTime now = LocalDateTime.of(2026, 10, 20, 12, 0);

        Issue issue = new Issue();
        issue.setStatus("open");
        issue.setCreatedAt(now.minusHours(48));
        issue.setSlaDeadline(now.minusHours(12));

        com.kiit.resolve.model.SlaStatus status = slaPolicyService.evaluateSlaStatus(issue, now);
        assertEquals(com.kiit.resolve.model.SlaStatus.OVERDUE, status, "Past deadline must be marked OVERDUE");
    }

    @Test
    void testResolvedComplaintIsNotMarkedOverdueEvenIfDeadlinePassed() {
        LocalDateTime now = LocalDateTime.of(2026, 10, 20, 12, 0);

        Issue issue = new Issue();
        issue.setStatus("resolved");
        issue.setCreatedAt(now.minusHours(48));
        issue.setSlaDeadline(now.minusHours(12));

        com.kiit.resolve.model.SlaStatus status = slaPolicyService.evaluateSlaStatus(issue, now);
        assertEquals(com.kiit.resolve.model.SlaStatus.ON_TRACK, status, "Resolved complaint must not be marked OVERDUE");
    }

    @Test
    void testComplaintWithFutureDeadlineIsNotMarkedOverdue() {
        LocalDateTime now = LocalDateTime.of(2026, 10, 20, 12, 0);

        Issue issue = new Issue();
        issue.setStatus("open");
        issue.setCreatedAt(now.minusHours(2));
        issue.setSlaDeadline(now.plusHours(24));

        com.kiit.resolve.model.SlaStatus status = slaPolicyService.evaluateSlaStatus(issue, now);
        assertEquals(com.kiit.resolve.model.SlaStatus.ON_TRACK, status, "Future deadline must be ON_TRACK");
    }

    @Test
    void testApproachingDeadlineTriggersAtRisk() {
        LocalDateTime now = LocalDateTime.of(2026, 10, 20, 12, 0);

        Issue issue = new Issue();
        issue.setStatus("open");
        issue.setCreatedAt(now.minusHours(22));
        // SLA was 24 hours, so only 2 hours remain (< 3 hours warning window)
        issue.setSlaDeadline(now.plusHours(2));

        com.kiit.resolve.model.SlaStatus status = slaPolicyService.evaluateSlaStatus(issue, now);
        assertEquals(com.kiit.resolve.model.SlaStatus.AT_RISK, status, "Approaching deadline must trigger AT_RISK");
    }

    @Test
    void testRemainingTimeLabelDoesNotShowZeroHoursRemainingWhenOverdue() {
        LocalDateTime now = LocalDateTime.of(2026, 10, 20, 12, 0);

        Issue issue = new Issue();
        issue.setStatus("open");
        issue.setCategory("hostel");
        issue.setPriority("LOW");
        issue.setCreatedAt(now.minusHours(48));
        issue.setSlaDeadline(now.minusHours(12));

        Issue enriched = schedulingService.enrich(issue, now);

        assertTrue(enriched.getIsOverdue(), "Must flag as overdue");
        assertNotNull(enriched.getOverdueHours());
        assertTrue(enriched.getOverdueHours() > 0, "Overdue hours must be positive");
        assertTrue(enriched.getRemainingTimeFormatted().contains("Overdue by"),
                "Must format as 'Overdue by Xh' instead of '0h remaining'");
    }
}

