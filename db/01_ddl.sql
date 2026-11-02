-- Run from psql as a superuser:  psql -U postgres
DROP DATABASE IF EXISTS job_skill_analyzer;
CREATE DATABASE job_skill_analyzer;
\c job_skill_analyzer
-- pgvector adds the VECTOR data type, distance operators and HNSW indexes
CREATE EXTENSION IF NOT EXISTS vector;
-- 1. USERS  (authentication + role: student / admin)
CREATE TABLE users (
    user_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,          -- bcrypt hash, never plaintext
    full_name      VARCHAR(120) NOT NULL,
    role           VARCHAR(20)  NOT NULL DEFAULT 'student',
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_users_role CHECK (role IN ('student','admin'))
);
-- 2. STUDENT_PROFILES  (1:1 extension of a student user)
CREATE TABLE student_profiles (
    profile_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           INT NOT NULL UNIQUE,          -- UNIQUE enforces 1:1
    phone             VARCHAR(20),
    location          VARCHAR(120),
    education_level   VARCHAR(50),
    years_experience  NUMERIC(4,1) NOT NULL DEFAULT 0,
    linkedin_url      VARCHAR(255),
    CONSTRAINT fk_profile_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_profile_experience CHECK (years_experience >= 0)
);
-- 3. COMPANIES  (organisations that post jobs)
CREATE TABLE companies (
    company_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    industry    VARCHAR(100),
    website     VARCHAR(255),
    location    VARCHAR(120),
    CONSTRAINT uq_company UNIQUE (name, location)
);
-- 4. SKILLS  (master catalogue of skills)
CREATE TABLE skills (
    skill_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    skill_name  VARCHAR(100) NOT NULL UNIQUE,
    category    VARCHAR(60)                         -- Language, Framework, Tool ...
);
-- 5. JOB_POSTINGS  (description_embedding = 384-d sentence embedding)
CREATE TABLE job_postings (
    job_id                 INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id             INT          NOT NULL,
    title                  VARCHAR(150) NOT NULL,
    description            TEXT,
    employment_type        VARCHAR(30)  NOT NULL DEFAULT 'Full-time',
    location               VARCHAR(120),
    min_experience         NUMERIC(4,1) NOT NULL DEFAULT 0,
    salary_min             NUMERIC(12,2),
    salary_max             NUMERIC(12,2),
    status                 VARCHAR(20)  NOT NULL DEFAULT 'open',
    posted_date            DATE         NOT NULL DEFAULT CURRENT_DATE,
    description_embedding  vector(384),
    CONSTRAINT fk_job_company FOREIGN KEY (company_id)
        REFERENCES companies(company_id) ON DELETE CASCADE,
    CONSTRAINT chk_job_status  CHECK (status IN ('open','closed','draft')),
    CONSTRAINT chk_job_emptype CHECK (employment_type IN
               ('Full-time','Part-time','Internship','Contract')),
    CONSTRAINT chk_job_salary  CHECK (salary_max IS NULL OR salary_min IS NULL
                                      OR salary_max >= salary_min)
);
-- 6. RESUMES  (resume_embedding = 384-d embedding of parsed_text)
CREATE TABLE resumes (
    resume_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           INT          NOT NULL,
    file_name         VARCHAR(255) NOT NULL,
    file_path         VARCHAR(500) NOT NULL,
    parsed_text       TEXT,
    resume_embedding  vector(384),
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    uploaded_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_resume_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE
);
-- 7. RESUME_SKILLS  (M:N  resumes <-> skills)
CREATE TABLE resume_skills (
    resume_id    INT          NOT NULL,
    skill_id     INT          NOT NULL,
    proficiency  VARCHAR(20)  NOT NULL DEFAULT 'intermediate',
    years_used   NUMERIC(4,1) NOT NULL DEFAULT 0,
    PRIMARY KEY (resume_id, skill_id),                -- composite PK
    CONSTRAINT fk_rs_resume FOREIGN KEY (resume_id)
        REFERENCES resumes(resume_id) ON DELETE CASCADE,
    CONSTRAINT fk_rs_skill  FOREIGN KEY (skill_id)
        REFERENCES skills(skill_id)   ON DELETE CASCADE,
    CONSTRAINT chk_rs_prof  CHECK (proficiency IN
               ('beginner','intermediate','advanced','expert')),
    CONSTRAINT chk_rs_years CHECK (years_used >= 0)
);
-- 8. JOB_SKILLS  (M:N  job_postings <-> skills)
CREATE TABLE job_skills (
    job_id           INT         NOT NULL,
    skill_id         INT         NOT NULL,
    importance       VARCHAR(20) NOT NULL DEFAULT 'required',
    min_proficiency  VARCHAR(20) NOT NULL DEFAULT 'intermediate',
    PRIMARY KEY (job_id, skill_id),                   -- composite PK
    CONSTRAINT fk_js_job   FOREIGN KEY (job_id)
        REFERENCES job_postings(job_id) ON DELETE CASCADE,
    CONSTRAINT fk_js_skill FOREIGN KEY (skill_id)
        REFERENCES skills(skill_id)     ON DELETE CASCADE,
    CONSTRAINT chk_js_importance CHECK (importance IN ('required','preferred')),
    CONSTRAINT chk_js_minprof    CHECK (min_proficiency IN
               ('beginner','intermediate','advanced','expert'))
);
-- 9. SKILL_GAP_ANALYSIS  (one result per resume x job)
CREATE TABLE skill_gap_analysis (
    analysis_id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    resume_id             INT          NOT NULL,
    job_id                INT          NOT NULL,
    match_score           NUMERIC(5,2) NOT NULL DEFAULT 0,   -- 0..100 %
    matched_skills_count  INT          NOT NULL DEFAULT 0,
    missing_skills_count  INT          NOT NULL DEFAULT 0,
    analyzed_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sga_resume FOREIGN KEY (resume_id)
        REFERENCES resumes(resume_id)    ON DELETE CASCADE,
    CONSTRAINT fk_sga_job    FOREIGN KEY (job_id)
        REFERENCES job_postings(job_id)  ON DELETE CASCADE,
    CONSTRAINT uq_sga_resume_job UNIQUE (resume_id, job_id),
    CONSTRAINT chk_sga_score CHECK (match_score BETWEEN 0 AND 100)
);
-- 10. SKILL_RECOMMENDATIONS  (skills to learn, produced by an analysis)
CREATE TABLE skill_recommendations (
    recommendation_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    analysis_id        INT NOT NULL,
    skill_id           INT NOT NULL,
    priority           INT NOT NULL DEFAULT 1,             -- 1 = highest
    reason             VARCHAR(255),
    CONSTRAINT fk_sr_analysis FOREIGN KEY (analysis_id)
        REFERENCES skill_gap_analysis(analysis_id) ON DELETE CASCADE,
    CONSTRAINT fk_sr_skill    FOREIGN KEY (skill_id)
        REFERENCES skills(skill_id)                ON DELETE CASCADE,
    CONSTRAINT uq_sr_analysis_skill UNIQUE (analysis_id, skill_id),
    CONSTRAINT chk_sr_priority CHECK (priority >= 1)
);
-- 11. APPLICATIONS  (jobs a student has applied to)
CREATE TABLE applications (
    application_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         INT         NOT NULL,
    job_id          INT         NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'applied',
    applied_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
    last_updated    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes           TEXT,
    CONSTRAINT fk_app_user FOREIGN KEY (user_id)
        REFERENCES users(user_id)       ON DELETE CASCADE,
    CONSTRAINT fk_app_job  FOREIGN KEY (job_id)
        REFERENCES job_postings(job_id) ON DELETE CASCADE,
    CONSTRAINT uq_app_user_job UNIQUE (user_id, job_id),
    CONSTRAINT chk_app_status CHECK (status IN ('applied','under_review',
               'interviewing','offer','rejected','accepted','withdrawn'))
);
-- B-tree indexes on frequently filtered / joined foreign-key columns
CREATE INDEX idx_jobs_company ON job_postings(company_id);
CREATE INDEX idx_jobs_status  ON job_postings(status);
CREATE INDEX idx_resumes_user ON resumes(user_id);
CREATE INDEX idx_apps_job     ON applications(job_id);
CREATE INDEX idx_apps_status  ON applications(status);
CREATE INDEX idx_sga_job      ON skill_gap_analysis(job_id);
CREATE INDEX idx_recs_skill   ON skill_recommendations(skill_id);
-- GIN full-text index for keyword search on job title + description
CREATE INDEX ftx_jobs_text ON job_postings
    USING GIN (to_tsvector('english', title || ' ' || coalesce(description,'')));
-- pgvector HNSW indexes for fast approximate cosine-similarity search
CREATE INDEX hnsw_jobs_embedding ON job_postings
    USING hnsw (description_embedding vector_cosine_ops);
CREATE INDEX hnsw_resumes_embedding ON resumes
    USING hnsw (resume_embedding vector_cosine_ops);
-- ALTER demonstrations (schema evolution)
ALTER TABLE users        ADD COLUMN last_login TIMESTAMP NULL;
ALTER TABLE job_postings ADD COLUMN remote_allowed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE applications ALTER COLUMN status SET DEFAULT 'applied';
ALTER TABLE skills       ADD CONSTRAINT chk_skill_name_len
                         CHECK (char_length(skill_name) >= 1);
-- DROP demonstration (temporary staging table used during bulk upload)
CREATE TABLE resume_upload_staging (
    staging_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    raw_text    TEXT
);
DROP TABLE IF EXISTS resume_upload_staging;
-- VIEW 1: analytics - most commonly missing skills (active resumes only)
CREATE OR REPLACE VIEW v_top_missing_skills AS
SELECT s.skill_id, s.skill_name, s.category, COUNT(*) AS times_missing
FROM   skill_recommendations sr
JOIN   skill_gap_analysis sga ON sga.analysis_id = sr.analysis_id
JOIN   resumes r ON r.resume_id = sga.resume_id AND r.is_active
JOIN   skills s ON s.skill_id = sr.skill_id
GROUP  BY s.skill_id, s.skill_name, s.category
ORDER  BY times_missing DESC, s.skill_name;

-- VIEW 2: job recommendations per resume (best matches first)
CREATE OR REPLACE VIEW v_job_recommendations AS
SELECT sga.resume_id, r.user_id, j.job_id, j.title, c.name AS company,
       sga.match_score, sga.missing_skills_count
FROM   skill_gap_analysis sga
JOIN   resumes      r ON r.resume_id  = sga.resume_id
JOIN   job_postings j ON j.job_id     = sga.job_id
JOIN   companies    c ON c.company_id = j.company_id
WHERE  j.status = 'open' AND r.is_active
ORDER  BY sga.resume_id, sga.match_score DESC;
\dt
