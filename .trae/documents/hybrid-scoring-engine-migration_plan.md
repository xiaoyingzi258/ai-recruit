# 混合打分引擎 - 数据库迁移计划

## 一、Repo 研究结论

### 1.1 项目技术栈
- **框架**：Next.js 14 App Router
- **数据库**：PostgreSQL（阿里云自建）
- **数据库访问**：原生 `pg` 库，无 ORM
- **现有表结构**：已存在 `jobs`、`candidates`、`match_results`、`analysis_results` 等表

### 1.2 现有相关表结构

**jobs 表现有字段**（来自 [database.ts](file:///Users/liangying/Desktop/project/github/ai-recruit/types/database.ts#L21-L30)）：
- `id` (string/uuid)
- `company_id` (string)
- `title` (string)
- `jd_text` (string)
- `status` ('open' | 'closed')
- `created_by` (string)
- `created_at` (string)
- `updated_at` (string)

**candidates 表现有字段**（来自 [database.ts](file:///Users/liangying/Desktop/project/github/ai-recruit/types/database.ts#L32-L47)）：
- `id` (string/uuid)
- `company_id` (string)
- `job_id` (string | null)
- `name` (string)
- `raw_text` (string)
- `parsed_data` (jsonb | null)
- `status` ('pending' | 'shortlisted' | 'removed')
- `source` ('upload' | 'manual')
- `work_years` (number | null)
- `current_company` (string | null)
- `risk_tag` (string | null)
- `avatar` (string | null)
- `salary_expectation` (string | null)
- `created_at` (string)

### 1.3 现有匹配机制
- 当前通过 Coze API 工作流进行人岗匹配（纯 AI 打分）
- 结果存储在 `match_results` 表中
- 本次迁移为**混合打分引擎**做数据库准备：结合向量相似度（技能语义匹配）+ 硬性条件过滤（经验、学历）

---

## 二、需要修改的文件和模块

### 2.1 新增文件
| 文件路径 | 操作 | 说明 |
|---------|------|------|
| `migrations/001_add_hybrid_scoring_fields.sql` | **新建** | 原生 SQL 迁移脚本，用户手动执行 |

### 2.2 后续可能需要修改的文件（本次计划不包含）
- `types/database.ts` - 更新 `Job` 和 `Candidate` 类型定义
- `app/api/jobs/route.ts` - 新增字段的写入和查询
- `app/api/candidates/route.ts` - 新增字段的写入和查询
- 业务逻辑层 - 混合打分引擎的实现

---

## 三、修改步骤

### 步骤 1：创建 SQL 迁移脚本文件

在项目根目录创建 `migrations/` 目录（如不存在），新建 `001_add_hybrid_scoring_fields.sql` 文件。

### 步骤 2：编写 SQL 语句

脚本包含以下三部分：

**2.1 开启 pgvector 扩展**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**2.2 修改 jobs 表，新增 3 个字段**
```sql
ALTER TABLE jobs
  ADD COLUMN skills_embedding vector(2048),
  ADD COLUMN min_experience integer DEFAULT 0,
  ADD COLUMN education_requirement varchar(50);
```

**2.3 修改 candidates 表，新增 3 个字段**
```sql
ALTER TABLE candidates
  ADD COLUMN skills_embedding vector(2048),
  ADD COLUMN experience integer DEFAULT 0,
  ADD COLUMN education varchar(50);
```

### 步骤 3：添加索引建议（可选优化）

为向量字段添加 IVFFlat 索引，加速相似度查询：
```sql
CREATE INDEX IF NOT EXISTS jobs_skills_embedding_idx 
  ON jobs USING ivfflat (skills_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS candidates_skills_embedding_idx 
  ON candidates USING ivfflat (skills_embedding vector_cosine_ops)
  WITH (lists = 100);
```

> **注意**：索引建议在数据量较大时创建，初始阶段可以不加，等有一定数据量后再建。

---

## 四、潜在依赖和注意事项

### 4.1 前置依赖
1. **PostgreSQL 版本**：需确保 PostgreSQL >= 11（pgvector 支持的最低版本）
2. **pgvector 扩展**：需确保数据库服务器已安装 pgvector 扩展
   - 阿里云 RDS PostgreSQL：支持 pgvector，需在控制台开启
   - 自建 PostgreSQL：需手动编译安装 pgvector
3. **权限**：执行 `CREATE EXTENSION` 需要数据库超级用户权限

### 4.2 字段设计说明
| 字段 | 类型 | 维度/长度 | 默认值 | 说明 |
|------|------|----------|--------|------|
| `skills_embedding` | `vector(2048)` | 2048 维 | NULL | 技能向量嵌入，用于语义相似度计算 |
| `min_experience` | `integer` | - | `0` | 岗位最低工作经验要求（年） |
| `education_requirement` | `varchar(50)` | 50 | NULL | 岗位学历要求（如：本科、硕士） |
| `experience` | `integer` | - | `0` | 候选人工作经验（年） |
| `education` | `varchar(50)` | 50 | NULL | 候选人最高学历 |

### 4.3 向量维度说明
- 使用 **2048 维**向量，适配常见中文 Embedding 模型（如：bge-large-zh、m3e-large 等）
- 维度一旦确定不可更改，如需修改需重建字段

### 4.4 兼容性考虑
- 所有新增字段均有默认值或允许 NULL，**不会破坏现有数据**
- `ALTER TABLE ADD COLUMN` 在 PostgreSQL 中是在线操作（加默认值为 NULL 的字段），不会锁表
- `DEFAULT 0` 的字段添加在 PostgreSQL 11+ 中也是快速操作（不再需要重写整表）

---

## 五、风险处理

### 5.1 pgvector 扩展安装失败
**风险**：数据库未安装 pgvector 扩展，`CREATE EXTENSION` 报错
**处理方案**：
1. 确认 PostgreSQL 版本 >= 11
2. 阿里云 RDS：在控制台 → 插件管理中启用 vector 扩展
3. 自建库：手动编译安装 pgvector
   ```bash
   git clone --branch v0.7.0 https://github.com/pgvector/pgvector.git
   cd pgvector
   make
   make install
   ```

### 5.2 字段已存在
**风险**：重复执行脚本时字段已存在，报错
**处理方案**：
- SQL 使用 `IF NOT EXISTS` 风格（PostgreSQL 原生 `ADD COLUMN` 不支持 `IF NOT EXISTS`）
- 建议用户**手动执行前先检查字段是否存在**
- 或者使用 PL/pgSQL 匿名块封装：
  ```sql
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'jobs' AND column_name = 'skills_embedding'
    ) THEN
      ALTER TABLE jobs ADD COLUMN skills_embedding vector(2048);
    END IF;
  END $$;
  ```

### 5.3 索引创建性能影响
**风险**：数据量大时创建索引会占用资源
**处理方案**：
- 初始阶段不建索引，等数据量上来后再创建
- 创建索引时使用 `CONCURRENTLY` 选项避免锁表：
  ```sql
  CREATE INDEX CONCURRENTLY IF NOT EXISTS jobs_skills_embedding_idx 
    ON jobs USING ivfflat (skills_embedding vector_cosine_ops)
    WITH (lists = 100);
  ```

### 5.4 回滚方案
如遇问题，可执行回滚：
```sql
ALTER TABLE jobs DROP COLUMN IF EXISTS skills_embedding;
ALTER TABLE jobs DROP COLUMN IF EXISTS min_experience;
ALTER TABLE jobs DROP COLUMN IF EXISTS education_requirement;

ALTER TABLE candidates DROP COLUMN IF EXISTS skills_embedding;
ALTER TABLE candidates DROP COLUMN IF EXISTS experience;
ALTER TABLE candidates DROP COLUMN IF EXISTS education;

DROP EXTENSION IF EXISTS vector;
```

---

## 六、执行验证

用户手动执行 SQL 后，可通过以下 SQL 验证：

```sql
-- 检查扩展
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- 检查 jobs 表字段
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'jobs' AND column_name IN ('skills_embedding', 'min_experience', 'education_requirement')
ORDER BY ordinal_position;

-- 检查 candidates 表字段
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'candidates' AND column_name IN ('skills_embedding', 'experience', 'education')
ORDER BY ordinal_position;
```

---

## 七、后续工作（本次不包含）

1. 更新 TypeScript 类型定义（`types/database.ts`）
2. 更新 API 路由，支持新字段的 CRUD
3. 实现 Embedding 生成逻辑（调用 Embedding 模型 API）
4. 实现混合打分引擎（向量相似度 + 硬性条件过滤 + 权重调节）
5. 更新 `match_results` 表，记录混合打分的各项子分数
