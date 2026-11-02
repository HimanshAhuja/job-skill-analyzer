INSERT INTO users (email, password_hash, full_name, role) VALUES
('admin@jobskill.example',  '$2b$12$hK3s9QeYv1aZ0pXcR7mW8O', 'Placement Admin', 'admin'),
('aarav.sharma@example.com','$2b$12$Lw2pT8nB4cV6xZ1qY3rU5e', 'Aarav Sharma',    'student'),
('diya.menon@example.com',  '$2b$12$Pq7mN2bV5cX8zL1kJ4hG6f', 'Diya Menon',      'student'),
('rohan.k@example.com',     '$2b$12$Rt5yU8iO2pA4sD6fG9hJ1k', 'Rohan Kulkarni',  'student'),
('sneha.iyer@example.com',  '$2b$12$Zx3cV6bN9mQ2wE5rT8yU1i', 'Sneha Iyer',      'student');
SELECT user_id, email, full_name, role, is_active FROM users;
INSERT INTO student_profiles
       (user_id, phone, location, education_level, years_experience, linkedin_url) VALUES
(2, '9876500001', 'Bengaluru', 'B.Tech CSE', 0.5, 'linkedin.com/in/aarav-sharma'),
(3, '9876500002', 'Mysuru',    'B.Tech CSE', 0.0, 'linkedin.com/in/diya-menon'),
(4, '9876500003', 'Pune',      'B.Tech CSE', 1.0, 'linkedin.com/in/rohan-kulkarni'),
(5, '9876500004', 'Chennai',   'B.Tech ECE', 0.0, 'linkedin.com/in/sneha-iyer');
SELECT profile_id, user_id, phone, location, education_level, years_experience
FROM student_profiles;
INSERT INTO companies (name, industry, website, location) VALUES
('NovaTech Solutions', 'IT Services',  'novatech.example',  'Bengaluru'),
('DataWave Analytics', 'Analytics',    'datawave.example',  'Bengaluru'),
('ShopSphere Retail',  'E-commerce',   'shopsphere.example','Hyderabad'),
('Finlytics Pvt Ltd',  'FinTech',      'finlytics.example', 'Mumbai'),
('CloudNest Systems',  'Cloud / SaaS', 'cloudnest.example', 'Chennai');
SELECT * FROM companies;
INSERT INTO skills (skill_name, category) VALUES
('Python','Language'), ('Java','Language'), ('JavaScript','Language'),
('SQL','Database'), ('PostgreSQL','Database'), ('MongoDB','Database'),
('React','Framework'), ('Node.js','Framework'), ('Django','Framework'),
('Spring Boot','Framework'), ('Machine Learning','AI/ML'), ('Deep Learning','AI/ML'),
('Docker','DevOps'), ('Kubernetes','DevOps'), ('AWS','Cloud'),
('Git','Tool'), ('Data Visualization','Analytics'), ('Pandas','Library');
SELECT * FROM skills;
INSERT INTO job_postings (company_id, title, description, employment_type, location,
                          min_experience, salary_min, salary_max, status) VALUES
(1,'Backend Developer','Build REST APIs in Python/Django on PostgreSQL.',
   'Full-time','Bengaluru',0, 600000, 900000,'open'),
(2,'Data Analyst Intern','Clean data with Pandas/SQL and build dashboards.',
   'Internship','Bengaluru',0, 300000, 360000,'open'),
(2,'ML Engineer','Train and deploy ML / DL models to production.',
   'Full-time','Bengaluru',1,1000000,1600000,'open'),
(3,'Frontend Developer','Develop responsive UIs with React.',
   'Full-time','Hyderabad',0, 550000, 800000,'open'),
(4,'Full Stack Developer','MERN stack features for a payments dashboard.',
   'Full-time','Mumbai',1, 800000,1200000,'open'),
(5,'Java Developer','Microservices with Spring Boot and SQL databases.',
   'Full-time','Chennai',0, 650000, 950000,'open'),
(5,'DevOps Engineer Intern','CI/CD pipelines, containers and AWS infrastructure.',
   'Internship','Chennai',0, 360000, 420000,'open'),
(1,'Cloud Support Associate','Monitor and support AWS-hosted client systems.',
   'Contract','Bengaluru',0, 400000, 500000,'closed');
SELECT job_id, company_id AS cid, title, employment_type,
       salary_min, salary_max, status FROM job_postings;
INSERT INTO job_skills (job_id, skill_id, importance, min_proficiency) VALUES
(1,1,'required','intermediate'),(1,9,'required','intermediate'),
(1,5,'required','intermediate'),(1,16,'required','beginner'),(1,13,'preferred','beginner'),
(2,4,'required','intermediate'),(2,1,'required','beginner'),
(2,18,'required','intermediate'),(2,17,'required','intermediate'),(2,11,'preferred','beginner'),
(3,1,'required','advanced'),(3,11,'required','advanced'),(3,12,'required','intermediate'),
(3,4,'preferred','intermediate'),(3,13,'preferred','beginner'),(3,15,'preferred','beginner'),
(4,3,'required','advanced'),    (4,7,'required','intermediate'),(4,16,'required','beginner'),
(4,8,'preferred','beginner'),
(5,3,'required','intermediate'),(5,7,'required','intermediate'),
(5,8,'required','intermediate'),(5,6,'required','beginner'),
(5,13,'preferred','beginner'),(5,15,'preferred','beginner'),
(6,2,'required','advanced'),(6,10,'required','intermediate'),
(6,4,'required','intermediate'),(6,16,'required','beginner'),(6,14,'preferred','beginner'),
(7,13,'required','intermediate'),(7,14,'required','beginner'),
(7,15,'required','beginner'),(7,16,'required','intermediate'),(7,1,'preferred','beginner'),
(8,15,'required','intermediate'),(8,13,'required','beginner');
SELECT job_id, COUNT(*) AS skills_listed,
       COUNT(*) FILTER (WHERE importance = 'required') AS required
FROM job_skills GROUP BY job_id ORDER BY job_id;
-- Aarav uploads an old resume and then a newer one;
-- trigger 3 (Chapter 8) automatically deactivates the older resume
INSERT INTO resumes (user_id, file_name, file_path, parsed_text) VALUES
(2,'aarav_resume_v1.pdf','/uploads/2/aarav_resume_v1.pdf','Python, SQL, Git ...'),
(2,'aarav_resume_v2.pdf','/uploads/2/aarav_resume_v2.pdf',
   'Python, Django, SQL, PostgreSQL, Git, Java ...'),
(3,'diya_menon_cv.pdf','/uploads/3/diya_menon_cv.pdf',
   'Python, Pandas, SQL, Tableau, ML basics ...'),
(4,'rohan_resume.pdf','/uploads/4/rohan_resume.pdf',
   'JavaScript, React, Node.js, MongoDB, Git ...'),
(5,'sneha_iyer_cv.pdf','/uploads/5/sneha_iyer_cv.pdf',
   'Java, Spring Boot, SQL, Git, Docker ...');
SELECT resume_id, user_id, file_name, is_active FROM resumes ORDER BY resume_id;
INSERT INTO resume_skills (resume_id, skill_id, proficiency, years_used) VALUES
(1,1,'intermediate',1),(1,4,'beginner',0.5),(1,16,'beginner',1),
(2,1,'advanced',2),(2,9,'intermediate',1),(2,4,'intermediate',2),
(2,5,'beginner',0.5),(2,16,'intermediate',2),(2,2,'beginner',0.5),
(3,1,'intermediate',1.5),(3,18,'advanced',1),(3,4,'advanced',2),
(3,17,'intermediate',1),(3,11,'beginner',0.5),
(4,3,'advanced',2),(4,7,'intermediate',1.5),(4,8,'beginner',0.5),
(4,16,'intermediate',2),(4,6,'beginner',0.5),
(5,2,'advanced',2),(5,10,'beginner',0.5),(5,4,'intermediate',1),
(5,16,'beginner',1),(5,13,'beginner',0.5);
SELECT r.resume_id, u.full_name, COUNT(*) AS skills_on_resume
FROM resume_skills rs JOIN resumes r USING (resume_id) JOIN users u USING (user_id)
GROUP BY r.resume_id, u.full_name ORDER BY r.resume_id;
-- Run the skill-gap procedure for every active resume
CALL sp_analyze_resume(2);
CALL sp_analyze_resume(3);
CALL sp_analyze_resume(4);
CALL sp_analyze_resume(5);
SELECT analysis_id, resume_id, job_id, match_score,
       matched_skills_count AS matched, missing_skills_count AS missing
FROM skill_gap_analysis ORDER BY resume_id, match_score DESC;
-- Skills recommended to Aarav (resume 2), highest priority first
SELECT sga.job_id, s.skill_name, sr.priority, sr.reason
FROM skill_recommendations sr
JOIN skill_gap_analysis sga USING (analysis_id)
JOIN skills s USING (skill_id)
WHERE sga.resume_id = 2
ORDER BY sga.job_id, sr.priority
LIMIT 10;
INSERT INTO applications (user_id, job_id, status, applied_date, notes) VALUES
(2,1,'interviewing','2026-09-02','Technical round scheduled'),
(2,3,'applied',     '2026-09-10',NULL),
(3,2,'offer',       '2026-08-28','Offer letter received'),
(3,3,'rejected',    '2026-09-05','Needs stronger DL skills'),
(4,4,'under_review','2026-09-12',NULL),
(4,5,'applied',     '2026-09-15',NULL),
(5,6,'applied',     '2026-09-18',NULL),
(5,7,'withdrawn',   '2026-09-01','Chose to focus on Java roles');
SELECT application_id, user_id, job_id, status, applied_date, notes FROM applications;
-- Embeddings are written by the Python service after parsing:
--   model = SentenceTransformer('all-MiniLM-L6-v2')   -> 384-d vectors
--   UPDATE resumes      SET resume_embedding      = %s::vector WHERE resume_id = %s;
--   UPDATE job_postings SET description_embedding = %s::vector WHERE job_id    = %s;
SELECT 1;
