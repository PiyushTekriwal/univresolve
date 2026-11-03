package com.kiit.issue.repository;

import com.kiit.issue.model.Issue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface IssueRepository extends JpaRepository<Issue, Long> {

    List<Issue> findByUserId(Long userId);

    List<Issue> findByStatus(String status);

    List<Issue> findByStatusIn(Collection<String> statuses);

    List<Issue> findByAssignmentStatus(String assignmentStatus);

    List<Issue> findByEffectivePriority(String effectivePriority);

    List<Issue> findBySlaStatus(String slaStatus);
}
