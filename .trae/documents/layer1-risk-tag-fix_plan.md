# Layer 1 淘汰候选人风险标签修复计划

## 一、现状确认

### 当前代码位置
[upload-candidate/route.ts:427-429](file:///Users/liangying/Desktop/project/github/ai-recruit/app/api/upload-candidate/route.ts#L427-L429)

```typescript
// 使用大模型返回的 risk_tag
const riskTag = scoringResult.layer3?.risk_tag || '低风险'
console.log('[步骤4] 风险标签（来自大模型）:', riskTag)
```

### 问题
1. **字段不存在**：`calculateHybridScore` 返回的结果结构中没有 `layer3` 字段，也没有 `risk_tag` 字段（返回的是 `risk_penalty` 和 `risk_block`），导致 `scoringResult.layer3?.risk_tag` 永远是 `undefined`
2. **默认值不合理**：Layer 1 被淘汰的候选人（0分）最终会显示"低风险"，业务逻辑矛盾

### hard_condition.details 结构确认
| 字段 | 类型 | 值示例 |
|------|------|--------|
| name | string | "工作经验" / "学历要求" |
| matched | boolean | true/false |
| score | number | 0-15 |
| requirement | string | "3 年以上" / "本科" |
| candidate_value | string | "5 年" / "硕士" |

---

## 二、修改文件

| 文件 | 操作 |
|------|------|
| `app/api/upload-candidate/route.ts` | 修改 riskTag 赋值逻辑，增加 Layer 1 淘汰拦截 |

---

## 三、具体修改内容

将 [upload-candidate/route.ts:427-429](file:///Users/liangying/Desktop/project/github/ai-recruit/app/api/upload-candidate/route.ts#L427-L429) 原代码：

```typescript
// 使用大模型返回的 risk_tag
const riskTag = scoringResult.layer3?.risk_tag || '低风险'
console.log('[步骤4] 风险标签（来自大模型）:', riskTag)
```

替换为：

```typescript
// 风险标签动态逻辑
let riskTag = '低风险'

// 风险标签优先从风险扣分推导（Layer 3 生效时）
const riskPenaltyScore = scoringResult.risk_penalty?.score || 0
if (riskPenaltyScore >= 20) {
  riskTag = '高风险'
} else if (riskPenaltyScore >= 10) {
  riskTag = '中风险'
}

// 拦截 Layer 1 淘汰者，覆盖风险标签
if (scoringResult.hard_condition && !scoringResult.hard_condition.passed) {
  const failedDetails = scoringResult.hard_condition.details.filter((d: any) => !d.matched)
  const failedNames = failedDetails.map((d: any) => d.name)
  console.log('[步骤4] Layer 1 淘汰，未通过项:', failedNames)

  if (failedNames.includes('学历要求') && failedNames.includes('工作经验')) {
    riskTag = '学历与经验不符'
  } else if (failedNames.includes('学历要求')) {
    riskTag = '学历不符'
  } else if (failedNames.includes('工作经验')) {
    riskTag = '经验不足'
  } else {
    riskTag = '硬性条件不符'
  }
}

console.log('[步骤4] 最终风险标签:', riskTag)
```

### 标签优先级说明
1. 默认 "低风险"
2. 如果通过了 Layer 1，根据 Layer 3 的 risk_penalty.score 推导：≥20→高风险，≥10→中风险
3. 如果 Layer 1 被淘汰（hard_condition.passed=false），强制覆盖为淘汰原因标签，优先级最高

---

## 四、风险与注意事项

1. **向后兼容**：修改后的逻辑使用了 `scoringResult.risk_penalty` 和 `scoringResult.hard_condition`，这两个字段在现有 `calculateHybridScore` 返回值中都存在，兼容正常通过和被淘汰两种场景
2. **日志增强**：添加了 `[步骤4] Layer 1 淘汰，未通过项:` 日志，便于调试确认哪些规则失败
3. **不改动其他逻辑**：只修改 riskTag 赋值和相关 console.log，不改动数据库 UPDATE、matchData 组装等其他代码
