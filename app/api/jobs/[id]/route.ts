import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne, getClient } from '@/lib/db'
import { CozeAPI } from '@coze/api'

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

    let minExperience = 0
    let minEducation: string | null = null
    let minSalary = 0
    let maxSalary = 0
    let location: string | null = null
    let coreSkills: any[] | null = null
    let parsedData: any | null = null

    if (jd_text !== undefined) {
      if (!jd_text.trim()) {
        return NextResponse.json(
          { error: '请输入岗位 JD' },
          { status: 400 }
        )
      }
      updateFields.push(`jd_text=$${paramIndex++}`)
      updateValues.push(jd_text.trim())

      console.log('[JD解析] 步骤1 - 更新岗位，jd_text 有变化，准备重新解析:')
      console.log('  岗位 ID:', jobId)
      console.log('  jd_text 长度:', jd_text?.length)
      console.log('  jd_text 前200字:', jd_text?.substring(0, 200))

      try {
        const coze = new CozeAPI({
          token: process.env.COZE_API_KEY || '',
          baseURL: 'https://api.coze.cn'
        })

        console.log('[JD解析] 步骤2 - 准备调用 Coze 工作流:')
        console.log('  workflow_id: 7657221050028507177')
        console.log('  参数 jd_text 长度:', jd_text.length)

        const parseStream = await coze.workflows.runs.stream({
          workflow_id: '7657221050028507177',
          parameters: { jd_text: jd_text }
        })

        let parseResult = ''
        let chunkCount = 0
        for await (const chunk of parseStream) {
          const data = chunk.data as any
          if (data?.content) {
            parseResult += data.content
            chunkCount++
          }
        }

        console.log('[JD解析] 步骤3 - Coze 流式响应接收完成:')
        console.log('  chunk 总数:', chunkCount)
        console.log('  响应总长度:', parseResult.length)
        console.log('  响应全文前500字:', parseResult.substring(0, 500))

        let parsedOutput: any = null
        try {
          parsedOutput = JSON.parse(parseResult)
          console.log('[JD解析] 步骤4 - 开始解析 JSON:')
          console.log('  原始响应 top-level keys:', Object.keys(parsedOutput || {}))
          console.log('  是否有 output 字段:', !!parsedOutput?.output)
          console.log('  是否有 data 字段:', !!parsedOutput?.data)
          console.log('  是否有 result 字段:', !!parsedOutput?.result)
          if (parsedOutput.output) {
            parsedOutput = parsedOutput.output
          } else if (parsedOutput.data) {
            parsedOutput = parsedOutput.data
          } else if (parsedOutput.result) {
            parsedOutput = parsedOutput.result
          }
          console.log('  最终解析结果 keys:', parsedOutput ? Object.keys(parsedOutput) : 'null')
          console.log('  解析结果完整内容前1000字:', JSON.stringify(parsedOutput).substring(0, 1000))
        } catch (e) {
          console.warn('[JD解析] JSON.parse 失败:', e)
        }

        if (parsedOutput) {
          parsedData = parsedOutput

          minExperience = typeof parsedOutput.min_experience === 'number' && !isNaN(parsedOutput.min_experience)
            ? parsedOutput.min_experience
            : 0

          minEducation = parsedOutput.min_education || null

          minSalary = typeof parsedOutput.min_salary === 'number' && !isNaN(parsedOutput.min_salary)
            ? parsedOutput.min_salary
            : 0

          maxSalary = typeof parsedOutput.max_salary === 'number' && !isNaN(parsedOutput.max_salary)
            ? parsedOutput.max_salary
            : 0

          location = parsedOutput.location || null

          coreSkills = Array.isArray(parsedOutput.core_skills) ? parsedOutput.core_skills : null
        }

        console.log('[JD解析] 步骤5 - 字段提取结果:')
        console.log('  min_experience:', minExperience, '(原始值:', parsedOutput?.min_experience, ')')
        console.log('  min_education:', minEducation, '(原始值:', parsedOutput?.min_education, ')')
        console.log('  min_salary:', minSalary, '(原始值:', parsedOutput?.min_salary, ')')
        console.log('  max_salary:', maxSalary, '(原始值:', parsedOutput?.max_salary, ')')
        console.log('  location:', location, '(原始值:', parsedOutput?.location, ')')
        console.log('  core_skills 数量:', coreSkills?.length, '(原始值:', JSON.stringify(parsedOutput?.core_skills).substring(0, 200), ')')

      } catch (e) {
        console.error('[JD解析] 更新时 Coze API 调用失败，使用默认值:', e)
      }

      console.log('[JD解析] 步骤6 - 即将更新数据库:')
      console.log('  写入的 min_experience:', minExperience)
      console.log('  写入的 min_education:', minEducation)
      console.log('  写入的 education_requirement:', minEducation)
      console.log('  写入的 min_salary:', minSalary)
      console.log('  写入的 max_salary:', maxSalary)
      console.log('  写入的 location:', location)
      console.log('  写入的 core_skills:', JSON.stringify(coreSkills))
      console.log('  写入的 parsed_data 长度:', JSON.stringify(parsedData)?.length)

      updateFields.push(`min_experience=$${paramIndex++}`)
      updateValues.push(minExperience)
      updateFields.push(`min_education=$${paramIndex++}`)
      updateValues.push(minEducation)
      updateFields.push(`education_requirement=$${paramIndex++}`)
      updateValues.push(minEducation)
      updateFields.push(`min_salary=$${paramIndex++}`)
      updateValues.push(minSalary)
      updateFields.push(`max_salary=$${paramIndex++}`)
      updateValues.push(maxSalary)
      updateFields.push(`location=$${paramIndex++}`)
      updateValues.push(location)
      updateFields.push(`core_skills=$${paramIndex++}::jsonb`)
      updateValues.push(coreSkills ? JSON.stringify(coreSkills) : null)
      updateFields.push(`parsed_data=$${paramIndex++}::jsonb`)
      updateValues.push(parsedData ? JSON.stringify(parsedData) : null)
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

    if (jd_text !== undefined) {
      console.log('[JD解析] 步骤7 - 数据库更新完成 ✅')
      console.log('  岗位 ID:', data?.id)
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
