# 替换旧打分引擎为三层混合引擎 - 实施计划

## 一、Repo 研究结论

### 1.1 现状分析

**upload-candidate 接口**（[route.ts](file:///Users/liangying/Desktop/project/github/ai-recruit/app/api/upload-candidate/route.ts)）目前流程：
1. 步骤 1-3：文件解析 + Coze 简历解析工作流（保留）
2. **步骤 4（需替换）**：调用旧的单层 Coze 人岗匹配工作流（workflow_id: `7642566426397655059`）
3. 步骤 5：写入 candidates 表 + match_results 表

**hybrid-scoring-engine 接口**（[route.ts](file:///Users/liangying/Desktop/project/github/ai-recruit/app/api/hybrid-scoring-engine/route.ts)）：
- 已实现 `calculateHybridScore` 主函数，但**未 export**
- 三层引擎已实现，但缺少用户要求的标志性 console.log
- 已有独立的 API 路由入口

### 1.2 关键问题

1. `calculateHybridScore` 函数未 export，无法被其他模块 import
2. upload-candidate 的步骤 4 仍在使用旧的 Coze 工作流
3. 缺少用户要求的 5 个标志性 console.log
4. upload-candidate 中候选人的 `experience` 和 `education` 字段未写入，会导致规则校验失效

---

## 二、需要修改的文件

| 文件 | 操作类型 | 说明 |
|------|----------|------|
| `app/api/hybrid-scoring-engine/route.ts` | 修改 | export calculateHybridScore + 添加 console.log |
| `app/api/upload-candidate/route.ts` | 修改 | 替换旧 Coze 匹配为 calculateHybridScore 调用 |

---

## 三、修改步骤

### 步骤 1：修改 hybrid-scoring-engine/route.ts

**1.1 export calculateHybridScore 函数**
- 将 `async function calculateHybridScore` 改为 `export async function calculateHybridScore`
- 同时 export 相关 TypeScript 类型（HardConditionResult 等）

**1.2 添加 5 个标志性 console.log**

| 位置 | 日志内容 |
|------|----------|
| 第一层规则校验开始前 | `console.log("🚀 [三层引擎 - Layer 1] 开始规则校验，比对学历和年限...")` |
| 惰性生成 Embedding 时（岗位和候选人各一处） | `console.log("⚠️ [三层引擎 - 兜底] 发现向量为空，触发火山引擎 Embedding 生成...")` |
| 第二层向量检索开始前 | `console.log("📐 [三层引擎 - Layer 2] 开始 SQL 向量检索，计算余弦相似度...")` |
| 第三层 LLM 推理开始前 | `console.log("🧠 [三层引擎 - Layer 3] 开始大模型深度推理，已发送 Coze...")` |
| 最终得分汇总后 | `console.log("✅ [三层引擎 - 汇总] 总分计算完成:", { totalScore: ... })` |

---

### 步骤 2：修改 upload-candidate/route.ts

**2.1 新增 import**
```typescript
import { calculateHybridScore } from '@/app/api/hybrid-scoring-engine/route'
```

**2.2 移除旧的 Coze 匹配调用（步骤 4）**
- 删除：`const matchStream = await coze.workflows.runs.stream({...})` 及整个流处理逻辑
- 删除：`let matchResult = ''`、`let matchChunkCount = 0` 等变量
- 删除：`let matchData: any = null` 及 JSON 解析逻辑
- 删除：所有 `matchData` 的默认值填充和字段检查代码

**2.3 替换为 calculateHybridScore 调用**
- 保持进度通知（sendProgress(4, 'start') 和 sendProgress(4, 'done')）
- 在步骤 4 位置调用 `calculateHybridScore(candidateId, jobId, companyId)`
- **注意**：调用时机在候选人 INSERT 之后（因为需要 candidate.id），所以需要调整步骤顺序
- 调整后步骤顺序：
  1. 文件读取
  2. 文本解析
  3. Coze 简历解析
  4. INSERT candidates 表
  5. 调用 calculateHybridScore（步骤 4 的进度）
  6. INSERT match_results 表（步骤 5 的进度）

**2.4 写入候选人的 experience 和 education 字段**
- 从 `parsedData` 中提取工作年限和学历
- 在 INSERT candidates 时同时写入 `experience` 和 `education` 字段
- 工作年限：从 `parsedData.work_years` 或 `parsedData.personal_info?.work_years` 解析数字
- 学历：从 `parsedData.degree_level` 或 `parsedData.education?.[0]?.degree` 提取

**2.5 组装 match_results 数据结构（保持前端兼容）**
- 将 calculateHybridScore 返回的结果映射到 match_results 表的字段：
  - `total_score` → 直接使用
  - `hard_condition` → 使用 `scoringResult.hard_condition`
  - `tech_skill` → 包装为 `{ vector_similarity, total_score }` 格式，兼容旧结构
  - `project_exp` → 使用 `scoringResult.project_exp`
  - `risk_penalty` → 使用 `scoringResult.risk_penalty`
  - `risk_block` → 直接使用
  - `match_advantages` → 直接使用
  - `risk_tag` → 从 risk_penalty 推导（如 "高风险"、"中风险"、"低风险"）

**2.6 保持 SSE 流式响应和返回结构不变**
- `sendSuccess({ candidate, matchResult: matchData })` 结构不变
- `matchData` 字段保持与旧版兼容的形状

---

## 四、潜在依赖和注意事项

### 4.1 调用时序调整
原流程是先算分再 INSERT 候选人，现在改为先 INSERT 候选人再算分（因为 calculateHybridScore 需要从数据库查询候选人）。这是必要的调整，因为：
- calculateHybridScore 内部会从数据库查询 candidates 和 jobs
- 候选人的 experience/education 字段需要先写入才能用于规则校验

### 4.2 数据兼容性
- `tech_skill` 字段在旧版本中是技能匹配详情，新版本包装了向量相似度信息
- 前端如果直接访问 tech_skill 的子字段，需要确保不会报错
- 包装策略：`{ vector_similarity: {...}, matched_skills: [], missing_skills: [], total_score: ... }`

### 4.3 环境变量
确保以下环境变量已配置：
- `VOLCENGINE_API_KEY` - 火山引擎 Embedding API
- `COZE_API_KEY` - Coze API（复用现有）
- `DATABASE_URL` - 数据库连接（复用现有）

### 4.4 数据库字段
确保已执行上一次的 SQL 迁移脚本，以下字段存在：
- jobs: `skills_embedding`, `min_experience`, `education_requirement`
- candidates: `skills_embedding`, `experience`, `education`

---

## 五、风险处理

### 5.1 风险：前端 tech_skill 字段不兼容
**风险描述**：旧版 tech_skill 包含 matched_skills 等数组，新版只有向量信息
**处理方案**：
- tech_skill 中保留空的 matched_skills、missing_skills、extra_skills 数组
- 保持 total_score 字段存在
- 新增 vector_similarity 字段作为扩展

### 5.2 风险：首次调用 Embedding 较慢
**风险描述**：首次上传简历时，岗位和候选人都需要生成 Embedding，耗时较长
**处理方案**：
- 进度条步骤文案调整为"AI深度分析中"
- 这是预期行为，用户可以在控制台看到 Embedding 生成日志

### 5.3 风险：规则校验依赖 experience/education 字段
**风险描述**：如果 parsed_data 中没有工作年限或学历，规则校验会不准确
**处理方案**：
- 从多个可能的字段提取（work_years、degree_level、education[0].degree）
- 提取失败时默认为 0 年 / 空字符串
- 日志中记录提取结果，方便排查

### 5.4 回滚方案
如遇问题，可通过 git revert 恢复旧版代码
- upload-candidate 回退到旧的 Coze 工作流调用
- hybrid-scoring-engine 保持不变但不被调用

---

## 六、验证清单

1. ✅ upload-candidate 不再调用旧的 Coze 匹配工作流
2. ✅ calculateHybridScore 已被 export
3. ✅ 5 个标志性 console.log 都已添加
4. ✅ candidates 表写入 experience 和 education 字段
5. ✅ match_results 表结构与前端兼容
6. ✅ SSE 流式响应正常
7. ✅ 控制台能看到三层引擎的日志输出
