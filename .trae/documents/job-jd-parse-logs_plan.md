# 岗位 JD 解析工作流添加详细日志 - 实施计划

## 一、确认结论

**✅ 是的，编辑岗位和添加岗位功能都调用了 workflow_id=7657221050028507177 工作流来获取 JSON 并存入数据库。**

涉及的两个 API 路由：

| API 路由 | 方法 | 功能 | 工作流调用位置 |
|---------|------|------|--------------|
| `app/api/jobs/route.ts` | POST | 添加岗位 | [第 75-78 行](file:///Users/liangying/Desktop/project/github/ai-recruit/app/api/jobs/route.ts#L75-L78) |
| `app/api/jobs/[id]/route.ts` | PATCH | 编辑岗位 | [第 119-122 行](file:///Users/liangying/Desktop/project/github/ai-recruit/app/api/jobs/%5Bid%5D/route.ts#L119-L122) |

### 当前数据流转步骤

**添加岗位（POST /api/jobs）：**
1. 接收前端请求：`title`, `jd_text`, `status`
2. 调用 Coze 工作流 `7657221050028507177`，传入 `jd_text`
3. 流式接收响应，拼接完整 JSON
4. 解析 JSON，尝试提取 `output` / `data` / `result` 字段
5. 从解析结果中提取字段：
   - `min_experience` → minExperience
   - `min_education` → minEducation
   - `min_salary` / `max_salary` → minSalary / maxSalary
   - `location` → location
   - `core_skills` → coreSkills
   - 完整对象 → parsedData
6. INSERT INTO jobs 表

**编辑岗位（PATCH /api/jobs/[id]）：**
- 流程类似，但只有 jd_text 变化时才重新解析
- UPDATE jobs 表

### 当前已有的日志
- 开始解析提示
- Coze 原始响应长度
- 提取结果（6 个字段）

---

## 二、需要修改的文件

| 文件 | 操作 |
|------|------|
| `app/api/jobs/route.ts` | 添加详细 step-by-step console.log |
| `app/api/jobs/[id]/route.ts` | 添加详细 step-by-step console.log |

---

## 三、修改内容（两个文件都添加相同模式的日志）

### 步骤 1：接收请求参数
```typescript
console.log('[JD解析] 步骤1 - 接收请求参数:')
console.log('  title:', title)
console.log('  jd_text 长度:', jd_text?.length)
console.log('  jd_text 前200字:', jd_text?.substring(0, 200))
```

### 步骤 2：调用 Coze 工作流前
```typescript
console.log('[JD解析] 步骤2 - 准备调用 Coze 工作流:')
console.log('  workflow_id: 7657221050028507177')
console.log('  参数 jd_text 长度:', jd_text.length)
```

### 步骤 3：流式接收中（统计 chunk 数量）
```typescript
let chunkCount = 0
// ... 在 for 循环内
chunkCount++
// ... 循环结束后
console.log('[JD解析] 步骤3 - Coze 流式响应接收完成:')
console.log('  chunk 总数:', chunkCount)
console.log('  响应总长度:', parseResult.length)
console.log('  响应全文前500字:', parseResult.substring(0, 500))
```

### 步骤 4：JSON 解析
```typescript
console.log('[JD解析] 步骤4 - 开始解析 JSON:')
console.log('  原始响应 top-level keys:', Object.keys(parsedOutput || {}))
console.log('  是否有 output 字段:', !!parsedOutput?.output)
console.log('  是否有 data 字段:', !!parsedOutput?.data)
console.log('  是否有 result 字段:', !!parsedOutput?.result)
console.log('  最终解析结果 keys:', parsedOutput ? Object.keys(parsedOutput) : 'null')
console.log('  解析结果完整内容前1000字:', JSON.stringify(parsedOutput).substring(0, 1000))
```

### 步骤 5：字段提取
```typescript
console.log('[JD解析] 步骤5 - 字段提取结果:')
console.log('  min_experience:', minExperience, '(原始值:', parsedOutput?.min_experience, ')')
console.log('  min_education:', minEducation, '(原始值:', parsedOutput?.min_education, ')')
console.log('  min_salary:', minSalary, '(原始值:', parsedOutput?.min_salary, ')')
console.log('  max_salary:', maxSalary, '(原始值:', parsedOutput?.max_salary, ')')
console.log('  location:', location, '(原始值:', parsedOutput?.location, ')')
console.log('  core_skills 数量:', coreSkills?.length, '(原始值:', JSON.stringify(parsedOutput?.core_skills).substring(0, 200), ')')
```

### 步骤 6：写入数据库前
```typescript
console.log('[JD解析] 步骤6 - 即将写入数据库:')
console.log('  写入的 min_experience:', minExperience)
console.log('  写入的 min_education:', minEducation)
console.log('  写入的 min_salary:', minSalary)
console.log('  写入的 max_salary:', maxSalary)
console.log('  写入的 location:', location)
console.log('  写入的 core_skills:', JSON.stringify(coreSkills))
console.log('  写入的 parsed_data 长度:', JSON.stringify(parsedData)?.length)
```

### 步骤 7：写入数据库后
```typescript
console.log('[JD解析] 步骤7 - 数据库写入完成 ✅')
console.log('  岗位 ID:', newJob?.id || data?.id)
```

---

## 四、潜在注意事项

1. **日志量较大**：每个岗位解析会输出 ~20 行日志，便于调试
2. **敏感信息**：JD 文本可能包含敏感信息，日志中只截取前 200-500 字
3. **两个文件逻辑基本一致**：PATCH 版本只有在 jd_text 变化时才触发解析
4. **错误场景也有日志**：JSON 解析失败和 API 调用失败都有 warn/error 日志

---

## 五、验证清单

1. ✅ 两个 API 都有步骤 1-7 的完整日志
2. ✅ 日志带 `[JD解析] 步骤X` 前缀，便于搜索过滤
3. ✅ 包含原始值和最终写入值的对比
4. ✅ 响应全文截取，避免日志过长
