package com.kiit.resolve.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalyticsSummaryDto {
    private long totalComplaints;
    private long openComplaints;
    private long resolvedComplaints;

    // Priority breakdown
    private Map<String, Long> priorityDistribution;

    // SLA breakdown
    private Map<String, Long> slaStatusDistribution;

    // Category breakdown
    private Map<String, Long> categoryDistribution;

    // Aging backlog bands: "< 12h", "12-24h", "24-48h", "> 48h"
    private Map<String, Long> agingBacklog;

    // Resolution time metrics (hours)
    private Double averageResolutionHours;
    private Double medianResolutionHours;
    private boolean basedOnRealHistoricalData;
}

