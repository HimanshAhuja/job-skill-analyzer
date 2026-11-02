-- Helper: converts a proficiency label into a comparable rank (1..4)
CREATE OR REPLACE FUNCTION fn_prof_rank(p_level VARCHAR)
RETURNS INT
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE p_level WHEN 'beginner'     THEN 1
                        WHEN 'intermediate' THEN 2
                        WHEN 'advanced'     THEN 3
                        WHEN 'expert'       THEN 4
                        ELSE 0 END;
$$;
-- FUNCTION: computes the skill gap of ONE resume against ONE job.
-- Required skills carry weight 2, preferred skills weight 1. A skill is
-- "matched" only if the resume holds it at >= the job's min proficiency.
-- The result is upserted into skill_gap_analysis and every missing skill
-- becomes a row in skill_recommendations. Returns the analysis_id.
CREATE OR REPLACE FUNCTION fn_compute_skill_gap(p_resume_id INT, p_job_id INT)
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    v_total_w    NUMERIC := 0;
    v_match_w    NUMERIC := 0;
    v_matched    INT     := 0;
    v_missing    INT     := 0;
    v_score      NUMERIC(5,2);
    v_analysis   INT;
    rec          RECORD;
BEGIN
    -- 1. compare every skill the job asks for with the resume's skills
    FOR rec IN
        SELECT js.skill_id, js.importance, js.min_proficiency,
               rs.proficiency AS have_prof,
               CASE WHEN js.importance = 'required' THEN 2 ELSE 1 END AS w
        FROM   job_skills js
        LEFT   JOIN resume_skills rs
               ON rs.skill_id = js.skill_id AND rs.resume_id = p_resume_id
        WHERE  js.job_id = p_job_id
    LOOP
        v_total_w := v_total_w + rec.w;
        IF rec.have_prof IS NOT NULL
           AND fn_prof_rank(rec.have_prof) >= fn_prof_rank(rec.min_proficiency) THEN
            v_match_w := v_match_w + rec.w;
            v_matched := v_matched + 1;
        ELSE
            v_missing := v_missing + 1;
        END IF;
    END LOOP;

    v_score := CASE WHEN v_total_w = 0 THEN 0
                    ELSE ROUND(100 * v_match_w / v_total_w, 2) END;

    -- 2. upsert the analysis row (one per resume x job)
    INSERT INTO skill_gap_analysis
           (resume_id, job_id, match_score, matched_skills_count, missing_skills_count)
    VALUES (p_resume_id, p_job_id, v_score, v_matched, v_missing)
    ON CONFLICT (resume_id, job_id) DO UPDATE
       SET match_score          = EXCLUDED.match_score,
           matched_skills_count = EXCLUDED.matched_skills_count,
           missing_skills_count = EXCLUDED.missing_skills_count,
           analyzed_at          = CURRENT_TIMESTAMP
    RETURNING analysis_id INTO v_analysis;

    -- 3. regenerate recommendations for the missing skills
    DELETE FROM skill_recommendations WHERE analysis_id = v_analysis;

    INSERT INTO skill_recommendations (analysis_id, skill_id, priority, reason)
    SELECT v_analysis, js.skill_id,
           CASE WHEN js.importance = 'required' AND rs.skill_id IS NULL THEN 1
                WHEN js.importance = 'required'                         THEN 2
                ELSE 3 END,
           CASE WHEN rs.skill_id IS NULL
                THEN initcap(js.importance) || ' skill not found in resume'
                ELSE 'Improve from ' || rs.proficiency || ' to ' || js.min_proficiency
           END
    FROM   job_skills js
    LEFT   JOIN resume_skills rs
           ON rs.skill_id = js.skill_id AND rs.resume_id = p_resume_id
    WHERE  js.job_id = p_job_id
      AND (rs.skill_id IS NULL
           OR fn_prof_rank(rs.proficiency) < fn_prof_rank(js.min_proficiency));

    RETURN v_analysis;
END;
$$;
-- STORED PROCEDURE: analyses one resume against every OPEN job posting
CREATE OR REPLACE PROCEDURE sp_analyze_resume(p_resume_id INT)
LANGUAGE plpgsql AS $$
DECLARE
    v_job  RECORD;
    v_cnt  INT := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM resumes
                   WHERE resume_id = p_resume_id AND is_active) THEN
        RAISE EXCEPTION 'Resume % does not exist or is not active', p_resume_id;
    END IF;

    FOR v_job IN SELECT job_id FROM job_postings WHERE status = 'open' LOOP
        PERFORM fn_compute_skill_gap(p_resume_id, v_job.job_id);
        v_cnt := v_cnt + 1;
    END LOOP;

    RAISE NOTICE 'Resume % analysed against % open jobs', p_resume_id, v_cnt;
END;
$$;
-- FUNCTION (pgvector): top-k open jobs that are semantically closest to a
-- resume. <=> is pgvector's cosine-distance operator, so similarity = 1 - d.
-- The skill-based match_score is returned alongside for a combined view.
CREATE OR REPLACE FUNCTION fn_recommend_jobs(p_resume_id INT, p_k INT DEFAULT 5)
RETURNS TABLE (job_id INT, title VARCHAR, company VARCHAR,
               semantic_similarity NUMERIC, match_score NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT j.job_id, j.title, c.name,
           ROUND((1 - (j.description_embedding <=> r.resume_embedding))::NUMERIC, 3),
           sga.match_score
    FROM   resumes r
    JOIN   job_postings j ON j.status = 'open'
                         AND j.description_embedding IS NOT NULL
    JOIN   companies c    ON c.company_id = j.company_id
    LEFT   JOIN skill_gap_analysis sga
           ON sga.resume_id = r.resume_id AND sga.job_id = j.job_id
    WHERE  r.resume_id = p_resume_id
    ORDER  BY j.description_embedding <=> r.resume_embedding
    LIMIT  p_k;
$$;
-- TRIGGER 1: keep applications.last_updated current on every UPDATE
-- (PostgreSQL has no "ON UPDATE CURRENT_TIMESTAMP" column option)
CREATE OR REPLACE FUNCTION trg_fn_touch_application()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.last_updated := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_applications_touch
BEFORE UPDATE ON applications
FOR EACH ROW EXECUTE FUNCTION trg_fn_touch_application();
-- TRIGGER 2: a student may only apply to a job whose status is 'open'
CREATE OR REPLACE FUNCTION trg_fn_check_job_open()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_status VARCHAR(20);
BEGIN
    SELECT status INTO v_status FROM job_postings WHERE job_id = NEW.job_id;
    IF v_status <> 'open' THEN
        RAISE EXCEPTION 'Cannot apply: job % is %', NEW.job_id, v_status;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_applications_job_open
BEFORE INSERT ON applications
FOR EACH ROW EXECUTE FUNCTION trg_fn_check_job_open();
-- TRIGGER 3: when a student uploads a new active resume, all of their
-- older resumes are automatically marked inactive (one active resume)
CREATE OR REPLACE FUNCTION trg_fn_single_active_resume()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_active THEN
        UPDATE resumes
        SET    is_active = FALSE
        WHERE  user_id = NEW.user_id
          AND  resume_id < NEW.resume_id      -- only OLDER uploads
          AND  is_active;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resumes_single_active
AFTER INSERT ON resumes
FOR EACH ROW EXECUTE FUNCTION trg_fn_single_active_resume();
-- TRIGGER 4: only users with role 'student' may own a student profile
CREATE OR REPLACE FUNCTION trg_fn_profile_student_only()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF (SELECT role FROM users WHERE user_id = NEW.user_id) <> 'student' THEN
        RAISE EXCEPTION 'User % is not a student', NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_student_only
BEFORE INSERT OR UPDATE ON student_profiles
FOR EACH ROW EXECUTE FUNCTION trg_fn_profile_student_only();
