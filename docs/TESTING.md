# Testing

All tests were run on the seeded demo database (`npm run db:init`).

## Database tests (`db/06_tests.sql`)

Run with: `psql "$DATABASE_URL" -f db/06_tests.sql`. Every test that changes data runs inside a transaction that is rolled back, so the demo data stays the same.

| ID | Test | Expected | Actual result | Status |
| --- | --- | --- | --- | --- |
| T01 | Insert user with role 'superuser' | Rejected by CHECK chk_users_role | new row for relation "users" violates check constraint "chk_users_role" | Pass |
| T02 | Insert second account with an existing email | Rejected by UNIQUE users_email_key | duplicate key value violates unique constraint "users_email_key" | Pass |
| T03 | Job with salary_max < salary_min | Rejected by CHECK chk_job_salary | new row for relation "job_postings" violates check constraint "chk_job_salary" | Pass |
| T04 | Resume skill with proficiency 'guru' | Rejected by CHECK chk_rs_prof | new row for relation "resume_skills" violates check constraint "chk_rs_prof" | Pass |
| T05 | Resume for non-existent user 999 | Rejected by FOREIGN KEY fk_resume_user | insert or update on table "resumes" violates foreign key constraint "fk_resume_user" | Pass |
| T06 | Second application by the same student to the same job | Rejected by UNIQUE uq_app_user_job | duplicate key value violates unique constraint "uq_app_user_job" | Pass |
| T07 | Apply to a closed job | Rejected by trigger trg_applications_job_open | Cannot apply: job 6 is closed | Pass |
| T08 | Student profile for the admin account | Rejected by trigger trg_profiles_student_only | User 1 is not a student | Pass |
| T09 | Resume insert followed by an invalid skill, in one transaction | Whole transaction rolled back; resume count unchanged | ERROR on skill insert, ROLLBACK; resumes 6 before and 6 after | Pass |
| T10 | Delete a user (inside a rolled-back transaction) | Resumes and analyses removed by ON DELETE CASCADE | Before: 1 resume, 7 analyses; after DELETE: 0 and 0; rolled back | Pass |
| T11 | Inspect stored passwords | Only 60-character bcrypt hashes ($2a$10$...) | All hashes start with $2a$10$, length 60 | Pass |

## Application tests (Next.js, automated with Playwright)

| ID | Test | Expected | Actual result | Status |
| --- | --- | --- | --- | --- |
| A01 | Login with wrong password | Rejected with "Incorrect email or password." | Incorrect email or password. | Pass |
| A02 | Login as student with correct password | Redirect to /dashboard | Landed on /dashboard | Pass |
| A03 | Student opens /admin/analytics | Blocked, redirected to /dashboard | Landed on /dashboard | Pass |
| A04 | Edit session cookie to user 1 (admin) | Signature invalid, sent to sign-in page | Landed on / | Pass |
| A05 | Semantic search: "web backend developer who writes Python APIs" | Backend Developer ranked first | First result: Backend Developer (similarity 0.639) | Pass |
| A06 | Semantic search filtered to Internship | Only internships returned | 2 results, types: Internship | Pass |
| A07 | Upload a .txt file as resume | HTTP 400 "Please choose a PDF file" | HTTP 400 "Please choose a PDF file" | Pass |
| A08 | Apply to Data Analyst Intern | Application stored, status "applied" | Applied on 17/11/2026 – status applied | Pass |
| A09 | Upload sample-resume.pdf as Sneha | 8 skills found; Java Developer match 67% -> 100% | 8 skills found; Java Developer now 100% | Pass |

## Admin job management tests (automated with Playwright)

| ID | Test | Expected | Actual result | Status |
| --- | --- | --- | --- | --- |
| B01 | Create a job with no skills selected | Rejected: "Pick at least one required skill." | Pick at least one required skill. | Pass |
| B02 | Create a job with salary max below min | Rejected by CHECK chk_job_salary, nothing saved | Not saved: new row for relation "job_postings" violates check constraint "chk_job_salary" (jobs 8 -> 8) | Pass |
| B03 | Create "Data Engineer" with 4 skills | Saved in one transaction, embedded, scored for every active resume | Job #10: 4 skills, embedded=true, avg match 53.6; 4 analyses for 4 active resumes | Pass |
| B04 | Student (Aarav) opens Jobs | New job listed with his match score | Data Engineer shown with 86% | Pass |
| B05 | Student opens /admin/jobs | Redirected to /dashboard | Landed on /dashboard | Pass |
| B06 | Clear the job's analyses, close it, then reopen it | Trigger trg_jobs_reopened recomputes all skill gaps | analyses after close: 0, after reopen: 4 | Pass |
| B07 | Add a company that already exists | Rejected by UNIQUE (name, location) | That company already exists in this location. | Pass |
| B08 | Delete the job | Job, its skills and analyses removed (CASCADE) | Remaining: 0 job, 0 skills, 0 analyses | Pass |

**Result:** 11 of 11 database tests, 9 of 9 application tests and 8 of 8 admin tests passed.
