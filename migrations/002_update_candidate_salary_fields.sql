-- ============================================================
-- 更新候选人薪资字段 - 数据库迁移脚本
-- 说明：将 salary_expectation 拆分为 expected_min_salary 和 expected_max_salary
--       工作年限字段由字符串改为纯数字 experience_years
-- 执行方式：手动在 PostgreSQL 数据库中执行
-- ============================================================

-- ============================================================
-- 1. 为 candidates 表添加新的薪资字段
-- ============================================================

ALTER TABLE candidates
  ADD COLUMN expected_min_salary integer;

ALTER TABLE candidates
  ADD COLUMN expected_max_salary integer;

-- ============================================================
-- 2. 数据迁移（将旧的 salary_expectation 解析后回填到新字段）
-- ============================================================
-- 对于旧数据，如果 salary_expectation 包含范围（如 "15k-25k"），解析后分别填入
-- 如果只有单个值，则同时填入两个字段

UPDATE candidates
SET 
  expected_min_salary = (regexp_match(salary_expectation, '(\d+)'))[1]::integer,
  expected_max_salary = CASE 
    WHEN salary_expectation ~ '\d+[-~]\d+' THEN (regexp_match(salary_expectation, '\d+[-~](\d+)'))[1]::integer
    ELSE (regexp_match(salary_expectation, '(\d+)'))[1]::integer
  END
WHERE 
  salary_expectation IS NOT NULL 
  AND salary_expectation != ''
  AND expected_min_salary IS NULL
  AND salary_expectation ~ '\d+';

-- ============================================================
-- 3. 执行验证 SQL
-- ============================================================
-- SELECT id, salary_expectation, expected_min_salary, expected_max_salary
-- FROM candidates
-- WHERE salary_expectation IS NOT NULL
-- ORDER BY id
-- LIMIT 10;

-- ============================================================
-- 4. 回滚脚本（如遇问题，可执行以下语句回滚）
-- ============================================================
-- ALTER TABLE candidates DROP COLUMN IF EXISTS expected_min_salary;
-- ALTER TABLE candidates DROP COLUMN IF EXISTS expected_max_salary;