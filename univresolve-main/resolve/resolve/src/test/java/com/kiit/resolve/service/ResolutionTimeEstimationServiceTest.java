package com.kiit.resolve.service;

import com.kiit.resolve.model.Issue;
import com.kiit.resolve.model.Priority;
import com.kiit.resolve.repository.IssueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.time.LocalDateTime;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;

class ResolutionTimeEstimationServiceTest {

    private ResolutionTimeEstimationService estimationService;
    private IssueRepository issueRepository;

    @BeforeEach
    void setUp() {
        issueRepository = (IssueRepository) Proxy.newProxyInstance(
                IssueRepository.class.getClassLoader(),
                new Class<?>[]{IssueRepository.class},
                (proxy, method, args) -> {
                    if ("findByCategoryAndStatus".equals(method.getName()) || "findByStatus".equals(method.getName())) {
                        return Collections.emptyList();
                    }
                    return null;
                }
        );
        estimationService = new ResolutionTimeEstimationService(issueRepository);
    }

    @Test
    void testBaselineEstimateWhenHistoricalDataIsInsufficient() {
        LocalDateTime now = LocalDateTime.of(2026, 10, 20, 10, 0);

        Issue issue = new Issue();
        issue.setCategory("internet");
        issue.setPriority("HIGH");
        issue.setCreatedAt(now);

        ResolutionTimeEstimationService.EstimationResult result = estimationService.estimate(issue, now);

        assertNotNull(result.estimatedCompletionTime());
        assertFalse(result.isHistoricalBased(), "Must indicate provisional baseline when historical data is absent");
        assertTrue(result.remainingHours() > 0, "Remaining hours must be positive for a newly filed complaint");
        assertTrue(result.explanation().contains("HIGH priority"), "Explanation must detail priority adjustment");
    }

    @Test
    void testRemainingHoursNeverNegativeWhenOverdue() {
        LocalDateTime now = LocalDateTime.of(2026, 10, 22, 10, 0);

        Issue overdueIssue = new Issue();
        overdueIssue.setCategory("security");
        overdueIssue.setPriority("CRITICAL");
        // Submitted 48 hours ago (security baseline is 6 hours * 0.5 = 3 hours)
        overdueIssue.setCreatedAt(now.minusHours(48));

        ResolutionTimeEstimationService.EstimationResult result = estimationService.estimate(overdueIssue, now);

        assertEquals(0, result.remainingHours(), "Remaining hours must be clamped to 0 when overdue, never negative");
        assertTrue(result.isOverdue(), "Must be flagged as overdue");
        assertTrue(result.overdueHours() > 0, "Overdue hours must be positive");
        assertTrue(result.remainingTimeFormatted().contains("Overdue by"), "Must format as Overdue by Xh");
    }
}
