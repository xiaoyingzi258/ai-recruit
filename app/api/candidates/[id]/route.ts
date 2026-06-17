import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { queryOne, getClient } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.company_id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = session.user.company_id
  const candidateId = params.id

  const row = await queryOne(
    `SELECT * FROM candidates WHERE id = $1 AND company_id = $2`,
    [candidateId, companyId]
  )

  if (!row) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: row })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.company_id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = session.user.company_id
  const candidateId = params.id

  const body = await request.json()
  const { status } = body

  if (!status || !['shortlisted', 'removed', 'pending'].includes(status)) {
    return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
  }

  const updatedRow = await queryOne(
    `UPDATE candidates SET status = $1 WHERE id = $2 AND company_id = $3 RETURNING *`,
    [status, candidateId, companyId]
  )

  if (!updatedRow) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: updatedRow })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.company_id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const companyId = session.user.company_id
  const candidateId = params.id

  const client = await getClient()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM match_results WHERE candidate_id = $1`, [candidateId])
    const result = await client.query(`DELETE FROM candidates WHERE id = $1 AND company_id = $2`, [candidateId, companyId])
    await client.query('COMMIT')

    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
