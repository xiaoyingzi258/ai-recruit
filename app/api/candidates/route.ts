import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.company_id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = session.user.company_id
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('job_id')

  if (!jobId) {
    return NextResponse.json({ success: false, error: 'Missing job_id' }, { status: 400 })
  }

  const rows = await query(
    `SELECT c.*, 
            m.total_score as match_score,
            m.hard_condition,
            m.tech_skill,
            m.project_exp,
            m.risk_penalty
     FROM candidates c
     LEFT JOIN match_results m ON c.id = m.candidate_id AND m.job_id = $2
     WHERE c.company_id = $1 AND c.job_id = $2
     ORDER BY c.created_at DESC`,
    [companyId, jobId]
  )

  const parsedRows = rows.map((row: any) => {
    const parsed: any = { ...row }
    const jsonFields = ['hard_condition', 'tech_skill', 'project_exp', 'risk_penalty']
    jsonFields.forEach((field) => {
      if (row[field]) {
        try {
          parsed[field] = typeof row[field] === 'string' ? JSON.parse(row[field]) : row[field]
        } catch (e) {
          console.error(`解析 ${field} 失败:`, e)
          parsed[field] = null
        }
      }
    })
    return parsed
  })

  return NextResponse.json({ success: true, data: parsedRows })
}
