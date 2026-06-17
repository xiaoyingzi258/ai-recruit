import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne, getClient } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.company_id) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
    }

    const companyId = session.user.company_id
    const jobId = params.id

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: '缺少岗位 ID' },
        { status: 400 }
      )
    }

    const row = await queryOne<any>(
      `SELECT j.*, COALESCE(c.candidate_count, 0) as candidate_count
       FROM jobs j
       LEFT JOIN (
         SELECT job_id, COUNT(*) as candidate_count
         FROM candidates
         GROUP BY job_id
       ) c ON c.job_id = j.id
       WHERE j.id = $1 AND j.company_id = $2`,
      [jobId, companyId]
    )

    if (!row) {
      return NextResponse.json(
        { success: false, error: '岗位不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error('[get-job] 接口异常:', error)
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const companyId = session.user.company_id

    const jobId = params.id

    if (!jobId) {
      return NextResponse.json(
        { error: '缺少岗位 ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, jd_text, status } = body

    const updateFields: string[] = []
    const updateValues: any[] = []
    let paramIndex = 1

    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json(
          { error: '请输入岗位名称' },
          { status: 400 }
        )
      }
      updateFields.push(`title=$${paramIndex++}`)
      updateValues.push(title.trim())
    }

    if (jd_text !== undefined) {
      if (!jd_text.trim()) {
        return NextResponse.json(
          { error: '请输入岗位 JD' },
          { status: 400 }
        )
      }
      updateFields.push(`jd_text=$${paramIndex++}`)
      updateValues.push(jd_text.trim())
    }

    if (status !== undefined) {
      updateFields.push(`status=$${paramIndex++}`)
      updateValues.push(status || 'open')
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: '无有效更新字段' },
        { status: 400 }
      )
    }

    updateFields.push(`updated_at=NOW()`)
    updateValues.push(jobId, companyId)

    const data = await queryOne<any>(
      `UPDATE jobs SET ${updateFields.join(', ')} WHERE id=$${paramIndex} AND company_id=$${paramIndex + 1} RETURNING *`,
      updateValues
    )

    if (!data) {
      console.error('[update-job] 更新岗位失败: 未找到记录或无权访问')
      return NextResponse.json(
        { error: '更新岗位失败: 未找到记录或无权访问' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data, message: '更新成功' })
  } catch (error) {
    console.error('[update-job] 接口异常:', error)
    return NextResponse.json(
      { error: '服务器内部错误', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const companyId = session.user.company_id

    const jobId = params.id

    if (!jobId) {
      return NextResponse.json(
        { error: '缺少岗位 ID' },
        { status: 400 }
      )
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      await client.query(
        `DELETE FROM match_results WHERE job_id = $1`,
        [jobId]
      )

      await client.query(
        `DELETE FROM candidates WHERE job_id = $1 AND company_id = $2`,
        [jobId, companyId]
      )

      const { rowCount } = await client.query(
        `DELETE FROM jobs WHERE id = $1 AND company_id = $2`,
        [jobId, companyId]
      )

      await client.query('COMMIT')

      if (rowCount === 0) {
        console.error('[delete-job] 删除岗位失败: 未找到记录或无权访问')
        return NextResponse.json(
          { error: '删除岗位失败: 未找到记录或无权访问' },
          { status: 500 }
        )
      }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    return NextResponse.json({ success: true, message: '删除成功' })
  } catch (error) {
    console.error('[delete-job] 接口异常:', error)
    return NextResponse.json(
      { error: '服务器内部错误', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
