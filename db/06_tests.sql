-- T01 CHECK: an invalid role is rejected
INSERT INTO users (email, password_hash, full_name, role)
VALUES ('x@example.com', 'hash', 'Test User', 'superuser');
-- T02 UNIQUE: two accounts cannot share an email
INSERT INTO users (email, password_hash, full_name)
VALUES ('aarav.sharma@example.com', 'hash', 'Duplicate Aarav');
-- T03 CHECK: salary_max must not be below salary_min
INSERT INTO job_postings (company_id, title, salary_min, salary_max)
VALUES (1, 'Bad Salary Job', 900000, 500000);
-- T04 CHECK: proficiency must be one of the four levels
INSERT INTO resume_skills (resume_id, skill_id, proficiency) VALUES (2, 3, 'guru');
-- T05 FOREIGN KEY: a resume must belong to an existing user
INSERT INTO resumes (user_id, file_name, file_path) VALUES (999, 'ghost.pdf', '/uploads/999/ghost.pdf');
-- T06 UNIQUE (user_id, job_id): a student cannot apply twice to the same job
INSERT INTO applications (user_id, job_id) VALUES (2, 1);
-- T07 TRIGGER: applying to a closed job is blocked
BEGIN;
UPDATE job_postings SET status = 'closed' WHERE job_id = 6;
INSERT INTO applications (user_id, job_id) VALUES (4, 6);
ROLLBACK;
-- T08 TRIGGER: an admin account cannot get a student profile
INSERT INTO student_profiles (user_id, location) VALUES (1, 'Bengaluru');
-- T09 TRANSACTION: a failed skill insert rolls back the whole resume upload
SELECT COUNT(*) AS resumes_before FROM resumes;
BEGIN;
INSERT INTO resumes (user_id, file_name, file_path) VALUES (4, 'rohan_v2.pdf', '/uploads/4/rohan_v2.pdf');
INSERT INTO resume_skills (resume_id, skill_id) VALUES (currval('resumes_resume_id_seq'), 999);
ROLLBACK;
SELECT COUNT(*) AS resumes_after FROM resumes;
-- T10 ON DELETE CASCADE: deleting a user removes their resumes and analyses (rolled back)
BEGIN;
SELECT (SELECT COUNT(*) FROM resumes WHERE user_id = 4) AS resumes,
       (SELECT COUNT(*) FROM skill_gap_analysis sga JOIN resumes r USING (resume_id)
        WHERE r.user_id = 4) AS analyses;
DELETE FROM users WHERE user_id = 4;
SELECT (SELECT COUNT(*) FROM resumes WHERE user_id = 4) AS resumes,
       (SELECT COUNT(*) FROM skill_gap_analysis sga JOIN resumes r USING (resume_id)
        WHERE r.user_id = 4) AS analyses;
ROLLBACK;
-- T11 SECURITY: passwords are stored only as bcrypt hashes
SELECT email, left(password_hash, 7) AS hash_prefix, length(password_hash) AS hash_length
FROM users ORDER BY user_id LIMIT 3;
