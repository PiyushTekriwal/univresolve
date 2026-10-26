package com.kiit.resolve.service;

import com.kiit.resolve.model.Issue;
import com.kiit.resolve.model.Priority;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ComplaintPriorityServiceTest {

    private ComplaintPriorityService service;

    @BeforeEach
    void setUp() {
        service = new ComplaintPriorityService();
    }

    @Test
    void testCriticalSafetyHazardReceivesImmediateCriticalPriority() {
        Issue issue = new Issue();
        issue.setTitle("Sparking switchboard in lab");
        issue.setDescription("There is a short circuit and fire sparks coming out of the power outlet.");
        issue.setCategory("electrical");

        Priority priority = service.evaluatePriority(issue);
        assertEquals(Priority.CRITICAL, priority, "Life-safety electrical hazard must immediately become CRITICAL");
    }

    @Test
    void testLowImpactAcademicComplaintDefaultsToLow() {
        Issue issue = new Issue();
        issue.setTitle("Syllabus query");
        issue.setDescription("Need clarification on chapter 3 syllabus.");
        issue.setCategory("academics");
        issue.setSeverity("LOW");

        Priority priority = service.evaluatePriority(issue);
        assertEquals(Priority.LOW, priority);
    }

    @Test
    void testClientCannotArbitrarilyEscalateLowImpactComplaintToCritical() {
        Issue issue = new Issue();
        issue.setTitle("Slightly dim light");
        issue.setDescription("Light bulb is slightly flickering in corridor.");
        issue.setCategory("hostel");
        issue.setSeverity("LOW");
        issue.setPriority("CRITICAL"); // Client attempt to manipulate

        Priority priority = service.evaluatePriority(issue);
        assertNotEquals(Priority.CRITICAL, priority, "Arbitrary manipulation without hazards must be rejected");
    }

    @Test
    void testUrgencyKeywordsElevatePriority() {
        Issue issue = new Issue();
        issue.setTitle("Severe water leakage in washroom");
        issue.setDescription("Pipe burst and flood is happening right now!");
        issue.setCategory("plumbing");

        Priority priority = service.evaluatePriority(issue);
        assertTrue(priority == Priority.HIGH || priority == Priority.CRITICAL,
                "Flooding and burst pipe must be elevated to HIGH or CRITICAL");
    }

    @Test
    void testDifferentCategoriesProduceDistinctBaselinePriorities() {
        Issue security = new Issue();
        security.setCategory("security");
        assertEquals(Priority.HIGH, service.evaluatePriority(security), "Security must baseline at HIGH");

        Issue electrical = new Issue();
        electrical.setCategory("electrical");
        assertEquals(Priority.HIGH, service.evaluatePriority(electrical), "Electrical must baseline at HIGH");

        Issue plumbing = new Issue();
        plumbing.setCategory("plumbing");
        assertEquals(Priority.MEDIUM, service.evaluatePriority(plumbing), "Plumbing must baseline at MEDIUM");

        Issue sanitation = new Issue();
        sanitation.setCategory("sanitation");
        assertEquals(Priority.LOW, service.evaluatePriority(sanitation), "Sanitation must baseline at LOW");
    }

    @Test
    void testSeverityElevatesAndReducesPriority() {
        // Plumbing baseline is MEDIUM. With SEVERE severity, it should elevate to HIGH.
        Issue severePlumbing = new Issue();
        severePlumbing.setCategory("plumbing");
        severePlumbing.setSeverity("SEVERE");
        assertEquals(Priority.HIGH, service.evaluatePriority(severePlumbing), "Severe plumbing must elevate to HIGH");

        // Hostel baseline is MEDIUM. With LOW severity, it should reduce to LOW.
        Issue minorHostel = new Issue();
        minorHostel.setCategory("hostel");
        minorHostel.setSeverity("LOW");
        assertEquals(Priority.LOW, service.evaluatePriority(minorHostel), "Minor hostel issue must reduce to LOW");
    }
}

