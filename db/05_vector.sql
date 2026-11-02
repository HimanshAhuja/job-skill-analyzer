-- 1. Enable pgvector and check the installed version
CREATE EXTENSION IF NOT EXISTS vector;
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
-- 2. Vector columns defined in the schema (VECTOR(384) = 384 float values)
SELECT c.relname  AS table_name,
       a.attname  AS column_name,
       format_type(a.atttypid, a.atttypmod) AS data_type
FROM   pg_attribute a
JOIN   pg_class c ON c.oid = a.attrelid AND c.relkind = 'r'
WHERE  format_type(a.atttypid, a.atttypmod) LIKE 'vector%'
ORDER  BY 1;
-- 3. HNSW approximate-nearest-neighbour indexes (created in Section 6.3)
SELECT indexname, tablename,
       substring(indexdef FROM 'USING (.*)$') AS method
FROM   pg_indexes
WHERE  indexdef ILIKE '%hnsw%';
-- 4. The three pgvector distance operators on small example vectors
SELECT '[1,2,3]'::vector <-> '[2,3,5]'::vector AS l2_distance,      -- Euclidean
       '[1,2,3]'::vector <=> '[2,3,5]'::vector AS cosine_distance,  -- 1 - cosine similarity
       '[1,2,3]'::vector <#> '[2,3,5]'::vector AS neg_inner_product,
       vector_dims('[1,2,3]'::vector)          AS dims;
-- 5. Storing an embedding (the Next.js server passes the vector as a parameter)
UPDATE job_postings
SET    description_embedding = $1::vector     -- '[0.0123, -0.0456, ...]' 384 values
WHERE  job_id = $2;
-- 6. Verify the stored embeddings: 384 dimensions, unit length (normalised)
SELECT job_id, title,
       vector_dims(description_embedding)                 AS dims,
       ROUND(vector_norm(description_embedding)::numeric, 4) AS norm,
       left(description_embedding::text, 30) || '...'      AS embedding_preview
FROM   job_postings
ORDER  BY job_id
LIMIT  4;
-- 7. Semantic search: jobs closest in meaning to a free-text query.
--    :'qvec' holds the embedding of "web backend developer who writes Python APIs"
SELECT job_id, title,
       ROUND((1 - (description_embedding <=> :'qvec'::vector))::numeric, 3) AS similarity
FROM   job_postings
WHERE  status = 'open'
ORDER  BY description_embedding <=> :'qvec'::vector
LIMIT  3;
-- 8. Resume-to-job recommendation (function fn_recommend_jobs, Section 9.1)
SELECT * FROM fn_recommend_jobs(2, 3);
-- 9. Hybrid ranking: 60% weighted skill match + 40% semantic similarity
SELECT j.title,
       sga.match_score,
       ROUND((1 - (j.description_embedding <=> r.resume_embedding))::numeric, 3) AS semantic,
       ROUND(0.6 * sga.match_score / 100
           + 0.4 * (1 - (j.description_embedding <=> r.resume_embedding))::numeric, 3) AS hybrid_score
FROM   resumes r
JOIN   skill_gap_analysis sga ON sga.resume_id = r.resume_id
JOIN   job_postings j         ON j.job_id = sga.job_id AND j.status = 'open'
WHERE  r.resume_id = 5
ORDER  BY hybrid_score DESC
LIMIT  4;
-- 10. Students with the most similar resumes (resume <-> resume)
SELECT u.full_name,
       ROUND((1 - (r.resume_embedding <=> me.resume_embedding))::numeric, 3) AS similarity
FROM   resumes me
JOIN   resumes r ON r.resume_id <> me.resume_id AND r.is_active
JOIN   users u   ON u.user_id = r.user_id
WHERE  me.resume_id = 3
ORDER  BY r.resume_embedding <=> me.resume_embedding;
-- 11. The planner uses the HNSW index for ORDER BY <=> ... LIMIT
--     (sequential scan disabled only because the demo table is tiny)
SET enable_seqscan = off;
EXPLAIN (COSTS OFF)
SELECT job_id FROM job_postings
ORDER  BY description_embedding <=> (SELECT resume_embedding FROM resumes WHERE resume_id = 2)
LIMIT  3;
RESET enable_seqscan;
