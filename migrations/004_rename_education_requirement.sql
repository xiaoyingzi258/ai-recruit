-- ============================================================
-- 重命名岗位学历要求字段
-- 说明：将 jobs 表的 education_requirement 字段重命名为 min_education
--       解决大模型 JSON Key 长度限制导致的字段名截断问题
-- 执行方式：手动在 PostgreSQL 数据库中执行
-- ============================================================

-- ============================================================
-- 1. 重命名字段
-- ============================================================

ALTER TABLE jobs
  RENAME COLUMN education_requirement TO min_education;

-- ============================================================
-- 2. 执行验证 SQL
-- ============================================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'jobs'
--   AND column_name IN ('min_experience', 'min_education')
-- ORDER BY ordinal_position;

-- ============================================================
-- 3. 回滚脚本（如遇问题，可执行以下语句回滚）
-- ============================================================
-- ALTER TABLE jobs RENAME COLUMN min_education TO education_requirement;