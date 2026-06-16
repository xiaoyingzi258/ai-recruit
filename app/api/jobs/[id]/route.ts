import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id

    if (!jobId) {
      return NextResponse.json(
        { error: '缺少岗位 ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, jd_text, status } = body

    if (!title?.trim()) {
      return NextResponse.json(
        { error: '请输入岗位名称' },
        { status: 400 }
      )
    }
    if (!jd_text?.trim()) {
      return NextResponse.json(
        { error: '请输入岗位 JD' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('jobs')
      .update({
        title: title.trim(),
        jd_text: jd_text.trim(),
        status: status || 'open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select()
      .single()

    if (error) {
      console.error('[update-job] 更新岗位失败:', error)
      return NextResponse.json(
        { error: '更新岗位失败: ' + error.message },
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
    const jobId = params.id

    if (!jobId) {
      return NextResponse.json(
        { error: '缺少岗位 ID' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    await supabase
      .from('match_results')
      .delete()
      .eq('job_id', jobId)

    await supabase
      .from('candidates')
      .delete()
      .eq('job_id', jobId)

    const { error: jobError } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId)

    if (jobError) {
      console.error('[delete-job] 删除岗位失败:', jobError)
      return NextResponse.json(
        { error: '删除岗位失败: ' + jobError.message },
        { status: 500 }
      )
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
