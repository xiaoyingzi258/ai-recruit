import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { CozeAPI } from '@coze/api'

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

  console.log('[JD解析] 步骤1 - 接收请求参数:')
  console.log('  title:', title)
  console.log('  jd_text 长度:', jd_text?.length)
  console.log('  jd_text 前200字:', jd_text?.substring(0, 200))

  let minExperience = 0
  let minEducation: string | null = null
  let minSalary = 0
  let maxSalary = 0
  let location: string | null = null
  let coreSkills: any[] | null = null
  let parsedData: any | null = null

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
    console.error('[JD解析] Coze API 调用失败，使用默认值:', e)
  }

  console.log('[JD解析] 步骤6 - 即将写入数据库:')
  console.log('  写入的 min_experience:', minExperience)
  console.log('  写入的 min_education:', minEducation)
  console.log('  写入的 education_requirement:', minEducation)
  console.log('  写入的 min_salary:', minSalary)
  console.log('  写入的 max_salary:', maxSalary)
  console.log('  写入的 location:', location)
  console.log('  写入的 core_skills:', JSON.stringify(coreSkills))
  console.log('  写入的 parsed_data 长度:', JSON.stringify(parsedData)?.length)

  const id = uuidv4()
  const newJob = await queryOne(
    `INSERT INTO jobs (
      id, company_id, title, jd_text, status, created_by, created_at, updated_at,
      min_experience, min_education, education_requirement, min_salary, max_salary, location, core_skills, parsed_data
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb)
     RETURNING *`,
    [
      id, companyId, title, jd_text, status || 'active', userId,
      minExperience, minEducation, minEducation, minSalary, maxSalary, location, coreSkills, parsedData
    ]
  )

  console.log('[JD解析] 步骤7 - 数据库写入完成 ✅')
  console.log('  岗位 ID:', newJob?.id)

  return NextResponse.json({ success: true, data: newJob })
}
