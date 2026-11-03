package com.kiit.issue.scheduler;

import com.kiit.issue.model.Issue;
import com.kiit.issue.repository.IssueRepository;
import com.kiit.issue.service.SlaIntegrationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class SlaScheduler {

    private final IssueRepository issueRepository;
    private final SlaIntegrationService slaIntegrationService;

    /**
     * Periodic SLA & Aging Monitor — runs every 60 seconds.
     * fixedDelay ensures previous execution completes before next starts,
     * preventing concurrent overlapping execution.
     */
    @Scheduled(fixedDelay = 60000)
    public void monitorAndRecalculateSla() {
        try {
            List<Issue> activeIssues = issueRepository.findByStatusIn(List.of("open", "in_progress"));
            if (activeIssues.isEmpty()) {
                log.debug("[SLA Scheduler] No active complaints to update.");
                return;
            }

            List<Issue> resolvedHistory = issueRepository.findByStatus("resolved");

            log.info("[SLA Scheduler] Recalculating SLA and aging for {} active complaint(s)...", activeIssues.size());
            slaIntegrationService.recalculateActiveIssues(activeIssues, resolvedHistory);

            issueRepository.saveAll(activeIssues);

            long breachedCount = activeIssues.stream()
                    .filter(i -> "BREACHED".equalsIgnoreCase(i.getSlaStatus()))
                    .count();
            long warningCount = activeIssues.stream()
                    .filter(i -> "WARNING".equalsIgnoreCase(i.getSlaStatus()))
                    .count();
            long escalatedCount = activeIssues.stream()
                    .filter(i -> i.getEffectivePriority() != null && !i.getEffectivePriority().equalsIgnoreCase(i.getOriginalPriority()))
                    .count();

            log.info("[SLA Scheduler] Update complete. Breached: {}, Warning: {}, Escalated: {}",
                    breachedCount, warningCount, escalatedCount);

        } catch (Exception e) {
            log.error("[SLA Scheduler] Error during background SLA update: {}", e.getMessage(), e);
        }
    }
}

