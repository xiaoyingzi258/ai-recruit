-- ============================================================
-- 更新候选人字段 - 添加 experience_years 和 age
-- 说明：新增纯数字的工作年限字段 experience_years 和年龄字段 age
--       迁移旧数据从 work_years 和 experience 字段到 experience_years
-- 执行方式：手动在 PostgreSQL 数据库中执行
-- ============================================================

-- ============================================================
-- 1. 为 candidates 表添加新字段
-- ============================================================

ALTER TABLE candidates
  ADD COLUMN experience_years integer;

ALTER TABLE candidates
  ADD COLUMN age integer;

-- ============================================================
-- 2. 数据迁移（将旧的 work_years 和 experience 字段数据迁移到 experience_years）
-- ============================================================
-- 优先使用 experience 字段，其次使用 work_years

UPDATE candidates
SET 
  experience_years = COALESCE(experience, work_years)
WHERE 
  experience_years IS NULL
  AND (experience IS NOT NULL OR work_years IS NOT NULL);

-- ============================================================
-- 3. 执行验证 SQL
-- ============================================================
-- SELECT id, work_years, experience, experience_years, age
-- FROM candidates
-- ORDER BY id
-- LIMIT 10;

-- ============================================================
-- 4. 回滚脚本（如遇问题，可执行以下语句回滚）
-- ============================================================
-- ALTER TABLE candidates DROP COLUMN IF EXISTS experience_years;
-- ALTER TABLE candidates DROP COLUMN IF EXISTS age;