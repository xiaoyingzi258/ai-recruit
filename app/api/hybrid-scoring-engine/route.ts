import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { calculateHybridScore, serializeForJSON } from '@/lib/hybrid-scoring'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const companyId = session.user.company_id

    const body = await request.json()
    const { candidate_id, job_id } = body

    if (!candidate_id || !job_id) {
      return NextResponse.json(
        { error: '缺少必要参数：candidate_id, job_id' },
        { status: 400 }
      )
    }

    console.log('\n========== [hybrid-scoring-engine] 收到请求 ==========')
    console.log('candidate_id:', candidate_id)
    console.log('job_id:', job_id)

    const scoringResult = await calculateHybridScore(candidate_id, job_id, companyId)

    console.log('[Hybrid] 保存结果到数据库...')

    const hardConditionJson = serializeForJSON(scoringResult.hard_condition)
    const techSkillJson = serializeForJSON({
      vector_similarity: scoringResult.vector_similarity,
      total_score: scoringResult.total_score
    })
    const projectExpJson = serializeForJSON(scoringResult.project_exp)
    const riskPenaltyJson = serializeForJSON(scoringResult.risk_penalty)
    const matchAdvantagesJson = serializeForJSON(scoringResult.match_advantages)

    const existingRecord = await queryOne<any>(
      `SELECT id FROM match_results WHERE candidate_id = $1 AND job_id = $2`,
      [candidate_id, job_id]
    )

    let savedRecord: any

    if (existingRecord) {
      savedRecord = await queryOne<any>(
        `UPDATE match_results SET
          total_score = $1,
          hard_condition = $2::json,
          tech_skill = $3::json,
          project_exp = $4::json,
          risk_penalty = $5::json,
          risk_block = $6,
          match_advantages = $7::json,
          created_at = NOW()
        WHERE candidate_id = $8 AND job_id = $9
        RETURNING *`,
        [
          scoringResult.total_score,
          hardConditionJson,
          techSkillJson,
          projectExpJson,
          riskPenaltyJson,
          scoringResult.risk_block,
          matchAdvantagesJson,
          candidate_id,
          job_id
        ]
      )
    } else {
      const { v4: uuidv4 } = await import('uuid')
      savedRecord = await queryOne<any>(
        `INSERT INTO match_results (
          id, candidate_id, job_id, total_score,
          hard_condition, tech_skill, project_exp, risk_penalty,
          risk_block, match_advantages, created_at
        ) VALUES ($1, $2, $3, $4, $5::json, $6::json, $7::json, $8::json, $9, $10::json, NOW())
        RETURNING *`,
        [
          uuidv4(),
          candidate_id,
          job_id,
          scoringResult.total_score,
          hardConditionJson,
          techSkillJson,
          projectExpJson,
          riskPenaltyJson,
          scoringResult.risk_block,
          matchAdvantagesJson
        ]
      )
    }

    console.log('[Hybrid] ✅ 结果已保存, id:', savedRecord?.id)
    console.log('========== [hybrid-scoring-engine] 完成 ✅ ==========\n')

    return NextResponse.json({
      success: true,
      data: {
        ...scoringResult,
        id: savedRecord?.id,
        candidate_id,
        job_id
      }
    })

  } catch (error: any) {
    const errMsg = error instanceof Error ? error.message : (error?.message || '未知错误')
    console.error(`\n========== [hybrid-scoring-engine] 错误 ❌ ==========`)
    console.error('错误:', errMsg)
    console.error(error)
    console.error(`=====================================================\n`)

    return NextResponse.json(
      {
        error: errMsg,
        detail: error instanceof Error ? { stack: error.stack, name: error.name } : error
      },
      { status: 500 }
    )
  }
}
