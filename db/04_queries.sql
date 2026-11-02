-- (a) Analytics: most commonly missing skills across all analyses
SELECT s.skill_name, s.category, COUNT(*) AS times_missing,
       COUNT(DISTINCT sga.resume_id) AS students_affected
FROM   skill_recommendations sr
JOIN   skill_gap_analysis sga ON sga.analysis_id = sr.analysis_id
JOIN   skills s               ON s.skill_id      = sr.skill_id
GROUP  BY s.skill_name, s.category
HAVING COUNT(*) >= 5
ORDER  BY times_missing DESC, s.skill_name;
-- (b) Average / best match score and number of open jobs per company
SELECT c.name AS company,
       COUNT(DISTINCT j.job_id)       AS open_jobs,
       ROUND(AVG(sga.match_score), 2) AS avg_match,
       MAX(sga.match_score)           AS best_match
FROM   companies c
JOIN   job_postings j        ON j.company_id = c.company_id AND j.status = 'open'
JOIN   skill_gap_analysis sga ON sga.job_id  = j.job_id
GROUP  BY c.name
ORDER  BY avg_match DESC;
-- (c) Application pipeline summary
SELECT status, COUNT(*) AS applications
FROM   applications
GROUP  BY status
ORDER  BY applications DESC, status;
-- Rohan's Frontend Developer application moves to interview stage
SELECT application_id, status, last_updated FROM applications WHERE application_id = 5;

UPDATE applications
SET    status = 'interviewing', notes = 'HR call done'
WHERE  application_id = 5;

SELECT application_id, status, last_updated, notes FROM applications WHERE application_id = 5;
-- Sneha completes a Spring Boot course: raise proficiency and re-run analysis
SELECT match_score, missing_skills_count FROM skill_gap_analysis
WHERE  resume_id = 5 AND job_id = 6;

UPDATE resume_skills
SET    proficiency = 'intermediate', years_used = 1
WHERE  resume_id = 5
  AND  skill_id = (SELECT skill_id FROM skills WHERE skill_name = 'Spring Boot');

SELECT fn_compute_skill_gap(5, 6);

SELECT match_score, missing_skills_count FROM skill_gap_analysis
WHERE  resume_id = 5 AND job_id = 6;
-- Remove withdrawn applications from the tracker
SELECT COUNT(*) AS total_before FROM applications;

DELETE FROM applications
WHERE  status = 'withdrawn'
RETURNING application_id, user_id, job_id, status;

SELECT COUNT(*) AS total_after FROM applications;
-- Deleting a closed job cascades to its job_skills rows (ON DELETE CASCADE)
SELECT COUNT(*) AS job_skill_rows FROM job_skills WHERE job_id = 8;

DELETE FROM job_postings WHERE status = 'closed';

SELECT COUNT(*) AS job_skill_rows FROM job_skills WHERE job_id = 8;
-- Best-matching student for every open job: the inner query is
-- re-evaluated for each outer row (correlated on sga.job_id)
SELECT j.title, u.full_name, sga.match_score
FROM   skill_gap_analysis sga
JOIN   job_postings j ON j.job_id    = sga.job_id
JOIN   resumes r      ON r.resume_id = sga.resume_id
JOIN   users u        ON u.user_id   = r.user_id
WHERE  sga.match_score = (SELECT MAX(s2.match_score)
                          FROM   skill_gap_analysis s2
                          WHERE  s2.job_id = sga.job_id)
ORDER  BY sga.match_score DESC, j.title;
-- Students who scored ABOVE the average score of the job they applied to
SELECT u.full_name, j.title, sga.match_score,
       (SELECT ROUND(AVG(s2.match_score), 2)
        FROM   skill_gap_analysis s2
        WHERE  s2.job_id = a.job_id) AS job_avg
FROM   applications a
JOIN   users u        ON u.user_id = a.user_id
JOIN   job_postings j ON j.job_id  = a.job_id
JOIN   resumes r      ON r.user_id = a.user_id AND r.is_active
JOIN   skill_gap_analysis sga ON sga.resume_id = r.resume_id AND sga.job_id = a.job_id
WHERE  sga.match_score > (SELECT AVG(s3.match_score)
                          FROM   skill_gap_analysis s3
                          WHERE  s3.job_id = a.job_id);
-- Skills demanded by open jobs that NO active resume contains
SELECT DISTINCT s.skill_name, s.category
FROM   skills s
WHERE  s.skill_id IN (SELECT js.skill_id
                      FROM   job_skills js
                      WHERE  js.job_id IN (SELECT job_id FROM job_postings
                                           WHERE  status = 'open'))
  AND  s.skill_id NOT IN (SELECT rs.skill_id
                          FROM   resume_skills rs
                          WHERE  rs.resume_id IN (SELECT resume_id FROM resumes
                                                  WHERE  is_active))
ORDER  BY s.skill_name;
-- Open jobs paying more than the average maximum salary of all open jobs
SELECT title, salary_min, salary_max
FROM   job_postings
WHERE  status = 'open'
  AND  salary_max > (SELECT AVG(salary_max) FROM job_postings WHERE status = 'open')
ORDER  BY salary_max DESC;
-- Using the analytics view created in the DDL
SELECT * FROM v_top_missing_skills LIMIT 5;
-- Semantic job recommendation for resume 2 using pgvector (cosine distance)
SELECT * FROM fn_recommend_jobs(2, 3);
-- Trigger 2 test: applying to a non-open job is rejected
UPDATE job_postings SET status = 'draft' WHERE job_id = 7;
INSERT INTO applications (user_id, job_id) VALUES (3, 7);
UPDATE job_postings SET status = 'open' WHERE job_id = 7;
-- Trigger 4 test: an admin cannot be given a student profile
INSERT INTO student_profiles (user_id, location) VALUES (1, 'Bengaluru');
-- Trigger 3 test: Diya uploads a new resume, the old one is deactivated
INSERT INTO resumes (user_id, file_name, file_path)
VALUES (3, 'diya_menon_cv_v2.pdf', '/uploads/3/diya_menon_cv_v2.pdf');
SELECT resume_id, file_name, is_active FROM resumes WHERE user_id = 3;
-- Procedure guard: analysing an inactive resume raises an error
CALL sp_analyze_resume(1);
