# AI 招聘助手 

## 📒项目PRD文档：https://my.feishu.cn/wiki/LJ7kwVeoaieZ4Hk1Pg1cMMZfnxh?from=from_copylink
## 🎥项目演示视频：https://my.feishu.cn/wiki/MYB1wtquViEDHlkD4kpcnY3Onad?from=from_copylink

> 这是一个基于 Next.js 和大模型技术的全栈实践项目，旨在探索 LLM 与向量检索技术在 B 端人力资源场景中的落地，重点解决 AI 评估过程中的“黑盒化”与“数据可解释性”问题。

## 🎯 项目背景与解决痛点

在传统的 AI 简历筛选中，系统往往只给出一个冷冰冰的匹配分数，HR 难以信任且无法追溯扣分原因。本项目通过引入**三层混合打分引擎**与**动态语义化 UI**，将底层复杂的 AI 算力转化为前端高度透明、逻辑严密的数据看板。

## 🛠️ 核心业务架构

### 1. 三层混合打分引擎 (Hybrid Scoring Engine)
为避免单一的大模型 API 带来的高延迟与幻觉问题，系统设计了解耦的评估链路：
- **Layer 1 (规则过滤)**：硬性指标（如学历、年限）快速拦截。若不达标则触发“一票否决”，直接拦截后续 AI 算力。
- **Layer 2 (向量匹配)**：通过接入 2048 维度的 Embedding 接口，计算简历技能栈与岗位要求的余弦相似度。
- **Layer 3 (LLM 推理)**：处理非结构化项目经验，识别“频繁跳槽”、“跨行”等潜在风险并进行量化扣分。

### 2. 数据库设计 (PostgreSQL + JSONB)
- 采用“实体表 + 业务结果表”分离设计。候选人基础信息存储于常规字段，而三层引擎的打分明细及风险分析，利用 PG 的 `JSONB` 类型进行结构化存储，兼顾了查询性能与数据扩展性。

### 3. 可解释性 UI 设计 (Data Visualization)
- **动态算分悬浮舱 (Popover)**：针对 B 端场景定制开发，精准解析 JSONB 数据并还原“税前得分-风险折损”的底层逻辑，解决“视觉数学不自洽”问题，实现全链路透明。
- **溢出与边界处理**：修复了复杂的 Table 嵌套容器下的 CSS Overflow 截断问题，并针对“0分淘汰”等边缘场景（Edge Cases）做了一致性拦截渲染。

### 4. 容错与安全机制
- **网关层降级设计**：针对第三方 LLM 接口可能出现的超时问题，设计了优雅降级策略，保障核心业务列表的可用性。
- **数据脱敏**：基于 RBAC 权限设计，预留了敏感字段（手机号、邮箱）的动态打码机制。

---

## 💻 技术栈

- **前端**: Next.js (App Router), React, TypeScript, Tailwind CSS
- **后端**: Node.js, Next API Routes
- **数据库**: PostgreSQL, Supabase (已重构为原生 PG 交互)
- **鉴权**: NextAuth.js
- **AI 接口**: 
  - 向量化: 火山引擎 (Volcengine) API
  - 大语言模型: Coze 智能体工作流

---

## 🚀 本地运行指南

npm install

npm run dev
