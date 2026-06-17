# AI招聘助手 - Supabase → PostgreSQL + next-auth 代码迁移计划

## 概述

将 AI 招聘助手项目从 Supabase（Auth + 数据库 + Storage）迁移到阿里云自建 PostgreSQL 14 + next-auth 邮箱密码登录。迁移范围涵盖认证系统、数据库查询、前端数据获取方式，Coze 工作流 API 调用和文件解析逻辑完全不动。

## 当前状态分析

- **框架**：Next.js 14 App Router，无 `src/` 目录
- **认证**：Supabase Auth（客户端 `supabase.auth` + 服务端 `createServerClient`）
- **数据库访问**：混合模式 — 部分 API 路由使用 `server/admin` client，部分前端页面/hooks 使用 `client` 直连
- **涉及 Supabase 的文件**：3 个 lib 文件 + 10 个 API 路由 + 4 个 hooks/contexts + 5 个页面组件 + 类型定义
- **不涉及 Supabase 的文件**：`extract-text`、`parse-resume`、`job-matcher`、`analyze-resume`、`generate-interview`（纯 Coze API 或纯文件解析）

---

## 阶段 0：基础设施搭建

### 0.1 安装新依赖，移除旧依赖

**文件**：`package.json`

```bash
# 安装
npm install next-auth@4 bcryptjs pg uuid
npm install -D @types/bcryptjs @types/pg @types/uuid

# 移除
npm uninstall @supabase/auth-helpers-nextjs @supabase/ssr @supabase/supabase-js
```

### 0.2 更新环境变量

**文件**：`.env.local`、`.env.example`

- 移除：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`
- 新增：`DATABASE_URL`、`NEXTAUTH_URL`、`NEXTAUTH_SECRET`
- 保留：`COZE_API_KEY`

### 0.3 创建 PostgreSQL 连接池

**新建**：`lib/db.ts`

- 使用 `pg.Pool`，从 `DATABASE_URL` 读取连接信息
- 导出 `query<T>(text, params)` 便捷方法和 `getClient()` 事务方法
- 连接池配置：`max: 10`、`idleTimeoutMillis: 30000`、`connectionTimeoutMillis: 5000`

### 0.4 重写类型定义

**重命名+重写**：`types/supabase.ts` → `types/database.ts`

- 移除 Supabase 特有的 `Database` 包装类型（`WithRelationships`、`public.Tables`）
- 保留所有业务类型（`CandidateParsedData`、`MatchHardCondition` 等）
- 为每张表定义独立的 `Row`/`Insert`/`Update` 类型

**新建**：`types/next-auth.d.ts`

- 扩展 `Session` 和 `User` 类型，添加 `company_id`、`company_name`、`role` 等自定义字段

---

## 阶段 1：认证系统迁移

### 1.1 创建 next-auth 配置

**新建**：`lib/auth.ts`

- `CredentialsProvider`：从 `users` 表 JOIN `companies` 查询用户，`bcryptjs.compare` 验证密码
- `callbacks.jwt`：写入 `company_id`、`company_name`、`role`、`name`
- `callbacks.session`：将 JWT 字段暴露到 session
- `session.strategy: "jwt"`

### 1.2 创建 next-auth 路由

**新建**：`app/api/auth/[...nextauth]/route.ts`

- 导出 `GET` 和 `POST` handler

### 1.3 创建注册接口

**新建**：`app/api/auth/register/route.ts`

- POST 接口，接收 `email`、`password`、`name`、`companyName`
- 事务逻辑：检查 email → bcrypt 哈希密码 → 创建公司（如不存在）→ 插入用户
- 默认角色 `hr`

### 1.4 替换 AuthProvider 为 SessionProvider

**新建**：`components/providers.tsx`（客户端组件，包裹 `SessionProvider`）

**修改**：`app/layout.tsx`
- `AuthProvider` → `Providers`（内含 `SessionProvider`）

### 1.5 重写 auth-context.tsx

**重写**：`contexts/auth-context.tsx`

- 使用 `useSession()` 替代 `supabase.auth.getSession()` 和 `onAuthStateChange`
- `user`/`profile` 从 `session.user` 获取
- `signOut` 使用 `signOut()` from `next-auth/react`
- 移除 `loadUserProfile`（自动创建用户逻辑已迁移到注册 API）
- 保持 `useAuth()` API 不变，确保下游组件改动最小

### 1.6 修改登录页面

**修改**：`app/login/page.tsx`

- 登录：`supabase.auth.signInWithPassword` → `signIn('credentials', { email, password, redirect: false })`
- 注册：`supabase.auth.signUp` → `fetch('/api/auth/register', ...)` + 自动登录
- UI 不动

### 1.7 创建路由保护中间件

**新建**：`middleware.ts`（项目根目录）

- 排除 `/login`、`/api/auth`、静态资源
- 未登录自动重定向到 `/login`

### 1.8 适配 AppLayout 和 ProfilePage

**微调**：`components/AppLayout.tsx`、`app/profile/page.tsx`

- `useAuth()` API 不变，字段名兼容，基本无需改动

---

## 阶段 2：API 路由迁移（Supabase → pg）

### 2.1 迁移 `app/api/jobs/[id]/route.ts`

- `createAdminClient` → `import { query, getClient } from '@/lib/db'`
- PATCH：`supabase.from('jobs').update()` → SQL `UPDATE ... RETURNING *`
- DELETE：级联删除改为 SQL 事务（`BEGIN → DELETE match_results → DELETE candidates → DELETE jobs → COMMIT`）

### 2.2 迁移 `app/api/upload-candidate/route.ts`

- `createClient(server)` → `import { query } from '@/lib/db'`
- Coze API 调用和文件解析逻辑不动
- `supabase.from('candidates').insert()` → SQL `INSERT INTO candidates ... VALUES ... RETURNING *`
- `supabase.from('match_results').insert()` → SQL `INSERT INTO match_results ...`
- SSE 流式响应逻辑不动

### 2.3 迁移 `app/api/analyze-candidate/route.ts`

- Coze API 调用和 JSON 解析逻辑不动
- 缓存检查 → SQL `SELECT * FROM analysis_results WHERE candidate_id = $1`
- UPSERT → SQL `INSERT ... ON CONFLICT (candidate_id) DO UPDATE ... RETURNING *`（比原来的 upsert + fallback 更简洁）

### 2.4 迁移 `app/api/generate-interview-questions/route.ts`

- Coze API 调用和 JSON 解析逻辑不动
- 缓存检查 → SQL
- DELETE + INSERT → SQL 事务

### 2.5 迁移 `app/api/rematch-candidate/route.ts`

- Coze API 调用不动
- 获取候选人 → SQL
- 更新 match_results → SQL `UPDATE ... WHERE candidate_id = $1`
- 更新 candidates.risk_tag → SQL

### 2.6 确认无需修改的 API 路由

以下文件不涉及数据库，无需修改：
- `app/api/extract-text/route.ts` — 纯文件解析
- `app/api/parse-resume/route.ts` — 纯 Coze API
- `app/api/job-matcher/route.ts` — 纯 Coze API
- `app/api/analyze-resume/route.ts` — 纯 Coze API
- `app/api/generate-interview/route.ts` — 纯 Coze API

---

## 阶段 3：前端数据获取迁移（客户端直连 → API 路由）

原来多个前端文件使用 `createClient()` 直连 Supabase，迁移后改为调用后端 API 路由。

### 3.1 新增后端 API 路由

**新建**：`app/api/jobs/route.ts`
- GET：按 company_id 查询 jobs（含创建者信息）
- POST：创建新 job

**修改**：`app/api/jobs/[id]/route.ts`（补充 GET handler）
- GET：查询单个 job 详情

**新建**：`app/api/candidates/route.ts`
- GET：按 company_id + job_id 查询候选人列表（JOIN match_results 获取匹配分数）

**新建**：`app/api/candidates/[id]/route.ts`
- GET：单个候选人详情
- PATCH：更新状态（removed/shortlisted）
- DELETE：删除候选人及 match_results

**新建**：`app/api/candidates/[id]/analysis/route.ts`
- GET：查询 analysis_results

**新建**：`app/api/candidates/[id]/questions/route.ts`
- GET：查询 interview_questions

### 3.2 重写 hooks

**重写**：`hooks/use-jobs.ts`
- 所有 Supabase 操作改为 `fetch('/api/jobs/...')`
- 保留状态管理和业务逻辑

**重写**：`hooks/use-analysis.ts`
- Supabase 操作改为 `fetch('/api/candidates/.../analysis')`

### 3.3 重写 contexts

**重写**：`contexts/job-context.tsx`
- `fetchOpenJobs` 改为 `fetch('/api/jobs?status=open')`

### 3.4 重写页面组件

**重写**：`app/candidates/page.tsx`
- `loadData`：改为 `fetch('/api/candidates?company_id=...&job_id=...')`
- `removeCandidate`/`restoreCandidate`/`deleteCandidate`：改为 fetch API
- `handleFileUpload` 和 `handleRematch` 已调用 API，不动
- UI 不动

**重写**：`app/candidates/[id]/page.tsx`
- 查询候选人和分析结果改为 fetch API
- UI 不动

**重写**：`app/candidates/[id]/analysis/page.tsx`
- 查询改为 fetch API
- UI 不动

**重写**：`app/candidates/[id]/interview/page.tsx`
- 查询改为 fetch API
- UI 不动

---

## 阶段 4：API 路由增加认证保护

为所有需要认证的 API 路由添加 session 验证：
- 导入 `getServerSession` + `authOptions`
- 检查 `session` 是否存在，不存在返回 401
- 从 `session.user.company_id` 获取公司 ID，所有查询加 `WHERE company_id = $1`
- **不信任客户端传来的 company_id**

---

## 阶段 5：清理与验证

### 5.1 删除 Supabase 文件

- 删除 `lib/supabase/` 整个目录（`client.ts`、`server.ts`、`admin.ts`）

### 5.2 全局搜索确认无遗漏

- 搜索 `@supabase`、`supabase`、`createClient`、`createAdminClient`、`from('@/types/supabase')` 确认无残留

### 5.3 端到端验证

1. 注册新用户 → 验证 users 和 companies 表正确写入
2. 登录 → 验证 session 包含 company_id 等字段
3. 岗位 CRUD → 验证 company_id 隔离
4. 上传简历 → 验证 SSE 流式响应、candidates 和 match_results 写入
5. 深度解析 → 验证 analysis_results UPSERT
6. 面试题生成 → 验证事务写入
7. 重新匹配 → 验证更新
8. 候选人列表 → 验证分页、搜索、过滤
9. 删除岗位 → 验证级联删除
10. 退出登录 → 验证跳转

---

## 完整文件变更矩阵

| 文件 | 操作 | 阶段 |
|------|------|------|
| `package.json` | 修改 | 0.1 |
| `.env.local` / `.env.example` | 修改 | 0.2 |
| `lib/db.ts` | **新建** | 0.3 |
| `types/database.ts` | **新建**（替代 supabase.ts） | 0.4 |
| `types/next-auth.d.ts` | **新建** | 0.4 |
| `lib/auth.ts` | **新建** | 1.1 |
| `app/api/auth/[...nextauth]/route.ts` | **新建** | 1.2 |
| `app/api/auth/register/route.ts` | **新建** | 1.3 |
| `components/providers.tsx` | **新建** | 1.4 |
| `app/layout.tsx` | 修改 | 1.4 |
| `contexts/auth-context.tsx` | 重写 | 1.5 |
| `app/login/page.tsx` | 修改 | 1.6 |
| `middleware.ts` | **新建** | 1.7 |
| `app/api/jobs/[id]/route.ts` | 重写 | 2.1 |
| `app/api/upload-candidate/route.ts` | 重写 | 2.2 |
| `app/api/analyze-candidate/route.ts` | 重写 | 2.3 |
| `app/api/generate-interview-questions/route.ts` | 重写 | 2.4 |
| `app/api/rematch-candidate/route.ts` | 重写 | 2.5 |
| `app/api/jobs/route.ts` | **新建** | 3.1 |
| `app/api/candidates/route.ts` | **新建** | 3.1 |
| `app/api/candidates/[id]/route.ts` | **新建** | 3.1 |
| `app/api/candidates/[id]/analysis/route.ts` | **新建** | 3.1 |
| `app/api/candidates/[id]/questions/route.ts` | **新建** | 3.1 |
| `hooks/use-jobs.ts` | 重写 | 3.2 |
| `hooks/use-analysis.ts` | 重写 | 3.2 |
| `contexts/job-context.tsx` | 重写 | 3.3 |
| `app/candidates/page.tsx` | 重写 | 3.4 |
| `app/candidates/[id]/page.tsx` | 重写 | 3.4 |
| `app/candidates/[id]/analysis/page.tsx` | 重写 | 3.4 |
| `app/candidates/[id]/interview/page.tsx` | 重写 | 3.4 |
| `lib/supabase/` 目录 | **删除** | 5.1 |
| `types/supabase.ts` | **删除**（被 database.ts 替代） | 5.1 |

**无需修改**：`extract-text`、`parse-resume`、`job-matcher`、`analyze-resume`、`generate-interview`（纯 Coze API 或纯文件解析）

---

## 假设与决策

1. **next-auth v4**：使用 v4 而非 v5（Auth.js），因为 v4 与 Next.js 14 App Router 兼容性更好，文档更成熟
2. **UUID 应用层生成**：使用 `uuid.v4()` 在应用层生成，而非依赖数据库 `DEFAULT uuid_generate_v4()`
3. **Session 策略 JWT**：使用无状态 JWT，不使用数据库 session，适合单服务器部署
4. **前端 API 调用**：所有原客户端直连 Supabase 的操作改为调用后端 API 路由，确保数据隔离在服务端执行
5. **auth-context.tsx 保留**：作为薄封装层保留，保持 `useAuth()` API 不变，减少下游组件改动
6. **数据隔离**：所有 API 路由从 session 获取 company_id，不信任前端传值
