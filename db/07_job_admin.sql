-- PROCEDURE: score every ACTIVE resume against ONE job (used when an admin
-- creates a job or changes its required skills). Reuses fn_compute_skill_gap.
CREATE OR REPLACE PROCEDURE sp_analyze_job(p_job_id INT)
LANGUAGE plpgsql AS $$
DECLARE
    v_resume RECORD;
    v_cnt    INT := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM job_postings WHERE job_id = p_job_id AND status = 'open') THEN
        RAISE EXCEPTION 'Job % does not exist or is not open', p_job_id;
    END IF;

    FOR v_resume IN SELECT resume_id FROM resumes WHERE is_active LOOP
        PERFORM fn_compute_skill_gap(v_resume.resume_id, p_job_id);
        v_cnt := v_cnt + 1;
    END LOOP;

    RAISE NOTICE 'Job % analysed against % active resumes', p_job_id, v_cnt;
END;
$$;
-- TRIGGER: when a closed or draft job is reopened, its skill gaps are recomputed
CREATE OR REPLACE FUNCTION trg_fn_job_reopened()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'open' AND OLD.status <> 'open' THEN
        CALL sp_analyze_job(NEW.job_id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_jobs_reopened
AFTER UPDATE OF status ON job_postings
FOR EACH ROW EXECUTE FUNCTION trg_fn_job_reopened();
-- VIEW: one row per job for the admin screen
CREATE OR REPLACE VIEW v_job_admin_overview AS
SELECT j.job_id, j.title, c.name AS company, j.employment_type, j.location,
       j.status, j.posted_date,
       (SELECT COUNT(*) FROM job_skills js WHERE js.job_id = j.job_id)       AS skills,
       (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.job_id)       AS applicants,
       (SELECT ROUND(AVG(sga.match_score), 1)
        FROM skill_gap_analysis sga JOIN resumes r ON r.resume_id = sga.resume_id
        WHERE sga.job_id = j.job_id AND r.is_active)                         AS avg_match,
       (j.description_embedding IS NOT NULL)                                 AS embedded
FROM job_postings j
JOIN companies c ON c.company_id = j.company_id;
SELECT job_id, title, company, status, skills, applicants, avg_match
FROM v_job_admin_overview ORDER BY job_id;
