package com.kiit.resolve.controller;

import com.kiit.resolve.dto.AnalyticsSummaryDto;
import com.kiit.resolve.model.Issue;
import com.kiit.resolve.model.Priority;
import com.kiit.resolve.model.SlaStatus;
import com.kiit.resolve.model.User;
import com.kiit.resolve.repository.IssueRepository;
import com.kiit.resolve.repository.UserRepository;
import com.kiit.resolve.service.ComplaintPriorityService;
import com.kiit.resolve.service.ComplaintSchedulingService;
import com.kiit.resolve.service.ResolutionTimeEstimationService;
import com.kiit.resolve.service.SlaPolicyService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/issues")
@RequiredArgsConstructor
@CrossOrigin // 🔥 IMPORTANT for frontend calls
public class IssueController {

    private final IssueRepository issueRepository;
    private final UserRepository userRepository;
    private final ComplaintPriorityService priorityService;
    private final SlaPolicyService slaPolicyService;
    private final ComplaintSchedulingService schedulingService;
    private final ResolutionTimeEstimationService estimationService;

    // ✅ CREATE ISSUE with intelligent priority, SLA, and estimated resolution time
    @PostMapping
    public Issue createIssue(@RequestBody Issue issue) {

        Long userId = issue.getUser().getId();

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        issue.setUser(user);
        issue.setStatus("open");
        if (issue.getCreatedAt() == null) {
            issue.setCreatedAt(LocalDateTime.now());
        }

        // 1. Intelligent priority evaluation (prevents arbitrary client manipulation)
        Priority priority = priorityService.evaluatePriority(issue);
        issue.setPriority(priority.name());

        if (issue.getSeverity() == null || issue.getSeverity().isBlank()) {
            issue.setSeverity("STANDARD");
        }

        // 2. SLA deadline assignment
        LocalDateTime slaDeadline = slaPolicyService.calculateSlaDeadline(
                issue.getCreatedAt(),
                issue.getCategory(),
                priority
        );
        issue.setSlaDeadline(slaDeadline);
        issue.setSlaStatus(SlaStatus.ON_TRACK.name());

        // 3. Estimated resolution time
        ResolutionTimeEstimationService.EstimationResult est = estimationService.estimate(issue, issue.getCreatedAt());
        issue.setEstimatedResolutionTime(est.estimatedCompletionTime());

        Issue saved = issueRepository.save(issue);
        return schedulingService.enrich(saved, LocalDateTime.now());
    }

    // ✅ GET SINGLE ISSUE (enriched with live runtime metrics)
    @GetMapping("/{id}")
    public Issue getIssueById(@PathVariable Long id) {
        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Issue not found"));
        return schedulingService.enrich(issue, LocalDateTime.now());
    }

    // ✅ USER ISSUES (enriched with live priority, SLA status, and remaining time)
    @GetMapping("/user/{userId}")
    public List<Issue> getIssuesByUser(@PathVariable Long userId) {
        List<Issue> issues = issueRepository.findByUserId(userId);
        LocalDateTime now = LocalDateTime.now();
        return issues.stream()
                .map(i -> schedulingService.enrich(i, now))
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .collect(Collectors.toList());
    }

    // 🔥 ADMIN: GET ALL ISSUES (ranked queue for open issues + enriched resolved issues)
    @GetMapping("/admin")
    public List<Issue> getAllIssues() {
        List<Issue> all = issueRepository.findAll();
        LocalDateTime now = LocalDateTime.now();

        List<Issue> open = all.stream()
                .filter(i -> "open".equalsIgnoreCase(i.getStatus()))
                .collect(Collectors.toList());

        List<Issue> nonOpen = all.stream()
                .filter(i -> !"open".equalsIgnoreCase(i.getStatus()))
                .map(i -> schedulingService.enrich(i, now))
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .collect(Collectors.toList());

        List<Issue> rankedOpen = schedulingService.rankQueue(open, now);

        List<Issue> combined = new ArrayList<>(rankedOpen);
        combined.addAll(nonOpen);
        return combined;
    }

    // 🔥 DASHBOARD: ONLY OPEN (strictly ordered by anti-starvation effective score)
    @GetMapping("/dashboard")
    public List<Issue> getOpenIssues() {
        List<Issue> open = issueRepository.findByStatus("open");
        return schedulingService.rankQueue(open, LocalDateTime.now());
    }

    // 🔥 HISTORY: ONLY RESOLVED
    @GetMapping("/history")
    public List<Issue> getResolvedIssues() {
        List<Issue> resolved = issueRepository.findByStatus("resolved");
        LocalDateTime now = LocalDateTime.now();
        return resolved.stream()
                .map(i -> schedulingService.enrich(i, now))
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .collect(Collectors.toList());
    }

    // 🔥 MARK AS RESOLVED (records resolved_at timestamp for historical learning)
    @DeleteMapping("/{id}")
    public Map<String, String> resolveIssue(@PathVariable Long id) {

        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        issue.setStatus("resolved");
        issue.setResolvedAt(LocalDateTime.now());
        issueRepository.save(issue);

        return Map.of("message", "Issue marked as resolved");
    }

    // 📊 LIVE ANALYTICS (real data, no synthetic fabrications)
    @GetMapping("/analytics")
    public AnalyticsSummaryDto getAnalytics() {
        List<Issue> all = issueRepository.findAll();
        LocalDateTime now = LocalDateTime.now();

        long total = all.size();
        long openCount = all.stream().filter(i -> "open".equalsIgnoreCase(i.getStatus())).count();
        long resolvedCount = all.stream().filter(i -> "resolved".equalsIgnoreCase(i.getStatus())).count();

        Map<String, Long> priorityDist = new HashMap<>();
        Map<String, Long> slaDist = new HashMap<>();
        Map<String, Long> categoryDist = new HashMap<>();
        Map<String, Long> agingBacklog = new LinkedHashMap<>();
        agingBacklog.put("< 12h", 0L);
        agingBacklog.put("12-24h", 0L);
        agingBacklog.put("24-48h", 0L);
        agingBacklog.put("> 48h", 0L);

        List<Double> resolvedDurations = new ArrayList<>();

        for (Issue rawIssue : all) {
            Issue issue = schedulingService.enrich(rawIssue, now);
            // Priority
            String p = issue.getPriority() != null ? issue.getPriority().toUpperCase() : "MEDIUM";
            priorityDist.put(p, priorityDist.getOrDefault(p, 0L) + 1);

            // Category
            String cat = issue.getCategory() != null ? issue.getCategory().toLowerCase() : "other";
            categoryDist.put(cat, categoryDist.getOrDefault(cat, 0L) + 1);

            if ("open".equalsIgnoreCase(issue.getStatus())) {
                // Live SLA
                SlaStatus sla = slaPolicyService.evaluateSlaStatus(issue, now);
                slaDist.put(sla.name(), slaDist.getOrDefault(sla.name(), 0L) + 1);

                // Aging backlog
                long hoursWaiting = issue.getCreatedAt() != null
                        ? Math.max(0, Duration.between(issue.getCreatedAt(), now).toHours())
                        : 0;
                if (hoursWaiting < 12) {
                    agingBacklog.put("< 12h", agingBacklog.get("< 12h") + 1);
                } else if (hoursWaiting < 24) {
                    agingBacklog.put("12-24h", agingBacklog.get("12-24h") + 1);
                } else if (hoursWaiting < 48) {
                    agingBacklog.put("24-48h", agingBacklog.get("24-48h") + 1);
                } else {
                    agingBacklog.put("> 48h", agingBacklog.get("> 48h") + 1);
                }
            } else if ("resolved".equalsIgnoreCase(issue.getStatus())) {
                if (issue.getCreatedAt() != null && issue.getResolvedAt() != null) {
                    long minutes = Duration.between(issue.getCreatedAt(), issue.getResolvedAt()).toMinutes();
                    if (minutes > 0) {
                        resolvedDurations.add(minutes / 60.0);
                    }
                }
            }
        }

        Double avgHours = null;
        Double medianHours = null;
        boolean hasRealData = false;

        if (!resolvedDurations.isEmpty()) {
            hasRealData = true;
            avgHours = Math.round(resolvedDurations.stream().mapToDouble(Double::doubleValue).average().orElse(0.0) * 10.0) / 10.0;
            Collections.sort(resolvedDurations);
            int mid = resolvedDurations.size() / 2;
            medianHours = resolvedDurations.size() % 2 == 1
                    ? resolvedDurations.get(mid)
                    : (resolvedDurations.get(mid - 1) + resolvedDurations.get(mid)) / 2.0;
            medianHours = Math.round(medianHours * 10.0) / 10.0;
        }

        return AnalyticsSummaryDto.builder()
                .totalComplaints(total)
                .openComplaints(openCount)
                .resolvedComplaints(resolvedCount)
                .priorityDistribution(priorityDist)
                .slaStatusDistribution(slaDist)
                .categoryDistribution(categoryDist)
                .agingBacklog(agingBacklog)
                .averageResolutionHours(avgHours)
                .medianResolutionHours(medianHours)
                .basedOnRealHistoricalData(hasRealData)
                .build();
    }
}