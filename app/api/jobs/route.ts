import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.company_id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = session.user.company_id
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let sql = `
    SELECT j.*, u.name as creator_name, u.email as creator_email,
      COALESCE(c.candidate_count, 0) as candidate_count
    FROM jobs j
    LEFT JOIN users u ON j.created_by = u.id
    LEFT JOIN (
      SELECT job_id, COUNT(*) as candidate_count
      FROM candidates
      GROUP BY job_id
    ) c ON c.job_id = j.id
    WHERE j.company_id = $1
  `
  const params: any[] = [companyId]

  if (status) {
    sql += ` AND j.status = $2`
    params.push(status)
  }

  sql += ` ORDER BY j.created_at DESC`

  const rows = await query(sql, params)
  return NextResponse.json({ success: true, data: rows })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.company_id || !session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = session.user.company_id
  const userId = session.user.id

  const body = await request.json()
  const { title, jd_text, status } = body

  if (!title || !jd_text) {
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
  }

  const id = uuidv4()
  const newJob = await queryOne(
    `INSERT INTO jobs (id, company_id, title, jd_text, status, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING *`,
    [id, companyId, title, jd_text, status || 'active', userId]
  )

  return NextResponse.json({ success: true, data: newJob })
}
