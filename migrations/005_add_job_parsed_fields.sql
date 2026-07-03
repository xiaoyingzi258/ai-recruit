-- ============================================================
-- 为 jobs 表添加 JD 解析字段
-- 说明：添加 min_salary, max_salary, location, core_skills, parsed_data 字段
--       实现岗位数据的结构化存储，支持混合打分引擎计算
-- 执行方式：手动在 PostgreSQL 数据库中执行
-- ============================================================

-- ============================================================
-- 1. 添加新字段
-- ============================================================

ALTER TABLE jobs
  ADD COLUMN min_salary integer DEFAULT 0;

ALTER TABLE jobs
  ADD COLUMN max_salary integer DEFAULT 0;

ALTER TABLE jobs
  ADD COLUMN location varchar(100);

ALTER TABLE jobs
  ADD COLUMN core_skills jsonb;

ALTER TABLE jobs
  ADD COLUMN parsed_data jsonb;

-- ============================================================
-- 2. 执行验证 SQL
-- ============================================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'jobs'
-- ORDER BY ordinal_position;

-- ============================================================
-- 3. 回滚脚本（如遇问题，可执行以下语句回滚）
-- ============================================================
-- ALTER TABLE jobs DROP COLUMN IF EXISTS min_salary;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS max_salary;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS location;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS core_skills;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS parsed_data;