import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { queryOne } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.company_id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const candidateId = params.id

  const row = await queryOne(
    `SELECT * FROM interview_questions WHERE candidate_id = $1 LIMIT 1`,
    [candidateId]
  )

  return NextResponse.json({ success: true, data: row || null })
}
