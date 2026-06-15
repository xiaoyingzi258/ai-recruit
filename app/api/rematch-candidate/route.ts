import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CozeAPI } from '@coze/api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { candidate_id, job_description } = body

    if (!candidate_id || !job_description) {
      return NextResponse.json(
        { error: '缺少必要参数：candidate_id, job_description' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    
    // 1. 获取候选人信息
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidate_id)
      .single()

    if (candidateError) {
      throw candidateError
    }

    if (!candidate.parsed_data) {
      return NextResponse.json(
        { error: '候选人缺少解析后的数据' },
        { status: 400 }
      )
    }

    // 2. 调用整合的工作流
    const coze = new CozeAPI({
      token: process.env.COZE_API_KEY || '',
      baseURL: 'https://api.coze.cn'
    })

    console.log('[rematch-candidate] 开始重新计算匹配度...')
    const stream = await coze.workflows.runs.stream({
      workflow_id: '7642566426397655059',
      parameters: { 
        resume_data: candidate.raw_text || JSON.stringify(candidate.parsed_data), 
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

    let resultData: any = null
    let matchData: any = null
    try {
      resultData = JSON.parse(result)
      if (resultData.output) {
        resultData = resultData.output
      } else if (resultData.data) {
        resultData = resultData.data
      } else if (resultData.result) {
        resultData = resultData.result
      }
      matchData = resultData.match || resultData
    } catch (e) {
      matchData = { raw_result: result }
    }

    // 3. 更新 match_results 表
    const { error: matchUpdateError } = await supabase
      .from('match_results')
      .update({
        total_score: matchData.total_score || 0,
        hard_condition: matchData.hard_condition || {},
        tech_skill: matchData.tech_skill || {},
        project_exp: matchData.project_exp || {},
        risk_penalty: matchData.risk_penalty || {},
        risk_block: matchData.risk_block || null,
        updated_at: new Date().toISOString()
      })
      .eq('candidate_id', candidate_id)

    if (matchUpdateError) {
      throw matchUpdateError
    }

    // 4. 更新 candidates 表的 risk_tag
    const { error: candidateUpdateError } = await supabase
      .from('candidates')
      .update({
        risk_tag: matchData.risk_tag || '',
        updated_at: new Date().toISOString()
      })
      .eq('id', candidate_id)

    if (candidateUpdateError) {
      throw candidateUpdateError
    }

    return NextResponse.json({
      success: true,
      data: {
        match: matchData
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
