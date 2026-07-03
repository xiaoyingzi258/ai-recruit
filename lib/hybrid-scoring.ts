import { query, queryOne } from '@/lib/db'
import { CozeAPI } from '@coze/api'

export interface HardConditionResult {
  passed: boolean
  experience_score: number
  education_score: number
  total_score: number
  max_score: number
  details: {
    name: string
    requirement: string
    candidate_value: string
    matched: boolean
    score: number
    max_score: number
  }[]
}

export interface HybridScoreResult {
  total_score: number
  hard_condition: HardConditionResult
  vector_similarity: { score: number; max_score: number; similarity: number }
  project_exp: { score: number; max_score: number; reason: string; risk_tag?: string }
  risk_penalty: { score: number; max_score: number }
  risk_block: string | null
  match_advantages: string[]
  layer3?: {
    risk_tag?: string
    [key: string]: any
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.VOLCENGINE_API_KEY
  if (!apiKey) {
    throw new Error('VOLCENGINE_API_KEY 环境变量未设置')
  }

  console.log('[Embedding] 开始调用火山引擎 Embedding API...')
  console.log('[Embedding] 输入文本长度:', text.length)

  const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'ep-20260630152829-jtrsb',
      input: [
        {
          type: 'text',
          text: text
        }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`火山引擎 Embedding API 调用失败: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  console.log('[Embedding] API 响应 keys:', Object.keys(data))
  console.log('[Embedding] data.data 内容:', JSON.stringify(data.data).substring(0, 500))

  if (!data.data || !data.data.embedding) {
    throw new Error('火山引擎 Embedding API 返回格式错误：缺少 embedding 字段')
  }

  const embedding = data.data.embedding as number[]
  console.log('[Embedding] 向量维度:', embedding.length)

  return embedding
}

function arrayToVectorString(arr: number[]): string {
  return `[${arr.join(', ')}]`
}

async function generateAndSaveEmbedding(
  text: string,
  type: 'job' | 'candidate',
  id: string
): Promise<number[]> {
  console.log(`[Embedding] 开始为 ${type} 生成 embedding, id: ${id}`)

  const embedding = await generateEmbedding(text)
  const vectorStr = arrayToVectorString(embedding)

  console.log(`[Embedding] 生成成功，向量前 5 维: [${embedding.slice(0, 5).join(', ')}...]`)

  if (type === 'job') {
    await query(
      `UPDATE jobs SET skills_embedding = $1::vector WHERE id = $2`,
      [vectorStr, id]
    )
    console.log(`[Embedding] 已保存到 jobs 表, id: ${id}`)
  } else {
    await query(
      `UPDATE candidates SET skills_embedding = $1::vector WHERE id = $2`,
      [vectorStr, id]
    )
    console.log(`[Embedding] 已保存到 candidates 表, id: ${id}`)
  }

  return embedding
}

function extractSkillsText(text: string): string {
  return text.substring(0, 8000)
}

function educationLevel(edu: string | null): number {
  if (!edu) return 0
  const lower = edu.toLowerCase()
  if (lower.includes('博士')) return 5
  if (lower.includes('硕士') || lower.includes('研究生')) return 4
  if (lower.includes('本科') || lower.includes('学士')) return 3
  if (lower.includes('大专') || lower.includes('专科')) return 2
  if (lower.includes('高中') || lower.includes('中专') || lower.includes('职高')) return 1
  return 0
}

function calculateHardConditionScore(
  minExperience: number,
  candidateExperience: number,
  educationRequirement: string | null,
  candidateEducation: string | null
): HardConditionResult {
  const details: HardConditionResult['details'] = []
  const MAX_EXP_SCORE = 15
  const MAX_EDU_SCORE = 15

  console.log('[Hybrid-L1-Debug] --- 规则 1: 工作经验 ---')

  let expMatched = true
  let expScore = MAX_EXP_SCORE
  let expRawScore = 0
  console.log('[Hybrid-L1-Debug]   岗位要求:', minExperience, '年')
  console.log('[Hybrid-L1-Debug]   候选人:', candidateExperience, '年')

  if (candidateExperience < minExperience) {
    expMatched = false
    expScore = 0
    expRawScore = 0
    console.log('[Hybrid-L1-Debug]   比对: 候选人经验 < 要求年限 → 不达标 ❌')
  } else if (candidateExperience >= minExperience + 3) {
    expScore = MAX_EXP_SCORE
    expRawScore = MAX_EXP_SCORE
    console.log('[Hybrid-L1-Debug]   比对: 超出要求 3 年以上 → 满分 ✅')
  } else {
    expRawScore = Math.round((candidateExperience / Math.max(minExperience, 1)) * MAX_EXP_SCORE)
    expScore = Math.min(expRawScore, MAX_EXP_SCORE)
    console.log('[Hybrid-L1-Debug]   比对: 按比例计算 (', candidateExperience, '/', Math.max(minExperience, 1), ') ×', MAX_EXP_SCORE, '=', expRawScore)
    console.log('[Hybrid-L1-Debug]   封顶后分数:', expScore, '✅')
  }

  console.log('[Hybrid-L1-Debug]   原始计算分数:', expRawScore)
  console.log('[Hybrid-L1-Debug]   最终得分:', expScore, '/', MAX_EXP_SCORE)
  console.log('[Hybrid-L1-Debug]   matched:', expMatched)

  details.push({
    name: '工作经验',
    requirement: `${minExperience} 年以上`,
    candidate_value: `${candidateExperience} 年`,
    matched: expMatched,
    score: expScore,
    max_score: MAX_EXP_SCORE
  })

  console.log('')
  console.log('[Hybrid-L1-Debug] --- 规则 2: 学历要求 ---')

  let eduMatched = true
  let eduScore = MAX_EDU_SCORE
  let eduRawScore = MAX_EDU_SCORE

  if (educationRequirement) {
    const requiredLevel = educationLevel(educationRequirement)
    const candidateLevel = educationLevel(candidateEducation)

    console.log('[Hybrid-L1-Debug]   岗位要求:', educationRequirement, '(等级:', requiredLevel, ')')
    console.log('[Hybrid-L1-Debug]   候选人:', candidateEducation || '未填写', '(等级:', candidateLevel, ')')

    if (candidateLevel < requiredLevel) {
      eduMatched = false
      eduScore = 0
      eduRawScore = 0
      console.log('[Hybrid-L1-Debug]   比对: 候选人学历等级 < 要求等级 → 不达标 ❌')
    } else {
      eduScore = MAX_EDU_SCORE
      eduRawScore = MAX_EDU_SCORE
      console.log('[Hybrid-L1-Debug]   比对: 学历等级达标 → 满分 ✅')
    }

    console.log('[Hybrid-L1-Debug]   原始计算分数:', eduRawScore)
    console.log('[Hybrid-L1-Debug]   最终得分:', eduScore, '/', MAX_EDU_SCORE)
    console.log('[Hybrid-L1-Debug]   matched:', eduMatched)

    details.push({
      name: '学历要求',
      requirement: educationRequirement,
      candidate_value: candidateEducation || '未填写',
      matched: eduMatched,
      score: eduScore,
      max_score: MAX_EDU_SCORE
    })
  } else {
    eduScore = MAX_EDU_SCORE
    eduRawScore = MAX_EDU_SCORE
    console.log('[Hybrid-L1-Debug]   岗位无学历要求 → 默认满分 ✅')
    console.log('[Hybrid-L1-Debug]   候选人:', candidateEducation || '未填写')
    console.log('[Hybrid-L1-Debug]   最终得分:', eduScore, '/', MAX_EDU_SCORE)
    console.log('[Hybrid-L1-Debug]   matched: true')

    details.push({
      name: '学历要求',
      requirement: '无要求',
      candidate_value: candidateEducation || '未填写',
      matched: true,
      score: eduScore,
      max_score: MAX_EDU_SCORE
    })
  }

  const passed = expMatched && eduMatched
  const totalScore = expScore + eduScore

  return {
    passed,
    experience_score: expScore,
    education_score: eduScore,
    total_score: totalScore,
    max_score: MAX_EXP_SCORE + MAX_EDU_SCORE,
    details
  }
}

async function calculateVectorScore(
  candidateId: string,
  jobId: string
): Promise<{ score: number; max_score: number; similarity: number }> {
  const MAX_VECTOR_SCORE = 40

  console.log('[Vector] 计算向量相似度...')

  const result = await queryOne<any>(
    `SELECT 
      1 - (c.skills_embedding <=> j.skills_embedding) AS similarity
    FROM candidates c
    CROSS JOIN jobs j
    WHERE c.id = $1 AND j.id = $2`,
    [candidateId, jobId]
  )

  if (!result) {
    console.warn('[Vector] 未找到向量数据，返回 0 分')
    return { score: 0, max_score: MAX_VECTOR_SCORE, similarity: 0 }
  }

  const similarity = result.similarity || 0
  const score = Math.round(similarity * MAX_VECTOR_SCORE * 100) / 100

  console.log('[Vector] 相似度:', similarity.toFixed(4), '得分:', score)

  return {
    score,
    max_score: MAX_VECTOR_SCORE,
    similarity
  }
}

interface LLMResult {
  project_score: number
  risk_score: number
  reason: string
  risk_tag: string
  match_advantages: string[]
}

async function calculateLLMScore(
  candidateParsedData: any,
  jobDescription: string
): Promise<LLMResult> {
  const cozeToken = process.env.COZE_API_KEY
  if (!cozeToken) {
    throw new Error('COZE_API_KEY 环境变量未设置')
  }

  console.log('[LLM] 开始调用 Coze 工作流进行项目经验评估...')

  const coze = new CozeAPI({
    token: cozeToken,
    baseURL: 'https://api.coze.cn'
  })

  const resumeText = typeof candidateParsedData === 'string'
    ? candidateParsedData
    : JSON.stringify(candidateParsedData, null, 2)

  const prompt = `请根据以下简历信息和岗位要求，评估候选人的项目经验匹配度和风险因素。

## 简历信息：
${resumeText.substring(0, 5000)}

## 岗位要求：
${jobDescription.substring(0, 3000)}

## 评估要求：
请严格按照以下 JSON 格式返回评估结果：
{
  "project_score": 0-30之间的数字，表示项目经验得分（考虑项目相关性、技术复杂度、成果贡献）,
  "risk_score": 0-30之间的数字，表示风险评估得分（考虑稳定性、简历真实性、潜在风险），注意：risk_score 越高表示风险越大，应该从总分中扣除,
  "reason": "详细的分析原因，说明评分的依据"
}

评分标准：
- project_score (0-30分)：项目经验与岗位的匹配程度
  - 25-30分：项目高度相关，技术栈完全匹配，有显著成果
  - 15-24分：项目相关性较好，技术栈大部分匹配
  - 5-14分：项目有一定相关性，但存在差距
  - 0-4分：项目经验与岗位要求严重不匹配

- risk_score (0-30分，越高风险越大)：
  - 0-10分：风险低，简历信息真实，职业轨迹稳定
  - 11-20分：风险中等，存在一些需要核实的疑点
  - 21-30分：高风险，简历可能存在问题或职业不稳定`

  const stream = await coze.workflows.runs.stream({
    workflow_id: '7642566426397655059',
    parameters: {
      resume_data: prompt,
      jd_text: jobDescription
    }
  })

  let result = ''
  for await (const chunk of stream) {
    const data = chunk.data as any
    if (data?.content) {
      result += data.content
    }
  }

  console.log('[LLM] Coze 返回原始内容长度:', result.length)

  let llmResult: LLMResult = {
    project_score: 15,
    risk_score: 10,
    reason: 'LLM 评估结果解析失败，使用默认分数',
    risk_tag: '低风险',
    match_advantages: []
  }

  try {
    console.log("[LLM-Debug] Coze 真实返回的文本:", result)

    let cleanText = result;
    const jsonMatch = cleanText.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      cleanText = jsonMatch[1];
    } else {
      const plainMatch = cleanText.match(/```\n([\s\S]*?)\n```/);
      if (plainMatch) cleanText = plainMatch[1];
    }
    cleanText = cleanText.trim();

    const jsonObjectMatch = cleanText.match(/\{[\s\S]*\}/)
    if (jsonObjectMatch && jsonObjectMatch[0]) {
      let parsed = JSON.parse(jsonObjectMatch[0])

      // 剥离 Coze 工作流外层的 output 壳
      if (parsed && typeof parsed === 'object' && parsed.output) {
        parsed = parsed.output;
      }

      const project_score = typeof parsed.project_score === 'number' ? parsed.project_score : 15;
      const risk_score = typeof parsed.risk_score === 'number' ? parsed.risk_score : 10;
      const reason = parsed.reason || '无详细分析';
      const risk_tag = parsed.risk_tag || '低风险';
      const match_advantages = Array.isArray(parsed.match_advantages) ? parsed.match_advantages : [];

      llmResult = {
        project_score: Math.max(0, Math.min(30, project_score)),
        risk_score: Math.max(0, Math.min(30, risk_score)),
        reason,
        risk_tag,
        match_advantages
      }
    }
  } catch (e) {
    console.warn('[LLM] JSON 解析失败:', e)
    if (result.includes('项目经验与岗位要求严重不匹配')) {
      llmResult.project_score = 5
    } else if (result.includes('项目高度相关')) {
      llmResult.project_score = 27
    }
  }

  console.log('[LLM] 评估结果:', JSON.stringify(llmResult))

  return llmResult
}

export function deepParseJSON(value: any): any {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    const firstChar = trimmed.charAt(0)
    if (firstChar === '{' || firstChar === '[' || firstChar === '"') {
      try {
        const parsed = JSON.parse(trimmed)
        return deepParseJSON(parsed)
      } catch {
        return value
      }
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map(item => deepParseJSON(item))
  }
  if (typeof value === 'object') {
    const result: Record<string, any> = {}
    for (const key of Object.keys(value)) {
      result[key] = deepParseJSON(value[key])
    }
    return result
  }
  return value
}

export function serializeForJSON(value: any): string {
  try {
    const cleaned = deepParseJSON(value)
    const str = JSON.stringify(cleaned ?? null)
    JSON.parse(str)
    return str
  } catch (e) {
    console.warn('[serializeForJSON] 序列化失败:', e)
    return JSON.stringify({ text: String(value ?? '').substring(0, 10000) })
  }
}

export async function calculateHybridScore(
  candidateId: string,
  jobId: string,
  companyId: string
): Promise<HybridScoreResult> {
  console.log('\n========== [Hybrid Scoring] 开始计算混合打分 ==========')
  console.log('candidate_id:', candidateId)
  console.log('job_id:', jobId)

  const job = await queryOne<any>(
    `SELECT * FROM jobs WHERE id = $1 AND company_id = $2`,
    [jobId, companyId]
  )

  if (!job) {
    throw new Error('岗位不存在')
  }

  const candidate = await queryOne<any>(
    `SELECT * FROM candidates WHERE id = $1 AND company_id = $2`,
    [candidateId, companyId]
  )

  if (!candidate) {
    throw new Error('候选人不存在')
  }

  console.log('[Hybrid] 岗位:', job.title)
  console.log('[Hybrid] 候选人:', candidate.name)

  console.log('[Hybrid] 检查 Embedding 是否需要生成...')

  if (!job.skills_embedding) {
    console.log("⚠️ [三层引擎 - 兜底] 发现向量为空，触发火山引擎 Embedding 生成...")
    console.log('[Hybrid] 岗位缺少 embedding，开始生成...')
    const jobText = extractSkillsText(job.jd_text || job.title || '')
    await generateAndSaveEmbedding(jobText, 'job', jobId)
  } else {
    console.log('[Hybrid] 岗位已有 embedding')
  }

  if (!candidate.skills_embedding) {
    console.log("⚠️ [三层引擎 - 兜底] 发现向量为空，触发火山引擎 Embedding 生成...")
    console.log('[Hybrid] 候选人缺少 embedding，开始生成...')
    const parsedData = deepParseJSON(candidate.parsed_data)
    const skillsText = parsedData
      ? JSON.stringify(parsedData).substring(0, 8000)
      : (candidate.raw_text || '')
    await generateAndSaveEmbedding(skillsText, 'candidate', candidateId)
  } else {
    console.log('[Hybrid] 候选人已有 embedding')
  }

  console.log("🚀 [三层引擎 - Layer 1] 开始规则校验，比对学历和年限...")
  console.log('[Hybrid] 第一层：规则校验...')

  const minExperience = job.min_experience || 0
  const candidateExperience = candidate.experience_years || 0
  const educationRequirement = job.education_requirement || job.min_education || null
  const candidateEducation = candidate.education

  console.log('[Layer1-Input] 岗位要求 → min_experience:', minExperience, ', education_requirement:', `"${educationRequirement || ''}"`)
  console.log('[Layer1-Input] 候选人 → experience_years:', candidateExperience, ', education:', `"${candidateEducation || ''}"`)

  const MAX_EXP_SCORE = 15
  const MAX_EDU_SCORE = 15

  console.log('\n' + '='.repeat(60))
  console.log('[Hybrid-L1-Debug] ======== Layer 1 规则校验开始 ========')
  console.log('='.repeat(60))
  console.log('[Hybrid-L1-Debug] 【输入参数】')
  console.log('  岗位 min_experience (jobs.min_experience):', minExperience, minExperience === 0 ? '⚠️ (默认值 0)' : '')
  console.log('  岗位 education_requirement (jobs.education_requirement):', educationRequirement, (educationRequirement === null || educationRequirement === undefined || educationRequirement === '') ? '⚠️ (为空/未设置，已回退 min_education)' : '')
  console.log('  候选人 experience_years (candidates.experience_years):', candidateExperience, candidateExperience === 0 ? '⚠️ (默认值 0)' : '')
  console.log('  候选人 education (candidates.education):', candidateEducation || '(空)', (!candidateEducation) ? '⚠️ (为空/未设置)' : '')
  console.log('[Hybrid-L1-Debug] 【评分权重配置】')
  console.log('  经验满分:', MAX_EXP_SCORE, '分')
  console.log('  学历满分:', MAX_EDU_SCORE, '分')
  console.log('  Layer 1 总分:', MAX_EXP_SCORE + MAX_EDU_SCORE, '分')
  console.log('-'.repeat(60))
  console.log('[Hybrid-L1-Debug] 【逐条规则比对】')

  const hardConditionResult = calculateHardConditionScore(
    minExperience,
    candidateExperience,
    educationRequirement,
    candidateEducation
  )

  console.log('-'.repeat(60))
  console.log('[Hybrid-L1-Debug] 【规则校验汇总】')
  console.log('[Hybrid-L1-Debug] 各规则得分明细:')
  hardConditionResult.details.forEach((d, i) => {
    console.log(`  ${i + 1}. ${d.name}: ${d.score}/${d.max_score}  (matched: ${d.matched})`)
  })
  console.log('[Hybrid-L1-Debug] Layer 1 总分:', hardConditionResult.total_score, '/', hardConditionResult.max_score)
  console.log('[Hybrid-L1-Debug] passed 判定:', hardConditionResult.passed ? '✅ 通过' : '❌ 不通过')
  console.log('='.repeat(60) + '\n')

  console.log('[Hybrid] 规则校验结果:', JSON.stringify(hardConditionResult))

  if (!hardConditionResult.passed) {
    console.log('[Hybrid] ⚠️ 规则校验不通过，标记为淘汰')
    return {
      total_score: 0,
      hard_condition: hardConditionResult,
      vector_similarity: { score: 0, max_score: 40, similarity: 0 },
      project_exp: { score: 0, max_score: 30, reason: '未通过硬性条件筛选' },
      risk_penalty: { score: 0, max_score: 30 },
      risk_block: '未通过工作经验或学历要求',
      match_advantages: []
    }
  }

  console.log("📐 [三层引擎 - Layer 2] 开始 SQL 向量检索，计算余弦相似度...")
  console.log('[Hybrid] 第二层：向量检索...')

  const vectorScoreResult = await calculateVectorScore(candidateId, jobId)

  console.log("🧠 [三层引擎 - Layer 3] 开始大模型深度推理，已发送 Coze...")
  console.log('[Hybrid] 第三层：LLM 推理...')

  const parsedData = deepParseJSON(candidate.parsed_data)
  const llmResult = await calculateLLMScore(parsedData, job.jd_text || '')

  const projectExpScore = llmResult.project_score
  const riskPenaltyScore = llmResult.risk_score

  const adjustedProjectScore = Math.max(0, projectExpScore - riskPenaltyScore)

  const totalScore =
    hardConditionResult.total_score +
    vectorScoreResult.score +
    adjustedProjectScore

  const matchAdvantages = llmResult.match_advantages || []

  console.log('[Hybrid] 最终得分汇总:')
  console.log('  - 硬性条件分:', hardConditionResult.total_score, '/ 30')
  console.log('  - 向量相似度分:', vectorScoreResult.score, '/ 40')
  console.log('  - 项目经验分:', adjustedProjectScore, '/ 30 (原始:', projectExpScore, '- 风险扣分:', riskPenaltyScore, ')')
  console.log('  - 总分:', totalScore)
  console.log("✅ [三层引擎 - 汇总] 总分计算完成:", { totalScore, layer1: hardConditionResult.total_score, layer2: vectorScoreResult.score, layer3: adjustedProjectScore })

  return {
    total_score: totalScore,
    hard_condition: hardConditionResult,
    vector_similarity: vectorScoreResult,
    project_exp: {
      score: adjustedProjectScore,
      max_score: 30,
      reason: llmResult.reason
    },
    risk_penalty: {
      score: riskPenaltyScore,
      max_score: 30
    },
    risk_block: riskPenaltyScore >= 20 ? '风险评分过高' : null,
    match_advantages: matchAdvantages
  }
}
