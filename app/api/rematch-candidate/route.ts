import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { CozeAPI } from '@coze/api'

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
    const { candidate_id, job_description } = body

    if (!candidate_id || !job_description) {
      return NextResponse.json(
        { error: '缺少必要参数：candidate_id, job_description' },
        { status: 400 }
      )
    }

    const candidate = await queryOne<any>(
      `SELECT * FROM candidates WHERE id = $1 AND company_id = $2`,
      [candidate_id, companyId]
    )

    if (!candidate) {
      return NextResponse.json(
        { error: '找不到候选人信息' },
        { status: 404 }
      )
    }

    const cleanParsedData = deepParseJSON(candidate.parsed_data)
    if (!cleanParsedData) {
      return NextResponse.json(
        { error: '候选人缺少解析后的数据' },
        { status: 400 }
      )
    }

    const coze = new CozeAPI({
      token: process.env.COZE_API_KEY || '',
      baseURL: 'https://api.coze.cn'
    })

    console.log('[rematch-candidate] 开始重新计算匹配度...')
    const resumeDataStr = candidate.raw_text || JSON.stringify(cleanParsedData)
    console.log('[rematch-candidate] resume_data 长度:', resumeDataStr.length)

    const stream = await coze.workflows.runs.stream({
      workflow_id: '7642566426397655059',
      parameters: {
        resume_data: resumeDataStr,
        jd_text: job_description
      }
    })

    let result = ''
    for await (const chunk of stream) {
      const data = chunk.data as any
      if (data?.content) {
        result += data.content
      }
    }

    console.log('[rematch-candidate] Coze 返回结果长度:', result.length)
    console.log('[rematch-candidate] Coze 返回前300字:', result.substring(0, 300))

    let resultData: any = null
    let matchData: any = null
    try {
      resultData = JSON.parse(result)
      console.log('[rematch-candidate] 初步解析后类型:', typeof resultData, 'keys:', resultData && typeof resultData === 'object' ? Object.keys(resultData) : 'non-object')
      const cleanResult = deepParseJSON(resultData)
      if (cleanResult && typeof cleanResult === 'object' && cleanResult.output !== undefined && cleanResult.output !== null) {
        resultData = deepParseJSON(cleanResult.output)
      } else if (cleanResult && typeof cleanResult === 'object' && cleanResult.data !== undefined && cleanResult.data !== null) {
        resultData = deepParseJSON(cleanResult.data)
      } else if (cleanResult && typeof cleanResult === 'object' && cleanResult.result !== undefined && cleanResult.result !== null) {
        resultData = deepParseJSON(cleanResult.result)
      } else {
        resultData = cleanResult
      }
      matchData = resultData && typeof resultData === 'object' && resultData.match ? resultData.match : resultData
      matchData = deepParseJSON(matchData) || { raw_result: result }
      console.log('[rematch-candidate] matchData keys:', matchData && typeof matchData === 'object' ? Object.keys(matchData) : 'null')
    } catch (e) {
      console.warn('[rematch-candidate] JSON 解析失败:', e)
      matchData = { raw_result: result }
    }

    const cleanMatchData = deepParseJSON(matchData) || {}
    const safeHardCondition = toJSONObjectForPG(cleanMatchData.hard_condition)
    const safeTechSkill = toJSONObjectForPG(cleanMatchData.tech_skill)
    const safeProjectExp = toJSONObjectForPG(cleanMatchData.project_exp)
    const safeRiskPenalty = toJSONObjectForPG(cleanMatchData.risk_penalty)
    const safeRiskBlock = cleanMatchData.risk_block ? toJSONObjectForPG(cleanMatchData.risk_block) : null

    const jsonHardCondition = serializeForJSON(safeHardCondition)
    const jsonTechSkill = serializeForJSON(safeTechSkill)
    const jsonProjectExp = serializeForJSON(safeProjectExp)
    const jsonRiskPenalty = serializeForJSON(safeRiskPenalty)
    const jsonRiskBlock = safeRiskBlock ? serializeForJSON(safeRiskBlock) : serializeForJSON(null)

    console.log('[rematch-candidate] 更新 match_results 的 JSON 字段:')
    console.log('  total_score:', cleanMatchData.total_score || 0)
    console.log('  hard_condition(json str):', jsonHardCondition.substring(0, 150))
    console.log('  tech_skill(json str):', jsonTechSkill.substring(0, 150))
    console.log('  project_exp(json str):', jsonProjectExp.substring(0, 150))
    console.log('  risk_penalty(json str):', jsonRiskPenalty.substring(0, 150))
    console.log('  risk_block(json str):', jsonRiskBlock.substring(0, 150))
    console.log('  risk_tag:', cleanMatchData.risk_tag || '')

    const matchUpdateResult = await queryOne<any>(
      `UPDATE match_results SET
        total_score = $1,
        hard_condition = $2::json,
        tech_skill = $3::json,
        project_exp = $4::json,
        risk_penalty = $5::json,
        risk_block = $6::json
      WHERE candidate_id = $7
      RETURNING *`,
      [
        cleanMatchData.total_score || 0,
        jsonHardCondition,
        jsonTechSkill,
        jsonProjectExp,
        jsonRiskPenalty,
        jsonRiskBlock,
        candidate_id
      ]
    )

    if (!matchUpdateResult) {
      throw new Error('更新匹配结果失败')
    }

    const candidateUpdateResult = await queryOne<any>(
      `UPDATE candidates SET
        risk_tag = $1
      WHERE id = $2 AND company_id = $3
      RETURNING *`,
      [
        cleanMatchData.risk_tag || '',
        candidate_id,
        companyId
      ]
    )

    if (!candidateUpdateResult) {
      throw new Error('更新候选人风险标签失败')
    }

    return NextResponse.json({
      success: true,
      data: {
        match: cleanMatchData
      }
    })

  } catch (error) {
    console.error('[rematch-candidate] 错误:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '重新匹配失败' },
      { status: 500 }
    )
  }
}
