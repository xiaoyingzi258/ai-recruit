-- ============================================================
-- 混合打分引擎 - 数据库迁移脚本
-- 说明：本脚本为混合打分引擎添加必要的数据库字段
-- 执行方式：手动在 PostgreSQL 数据库中执行
-- ============================================================

-- ============================================================
-- 1. 开启 pgvector 扩展
-- ============================================================
-- 注意：执行此语句需要数据库超级用户权限
-- 阿里云 RDS 需先在控制台开启 vector 插件
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 2. 修改 jobs 表，新增混合打分所需字段
-- ============================================================

-- 2.1 新增技能向量字段（2048 维）
ALTER TABLE jobs
  ADD COLUMN skills_embedding vector(2048);

-- 2.2 新增最低工作经验要求（年）
ALTER TABLE jobs
  ADD COLUMN min_experience integer DEFAULT 0;

-- 2.3 新增学历要求
ALTER TABLE jobs
  ADD COLUMN education_requirement varchar(50);

-- ============================================================
-- 3. 修改 candidates 表，新增混合打分所需字段
-- ============================================================

-- 3.1 新增技能向量字段（2048 维）
ALTER TABLE candidates
  ADD COLUMN skills_embedding vector(2048);

-- 3.2 新增工作经验（年）
ALTER TABLE candidates
  ADD COLUMN experience integer DEFAULT 0;

-- 3.3 新增最高学历
ALTER TABLE candidates
  ADD COLUMN education varchar(50);

-- ============================================================
-- 4. 索引建议（可选 - 数据量较大时执行）
-- ============================================================
-- 说明：初始阶段可以不创建索引，等数据量上来后再创建
-- 建议使用 CONCURRENTLY 避免锁表

-- jobs 表向量索引
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS jobs_skills_embedding_idx
--   ON jobs USING ivfflat (skills_embedding vector_cosine_ops)
--   WITH (lists = 100);

-- candidates 表向量索引
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS candidates_skills_embedding_idx
--   ON candidates USING ivfflat (skills_embedding vector_cosine_ops)
--   WITH (lists = 100);

-- ============================================================
-- 5. 执行验证 SQL
-- ============================================================
-- 执行完上述语句后，可运行以下 SQL 验证结果：
--
-- -- 检查扩展是否安装
-- SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
--
-- -- 检查 jobs 表新字段
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'jobs'
--   AND column_name IN ('skills_embedding', 'min_experience', 'education_requirement')
-- ORDER BY ordinal_position;
--
-- -- 检查 candidates 表新字段
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'candidates'
--   AND column_name IN ('skills_embedding', 'experience', 'education')
-- ORDER BY ordinal_position;

-- ============================================================
-- 6. 回滚脚本（如遇问题，可执行以下语句回滚）
-- ============================================================
-- ALTER TABLE jobs DROP COLUMN IF EXISTS skills_embedding;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS min_experience;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS education_requirement;
--
-- ALTER TABLE candidates DROP COLUMN IF EXISTS skills_embedding;
-- ALTER TABLE candidates DROP COLUMN IF EXISTS experience;
-- ALTER TABLE candidates DROP COLUMN IF EXISTS education;
--
-- DROP EXTENSION IF EXISTS vector;
