import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { candidate_id, job_id, job_description, force } = body

    if (!candidate_id || !job_id || !job_description) {
      return NextResponse.json(
        { error: '缺少必要参数：candidate_id, job_id, job_description' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    if (!force) {
      const { data: existingAnalysis, error: existingError } = await supabase
        .from('analysis_results')
        .select('*')
        .eq('candidate_id', candidate_id)
        .limit(1)

      if (!existingError && existingAnalysis && existingAnalysis.length > 0) {
        return NextResponse.json({
          success: true,
          data: existingAnalysis[0],
          from_cache: true
        })
      }
    }

    console.log('[analyze-candidate] 步骤1: 获取候选人信息, candidate_id:', candidate_id)
    const { data: candidateRows, error: candidateError } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidate_id)
      .limit(1)

    if (candidateError) {
      throw candidateError
    }

    if (!candidateRows || candidateRows.length === 0) {
      return NextResponse.json(
        { error: '找不到候选人信息' },
        { status: 404 }
      )
    }

    const candidate = candidateRows[0]

    if (!candidate.parsed_data) {
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

    const analyzeStream = await coze.workflows.runs.stream({
      workflow_id: '7642568363239571466',
      parameters: { 
        resume_data: JSON.stringify(candidate.parsed_data), 
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
      if (parsed && typeof parsed === 'object' && parsed.output !== undefined && parsed.output !== null) {
        analyzeData = parsed.output
      } else {
        analyzeData = parsed
      }
      console.log('[analyze-candidate] JSON 解析成功, top-level keys:', analyzeData ? Object.keys(analyzeData) : 'null')
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
    console.log('[analyze-candidate] analyzeData 完整数据:', JSON.stringify(analyzeData))

    const normalizeSkillMatch = (raw: any): any[] => {
      if (!raw) return []
      if (!Array.isArray(raw)) return []
      return raw.map((item: any, idx: number) => {
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
    console.log('[analyze-candidate] skill_match 原始数据:', JSON.stringify(rawSkillMatch))
    const normalizedSkillMatch = normalizeSkillMatch(rawSkillMatch)
    console.log('[analyze-candidate] skill_match 规范化后:', JSON.stringify(normalizedSkillMatch))

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
    console.log('[analyze-candidate] risk_warnings 原始数据:', JSON.stringify(analyzeData.risk_warnings))
    console.log('[analyze-candidate] risk_warnings 规范化后:', JSON.stringify(normalizedRiskWarnings))

    const insertPayload = {
      candidate_id,
      job_id,
      summary: analyzeData.summary || {},
      risk_warnings: normalizedRiskWarnings,
      tech_translation: analyzeData.tech_translation || [],
      skill_match: normalizedSkillMatch,
      updated_at: new Date().toISOString(),
    }

    console.log('[analyze-candidate] 写入 payload keys:', Object.keys(insertPayload))
    console.log('[analyze-candidate] skill_match 最终值:', JSON.stringify(insertPayload.skill_match))

    let newAnalysis: any = null

    try {
      const { data: upsertRows, error: upsertError } = await supabase
        .from('analysis_results')
        .upsert(insertPayload, { onConflict: 'candidate_id' })
        .select()
        .limit(1)

      if (!upsertError && upsertRows && upsertRows.length > 0) {
        newAnalysis = upsertRows[0]
      } else if (upsertError) {
        console.warn('[analyze-candidate] UPSERT 失败，回退到 DELETE+INSERT:', upsertError)
        throw upsertError
      }
    } catch (e) {
      console.warn('[analyze-candidate] UPSERT 失败，尝试 DELETE+INSERT:', e)
      await supabase
        .from('analysis_results')
        .delete()
        .eq('candidate_id', candidate_id)

      const { data: insertRows, error: insertError } = await supabase
        .from('analysis_results')
        .insert(insertPayload)
        .select()
        .limit(1)

      if (insertError) {
        console.error('[analyze-candidate] INSERT 也失败:', insertError)
        throw insertError
      }
      if (!insertRows || insertRows.length === 0) {
        throw new Error('插入分析数据失败')
      }
      newAnalysis = insertRows[0]
    }

    console.log('[analyze-candidate] 深度解析完成')
    if (newAnalysis) {
      console.log('[analyze-candidate] 写入后返回的 keys:', Object.keys(newAnalysis))
      console.log('[analyze-candidate] 写入后 skill_match:', JSON.stringify(newAnalysis.skill_match))
    }

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
