package com.kiit.resolve.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.kiit.resolve.model.Issue;
import java.util.List;

public interface IssueRepository extends JpaRepository<Issue, Long> {

    // ✅ USER ISSUES
    List<Issue> findByUserId(Long userId);

    // 🔥 REQUIRED FOR DASHBOARD & HISTORY
    List<Issue> findByStatus(String status);

    // 🔥 OPTIONAL (future powerful filtering)
    List<Issue> findByUserIdAndStatus(Long userId, String status);
}