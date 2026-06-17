import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { CozeAPI } from '@coze/api'

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.error === 'string') return obj.error
    if (typeof obj.code === 'string' && typeof obj.details === 'string') {
      return `${obj.code}: ${obj.details}`
    }
    try { return JSON.stringify(err) } catch {}
  }
  return String(err ?? '深度解析失败')
}

function deepParseJSON(value: any): any {
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

function toJSONObjectForPG(value: any): Record<string, any> {
  if (value === null || value === undefined) return {}
  const parsed = deepParseJSON(value)
  if (parsed === null || parsed === undefined) return {}
  if (typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed
  }
  if (Array.isArray(parsed)) {
    return { data: parsed }
  }
  return { text: String(parsed) }
}

function toJSONArrayForPG(value: any): any[] {
  if (value === null || value === undefined) return []
  const parsed = deepParseJSON(value)
  if (parsed === null || parsed === undefined) return []
  if (Array.isArray(parsed)) {
    return parsed
  }
  if (typeof parsed === 'object') {
    return [parsed]
  }
  return [{ text: String(parsed) }]
}

function cleanJSONForStorage(value: any): any {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return deepParseJSON(value)
  return deepParseJSON(value)
}

function serializeForJSON(value: any): string {
  try {
    const cleaned = deepParseJSON(value)
    const str = JSON.stringify(cleaned ?? null)
    JSON.parse(str)
    return str
  } catch (e) {
    console.warn('[serializeForJSON] 序列化失败:', e, '原始值:', typeof value, String(value).substring(0, 200))
    return JSON.stringify({ text: String(value ?? '').substring(0, 10000) })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const companyId = session.user.company_id

    const body = await request.json()
    const { candidate_id, job_id, job_description, force } = body

    if (!candidate_id || !job_id || !job_description) {
      return NextResponse.json(
        { error: '缺少必要参数：candidate_id, job_id, job_description' },
        { status: 400 }
      )
    }

    if (!force) {
      const existingAnalysis = await queryOne<any>(
        `SELECT * FROM analysis_results WHERE candidate_id = $1 LIMIT 1`,
        [candidate_id]
      )

      if (existingAnalysis) {
        return NextResponse.json({
          success: true,
          data: existingAnalysis,
          from_cache: true
        })
      }
    }

    console.log('[analyze-candidate] 步骤1: 获取候选人信息, candidate_id:', candidate_id)
    const candidate = await queryOne<any>(
      `SELECT * FROM candidates WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [candidate_id, companyId]
    )

    if (!candidate) {
      return NextResponse.json(
        { error: '找不到候选人信息' },
        { status: 404 }
      )
    }

    console.log('[analyze-candidate] 候选人原始 parsed_data 类型:', typeof candidate.parsed_data)
    console.log('[analyze-candidate] 候选人原始 parsed_data 前300字:', JSON.stringify(candidate.parsed_data).substring(0, 300))

    const cleanParsedData = cleanJSONForStorage(candidate.parsed_data)
    console.log('[analyze-candidate] 清洗后 parsed_data 类型:', typeof cleanParsedData)
    console.log('[analyze-candidate] 清洗后 parsed_data 前300字:', JSON.stringify(cleanParsedData).substring(0, 300))

    if (!cleanParsedData || typeof cleanParsedData !== 'object') {
      return NextResponse.json(
        { error: '候选人缺少解析后的数据' },
        { status: 400 }
      )
    }

    console.log('[analyze-candidate] 步骤2: 调用 Coze 工作流进行深度解析...')
    const coze = new CozeAPI({
      token: process.env.COZE_API_KEY || '',
      baseURL: 'https://api.coze.cn'
    })

    const resumeDataStr = JSON.stringify(cleanParsedData)
    console.log('[analyze-candidate] 传给 Coze 的 resume_data 长度:', resumeDataStr.length)
    console.log('[analyze-candidate] 传给 Coze 的 jd_text 长度:', job_description.length)

    const analyzeStream = await coze.workflows.runs.stream({
      workflow_id: '7642568363239571466',
      parameters: {
        resume_data: resumeDataStr,
        jd_text: job_description
      }
    })

    let analyzeResult = ''
    let chunkIndex = 0
    const isEmptyContent = (text: string) => {
      const t = (text || '').trim()
      return t.length === 0 || t === '{}' || t === '[]' || t === 'null'
    }
    for await (const chunk of analyzeStream) {
      const data = chunk.data as any
      let content = ''
      if (data?.content !== undefined && data?.content !== null) {
        content = String(data.content)
      } else if (data?.data?.content !== undefined && data?.data?.content !== null) {
        content = String(data.data.content)
      } else if (data?.output !== undefined && data?.output !== null) {
        content = String(data.output)
      } else if (typeof data === 'string') {
        content = data
      } else {
        continue
      }
      if (!isEmptyContent(content)) {
        analyzeResult += content
      }
      chunkIndex++
    }

    console.log('[analyze-candidate] 步骤3: 解析工作流返回结果, 长度:', analyzeResult.length, 'chunks:', chunkIndex)
    console.log('[analyze-candidate] Coze 原始响应文本:', analyzeResult)

    if (!analyzeResult || analyzeResult.trim().length === 0) {
      console.error('[analyze-candidate] Coze 工作流返回空结果')
      return NextResponse.json(
        { error: 'AI 深度解析返回空结果，请稍后重试' },
        { status: 500 }
      )
    }

    const parseJSONWithCleanup = (raw: string): any => {
      const cleaned = raw.trim()
      const firstOpen = cleaned.indexOf('{')
      const firstBracket = cleaned.indexOf('[')
      let startIdx = -1
      if (firstOpen !== -1 && firstBracket !== -1) {
        startIdx = Math.min(firstOpen, firstBracket)
      } else if (firstOpen !== -1) {
        startIdx = firstOpen
      } else if (firstBracket !== -1) {
        startIdx = firstBracket
      }
      let toParse = startIdx > 0 ? cleaned.substring(startIdx) : cleaned

      try {
        return JSON.parse(toParse)
      } catch (e1) {
        try {
          const inner = JSON.parse(toParse)
          if (typeof inner === 'string') {
            return JSON.parse(inner)
          }
          return inner
        } catch (e2) {
          const match = toParse.match(/\{[\s\S]*\}/)
          if (match && match[0] && match[0] !== toParse) {
            try {
              return JSON.parse(match[0])
            } catch (e3) {}
          }
          const bracketMatch = toParse.match(/\[[\s\S]*\]/)
          if (bracketMatch && bracketMatch[0] && bracketMatch[0] !== toParse) {
            try {
              return JSON.parse(bracketMatch[0])
            } catch (e4) {}
          }
          const outputMatch = toParse.match(/"output"\s*:\s*(\{[\s\S]*\})/)
          if (outputMatch && outputMatch[1]) {
            try {
              return JSON.parse(outputMatch[1])
            } catch (e5) {}
          }
          throw e1
        }
      }
    }

    let analyzeData: any = null
    try {
      const parsed = parseJSONWithCleanup(analyzeResult)
      console.log('[analyze-candidate] 初步 parse 后类型:', typeof parsed, 'keys:', parsed && typeof parsed === 'object' ? Object.keys(parsed) : '(non-object)')
      const cleanParsed = deepParseJSON(parsed)
      console.log('[analyze-candidate] deepParseJSON 后类型:', typeof cleanParsed, 'keys:', cleanParsed && typeof cleanParsed === 'object' ? Object.keys(cleanParsed) : '(non-object)')
      if (cleanParsed && typeof cleanParsed === 'object' && cleanParsed.output !== undefined && cleanParsed.output !== null) {
        analyzeData = deepParseJSON(cleanParsed.output)
        console.log('[analyze-candidate] 使用 output 字段, 类型:', typeof analyzeData, 'keys:', analyzeData && typeof analyzeData === 'object' ? Object.keys(analyzeData) : '(non-object)')
      } else {
        analyzeData = cleanParsed
      }
      console.log('[analyze-candidate] JSON 解析成功, top-level keys:', analyzeData && typeof analyzeData === 'object' ? Object.keys(analyzeData) : 'null')
    } catch (e) {
      console.warn('[analyze-candidate] JSON 解析失败，尝试用原始结果:', e)
      analyzeData = { raw_result: analyzeResult }
    }

    if (!analyzeData || typeof analyzeData !== 'object') {
      console.error('[analyze-candidate] 解析后的数据无效:', analyzeData)
      return NextResponse.json(
        { error: 'AI 深度解析结果格式异常，请稍后重试' },
        { status: 500 }
      )
    }

    console.log('[analyze-candidate] 步骤4: 写入 analysis_results 表...')
    console.log('[analyze-candidate] analyzeData keys:', Object.keys(analyzeData))
    console.log('[analyze-candidate] analyzeData 完整数据:', JSON.stringify(analyzeData).substring(0, 1000))

    const normalizeSkillMatch = (raw: any): any[] => {
      if (!raw) return []
      const cleanRaw = deepParseJSON(raw)
      if (!Array.isArray(cleanRaw)) return []
      return cleanRaw.map((item: any, idx: number) => {
        if (!item || typeof item !== 'object') return item
        console.log(`[analyze-candidate] skill_match[${idx}] 原始字段:`, JSON.stringify(item))
        const skillName =
          item.skill_name || item.skillName || item.skill || item.name || item.skill_title || ''
        const jobReq =
          item.job_requirement || item.jobRequirement || item.requirement || item.job_req || ''
        const rawLevel =
          item.match_level ?? item.matchLevel ?? item.match_score ?? item.matchScore ??
          item.score ?? item.level ?? item.match_degree ?? item.matching_degree ?? item.degree ??
          item.match_percent ?? item.percent ?? item.匹配度 ?? item.匹配分数 ?? item.分数 ?? null
        console.log(`[analyze-candidate] skill_match[${idx}] 提取的 match_level:`, rawLevel)
        let matchLevel: number = 0
        if (rawLevel !== null && rawLevel !== undefined && rawLevel !== '') {
          const parsed = Number(rawLevel)
          if (!isNaN(parsed)) {
            matchLevel = parsed
          }
        }
        const matchComment =
          item.match_comment || item.matchComment || item.comment || item.description ||
          item.detail || item.note || item.reason || item.match_description || item.匹配说明 || ''
        const normalized = {
          skill_name: skillName,
          job_requirement: jobReq,
          match_level: matchLevel,
          match_comment: matchComment
        }
        console.log(`[analyze-candidate] skill_match[${idx}] 规范化后:`, JSON.stringify(normalized))
        return normalized
      })
    }

    const rawSkillMatch =
      analyzeData.skill_match || analyzeData.skill_matches ||
      analyzeData.skill_match_comparison || analyzeData.skill_match_comparis ||
      analyzeData.skill_matching || analyzeData.skills || analyzeData.skill_compare
    console.log('[analyze-candidate] skill_match 原始数据:', JSON.stringify(rawSkillMatch).substring(0, 300))
    const normalizedSkillMatch = normalizeSkillMatch(rawSkillMatch)
    console.log('[analyze-candidate] skill_match 规范化后:', JSON.stringify(normalizedSkillMatch).substring(0, 300))

    const normalizeRiskWarnings = (raw: any): any => {
      if (!raw || typeof raw !== 'object') {
        return { severe_risks: [], minor_risks: [] }
      }

      const normalizeRiskItem = (item: any) => {
        if (!item || typeof item !== 'object') return null
        return {
          type: item.type || item.title || item.name || item.flag || '',
          severity: item.severity || item.level || item.risk_level || item.priority || 'medium',
          detail: item.detail || item.description || item.message || item.explanation || item.content || ''
        }
      }

      let severeRisks: any[] = []
      let minorRisks: any[] = []

      const tryGetArray = (keys: string[]): any[] | null => {
        for (const k of keys) {
          const val = raw[k]
          if (val && Array.isArray(val) && val.length > 0) return val
        }
        return null
      }

      severeRisks = tryGetArray([
        'severe_risks', 'severeRisks', 'severe_risks_list', 'severe',
        'critical_risks', 'criticalRisks', 'high_risks', 'highRisks',
        'critical_flags', 'red_flags', 'major_risks'
      ]) || []

      minorRisks = tryGetArray([
        'minor_risks', 'minorRisks', 'minor', 'medium_risks', 'mediumRisks',
        'warnings', 'warning_list', 'flags', 'yellow_flags', 'light_risks',
        'risks', 'risk_list', 'all_risks'
      ]) || []

      const normalized = {
        severe_risks: severeRisks.map(normalizeRiskItem).filter(Boolean) as any[],
        minor_risks: minorRisks.map(normalizeRiskItem).filter(Boolean) as any[]
      }

      if (normalized.severe_risks.length === 0 && normalized.minor_risks.length === 0) {
        const allKeys = Object.keys(raw)
        const possibleRiskKeys = allKeys.filter(k =>
          k.toLowerCase().includes('risk') || k.toLowerCase().includes('flag') ||
          k.toLowerCase().includes('warn') || k.toLowerCase().includes('issue')
        )
        for (const key of possibleRiskKeys) {
          const val = raw[key]
          if (val && Array.isArray(val) && val.length > 0) {
            const items = val.map(normalizeRiskItem).filter(Boolean)
            if (items.length > 0) {
              normalized.minor_risks = [...normalized.minor_risks, ...items]
            }
          } else if (val && typeof val === 'object' && !Array.isArray(val)) {
            const item = normalizeRiskItem(val)
            if (item && item.type) {
              normalized.minor_risks = [...normalized.minor_risks, item]
            }
          }
        }
      }

      return normalized
    }

    const normalizedRiskWarnings = normalizeRiskWarnings(analyzeData.risk_warnings)
    console.log('[analyze-candidate] risk_warnings 原始数据:', JSON.stringify(analyzeData.risk_warnings).substring(0, 300))
    console.log('[analyze-candidate] risk_warnings 规范化后:', JSON.stringify(normalizedRiskWarnings).substring(0, 300))

    const safeSummary = toJSONObjectForPG(analyzeData.summary)
    const safeRiskWarnings = toJSONObjectForPG(normalizedRiskWarnings)
    const safeTechTranslation = toJSONArrayForPG(analyzeData.tech_translation)
    const safeSkillMatch = toJSONArrayForPG(normalizedSkillMatch)

    console.log('[analyze-candidate] 写入前 JSON 字段检查 (最终):')
    console.log('  summary 类型:', typeof safeSummary, '内容:', JSON.stringify(safeSummary).substring(0, 200))
    console.log('  risk_warnings 类型:', typeof safeRiskWarnings, '内容:', JSON.stringify(safeRiskWarnings).substring(0, 200))
    console.log('  tech_translation 类型:', typeof safeTechTranslation, '内容:', JSON.stringify(safeTechTranslation).substring(0, 200))
    console.log('  skill_match 类型:', typeof safeSkillMatch, '内容:', JSON.stringify(safeSkillMatch).substring(0, 200))

    const jsonSummary = serializeForJSON(safeSummary)
    const jsonRiskWarnings = serializeForJSON(safeRiskWarnings)
    const jsonTechTranslation = serializeForJSON(safeTechTranslation)
    const jsonSkillMatch = serializeForJSON(safeSkillMatch)

    console.log('[analyze-candidate] 最终 JSON 字符串验证:')
    console.log('  $4 summary json str 长度:', jsonSummary.length, '预览:', jsonSummary.substring(0, 150))
    console.log('  $5 risk_warnings json str 长度:', jsonRiskWarnings.length, '预览:', jsonRiskWarnings.substring(0, 150))
    console.log('  $6 tech_translation json str 长度:', jsonTechTranslation.length, '预览:', jsonTechTranslation.substring(0, 150))
    console.log('  $7 skill_match json str 长度:', jsonSkillMatch.length, '预览:', jsonSkillMatch.substring(0, 150))

    const insertPayload = {
      candidate_id,
      job_id,
      summary: jsonSummary,
      risk_warnings: jsonRiskWarnings,
      tech_translation: jsonTechTranslation,
      skill_match: jsonSkillMatch,
      updated_at: new Date().toISOString(),
    }

    console.log('[analyze-candidate] 写入 payload keys:', Object.keys(insertPayload))
    console.log('[analyze-candidate] 执行 SQL 写入...')

    let newAnalysis: any = null

    if (force) {
      const existingForUpsert = await queryOne<any>(
        `SELECT id FROM analysis_results WHERE candidate_id = $1 LIMIT 1`,
        [candidate_id]
      )

      if (existingForUpsert) {
        console.log('[analyze-candidate] force=true，更新已存在的分析数据 id:', existingForUpsert.id)
        newAnalysis = await queryOne<any>(
          `UPDATE analysis_results SET
            job_id = $1,
            summary = $2::json,
            risk_warnings = $3::json,
            tech_translation = $4::json,
            skill_match = $5::json,
            updated_at = NOW()
          WHERE id = $6
          RETURNING *`,
          [
            job_id,
            insertPayload.summary,
            insertPayload.risk_warnings,
            insertPayload.tech_translation,
            insertPayload.skill_match,
            existingForUpsert.id
          ]
        )
      } else {
        console.log('[analyze-candidate] force=true，无现有数据，直接插入')
        newAnalysis = await queryOne<any>(
          `INSERT INTO analysis_results (
            id, candidate_id, job_id, summary, risk_warnings, tech_translation, skill_match, updated_at, created_at
          ) VALUES ($1, $2, $3, $4::json, $5::json, $6::json, $7::json, NOW(), NOW())
          RETURNING *`,
          [
            uuidv4(),
            candidate_id,
            job_id,
            insertPayload.summary,
            insertPayload.risk_warnings,
            insertPayload.tech_translation,
            insertPayload.skill_match
          ]
        )
      }
    } else {
      newAnalysis = await queryOne<any>(
        `INSERT INTO analysis_results (
          id, candidate_id, job_id, summary, risk_warnings, tech_translation, skill_match, updated_at, created_at
        ) VALUES ($1, $2, $3, $4::json, $5::json, $6::json, $7::json, NOW(), NOW())
        RETURNING *`,
        [
          uuidv4(),
          candidate_id,
          job_id,
          insertPayload.summary,
          insertPayload.risk_warnings,
          insertPayload.tech_translation,
          insertPayload.skill_match
        ]
      )
    }

    if (!newAnalysis) {
      throw new Error('插入分析数据失败')
    }

    console.log('[analyze-candidate] 深度解析完成')
    console.log('[analyze-candidate] 写入后返回的 keys:', Object.keys(newAnalysis))
    console.log('[analyze-candidate] 写入后 skill_match:', JSON.stringify(newAnalysis.skill_match).substring(0, 200))

    const responseData = newAnalysis || insertPayload
    return NextResponse.json({
      success: true,
      data: responseData,
      from_cache: false
    })

  } catch (error) {
    const errMsg = extractErrorMessage(error)
    console.error('[analyze-candidate] 错误:', errMsg, error)
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    )
  }
}
