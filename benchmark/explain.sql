-- explain.sql - Database query-timing evidence for Chapter 5.
--
-- Run against the secure_cloud_storage database AFTER seeding representative
-- data (e.g. a few hundred files and a few thousand audit rows) so the timings
-- are meaningful:
--
--   psql -U postgres -d secure_cloud_storage \
--     --set uid="'<a-real-user-uuid>'" \
--     --set fid="'<a-real-folder-uuid>'" \
--     -f explain.sql
--
-- Capture the "Execution Time" line from each EXPLAIN ANALYZE block and the
-- index/scan nodes (these prove the schema indexes are actually used).
-- Paste the output as a figure in Appendix B.5 and summarise the execution
-- times in a small table in Section 5.7.

\timing on

-- 1. Per-user storage aggregate (drives the quota check and /files/storage).
--    Expect an index scan on idx_files_owner_id.
EXPLAIN (ANALYZE, BUFFERS)
SELECT COALESCE(SUM(size_bytes), 0)::bigint AS used_bytes
FROM files
WHERE owner_id = :'uid' AND is_deleted = FALSE;

-- 2. File listing for a user (owned OR shared), the main My Files query.
EXPLAIN (ANALYZE, BUFFERS)
SELECT f.id, f.original_name, f.size_bytes, f.mime_type,
       f.sensitivity_level, f.project_category, f.department,
       f.folder_id, f.uploaded_at, u.email AS owner_email
FROM files f
JOIN users u ON f.owner_id = u.id
WHERE f.is_deleted = FALSE
  AND ( f.owner_id = :'uid'
        OR f.id IN (SELECT file_id FROM file_permissions WHERE granted_to_user_id = :'uid') )
ORDER BY f.uploaded_at DESC;

-- 3. Audit-log filtered retrieval (drives /api/audit).
--    Expect use of idx_audit_logs_action and/or idx_audit_logs_created_at.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, user_email, user_role, action, resource, resource_id, details, ip_address, created_at
FROM audit_logs
WHERE action = 'FILE_DOWNLOAD'
ORDER BY created_at DESC
LIMIT 100;

-- 4. Audit aggregate stats (drives the admin dashboard /api/audit/stats).
EXPLAIN (ANALYZE, BUFFERS)
SELECT action, COUNT(*)::int AS count
FROM audit_logs
GROUP BY action
ORDER BY count DESC;

-- 5. Recursive folder subtree resolution (drives cascade delete).
--    Pass a real folder UUID that has nested children via --set fid=...
EXPLAIN (ANALYZE, BUFFERS)
WITH RECURSIVE subtree AS (
  SELECT id FROM folders WHERE id = :'fid'
  UNION ALL
  SELECT f.id FROM folders f JOIN subtree s ON f.parent_id = s.id
)
SELECT id FROM subtree;

\timing off
