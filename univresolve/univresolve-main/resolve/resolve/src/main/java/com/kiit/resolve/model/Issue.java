package com.kiit.resolve.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "issues")
public class Issue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String category;

    private String status = "open";

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "priority")
    private String priority = "MEDIUM";

    @Column(name = "severity")
    private String severity = "STANDARD";

    @Column(name = "sla_deadline")
    private LocalDateTime slaDeadline;

    @Column(name = "estimated_resolution_time")
    private LocalDateTime estimatedResolutionTime;

    @Column(name = "sla_status")
    private String slaStatus = "ON_TRACK";

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // Transient runtime fields for anti-starvation scheduling and explainability
    @Transient
    private Double effectiveScore;

    @Transient
    private String estimateExplanation;

    @Transient
    private Long remainingHours;

    @Transient
    private Long overdueHours;

    @Transient
    private Boolean isOverdue;

    @Transient
    private String remainingTimeFormatted;

    @Transient
    private Long waitingHours;

    public Issue() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(LocalDateTime resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public LocalDateTime getSlaDeadline() {
        return slaDeadline;
    }

    public void setSlaDeadline(LocalDateTime slaDeadline) {
        this.slaDeadline = slaDeadline;
    }

    public LocalDateTime getEstimatedResolutionTime() {
        return estimatedResolutionTime;
    }

    public void setEstimatedResolutionTime(LocalDateTime estimatedResolutionTime) {
        this.estimatedResolutionTime = estimatedResolutionTime;
    }

    public String getSlaStatus() {
        return slaStatus;
    }

    public void setSlaStatus(String slaStatus) {
        this.slaStatus = slaStatus;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Double getEffectiveScore() {
        return effectiveScore;
    }

    public void setEffectiveScore(Double effectiveScore) {
        this.effectiveScore = effectiveScore;
    }

    public String getEstimateExplanation() {
        return estimateExplanation;
    }

    public void setEstimateExplanation(String estimateExplanation) {
        this.estimateExplanation = estimateExplanation;
    }

    public Long getRemainingHours() {
        return remainingHours;
    }

    public void setRemainingHours(Long remainingHours) {
        this.remainingHours = remainingHours;
    }

    public Long getOverdueHours() {
        return overdueHours;
    }

    public void setOverdueHours(Long overdueHours) {
        this.overdueHours = overdueHours;
    }

    public Boolean getIsOverdue() {
        return isOverdue;
    }

    public void setIsOverdue(Boolean isOverdue) {
        this.isOverdue = isOverdue;
    }

    public String getRemainingTimeFormatted() {
        return remainingTimeFormatted;
    }

    public void setRemainingTimeFormatted(String remainingTimeFormatted) {
        this.remainingTimeFormatted = remainingTimeFormatted;
    }

    public Long getWaitingHours() {
        return waitingHours;
    }

    public void setWaitingHours(Long waitingHours) {
        this.waitingHours = waitingHours;
    }
}
