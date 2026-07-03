import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { CozeAPI } from '@coze/api'
import mammoth from 'mammoth'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { calculateHybridScore } from '@/lib/hybrid-scoring'

function safeDecodeURIComponent(str: string): string {
  if (!str) return ''
  try {
    return decodeURIComponent(str)
  } catch (e) {
    try {
      return str.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      )
    } catch (e2) {
      return str.replace(/%/g, '')
    }
  }
}

function deepParseJSON(value: any): any {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    const firstChar = trimmed.charAt(0)
    if (firstChar === '{' || firstChar === '[' || firstChar === '"') {
      try {
        const parsed = JSON.parse(trimmed)
        return deepParseJSON(parsed)
      } catch {
        return value
      }
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map(item => deepParseJSON(item))
  }
  if (typeof value === 'object') {
    const result: Record<string, any> = {}
    for (const key of Object.keys(value)) {
      result[key] = deepParseJSON(value[key])
    }
    return result
  }
  return value
}

function toJSONObjectForPG(value: any): Record<string, any> {
  if (value === null || value === undefined) return {}
  const parsed = deepParseJSON(value)
  if (parsed === null || parsed === undefined) return {}
  if (typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed
  }
  if (Array.isArray(parsed)) {
    return { data: parsed }
  }
  return { text: String(parsed) }
}

function serializeForJSON(value: any): string {
  try {
    const cleaned = deepParseJSON(value)
    const str = JSON.stringify(cleaned ?? null)
    JSON.parse(str)
    return str
  } catch (e) {
    console.warn('[serializeForJSON] 序列化失败:', e, '原始值:', typeof value, String(value).substring(0, 200))
    return JSON.stringify({ text: String(value ?? '').substring(0, 10000) })
  }
}

const STEPS = [
  { id: 1, text: '正在读取简历文件', detail: '正在读取简历文件' },
  { id: 2, text: '正在解析简历内容', detail: '正在解析简历文本' },
  { id: 3, text: 'AI正在分析简历信息', detail: '解析简历' },
  { id: 4, text: 'AI正在对比岗位要求', detail: '人岗匹配' },
  { id: 5, text: '正在保存匹配结果', detail: '保存数据' },
]

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  let streamClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (stepId: number, status: 'start' | 'done', customText?: string) => {
          if (streamClosed) return
          const step = STEPS.find(s => s.id === stepId)
          const text = customText || step?.text || ''
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', stepId, text, status })}\n\n`))
        }

      const sendError = (message: string) => {
          if (streamClosed) return
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`))
          controller.close()
          streamClosed = true
        }

      const sendSuccess = (data: any) => {
          if (streamClosed) return
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', data })}\n\n`))
          controller.close()
          streamClosed = true
        }

      try {
        console.log('===== [上传简历] 流程开始 =====')
        sendProgress(1, 'start')

        const session = await getServerSession(authOptions)
        if (!session?.user) {
          sendError('未授权')
          return
        }
        const companyId = session.user.company_id
        console.log('[步骤1] 会话验证成功, company_id:', companyId)

        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const jobId = formData.get('jobId') as string | null
        const jdText = formData.get('jdText') as string | null

        console.log('[步骤1] 表单参数:')
        console.log('  file:', file ? `${file.name} (${file.size} bytes)` : 'null')
        console.log('  jobId:', jobId)
        console.log('  jdText 长度:', jdText ? jdText.length : 0)
        console.log('  jdText 前200字:', jdText ? jdText.substring(0, 200) : '(空)')

        if (!file || !jobId || !jdText) {
          console.log('[错误] 缺少必要参数')
          sendError('缺少必要参数')
          return
        }

        const coze = new CozeAPI({
          token: process.env.COZE_API_KEY || '',
          baseURL: 'https://api.coze.cn'
        })

        sendProgress(1, 'done')
        sendProgress(2, 'start')

        const fileName = file.name.toLowerCase()
        let resumeText = ''

        if (fileName.endsWith('.docx')) {
          console.log('[步骤2] 正在解析 DOCX 文件...')
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const result = await mammoth.extractRawText({ buffer })
          resumeText = result.value
          console.log('[步骤2] DOCX 解析完成, resumeText 长度:', resumeText.length)
        } else if (fileName.endsWith('.pdf')) {
          console.log('[步骤2] 正在解析 PDF 文件...')
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          resumeText = await new Promise<string>((resolve, reject) => {
            const PDFParser = require('pdf2json')
            const pdfParser = new PDFParser()

            pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
              const pages = pdfData.Pages || []
              console.log(`[步骤2] PDF 共 ${pages.length} 页`)
              const pageTexts = pages.map((page: any) => {
                const texts = page.Texts || []
                return texts
                  .map((t: any) => safeDecodeURIComponent(t.R?.[0]?.T || ''))
                  .join(' ')
              })
              resolve(pageTexts.join('\n'))
            })

            pdfParser.on('pdfParser_dataError', (err: any) => {
              reject(new Error(err?.parserError || 'PDF解析失败'))
            })

            const tmpPath = join(tmpdir(), `${Date.now()}.pdf`)
            writeFileSync(tmpPath, buffer)
            pdfParser.loadPDF(tmpPath)

            pdfParser.on('pdfParser_dataReady', () => {
              try { unlinkSync(tmpPath) } catch {}
            })
          })
          console.log('[步骤2] PDF 解析完成, resumeText 长度:', resumeText.length)
        } else {
          sendError('仅支持 .docx 和 .pdf 格式')
          return
        }

        console.log('[步骤2] resumeText 前300字:', resumeText.substring(0, 300))

        sendProgress(2, 'done')
        sendProgress(3, 'start')

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const injectedResumeText = `【系统提示：当前真实时间是 ${currentYear}年${currentMonth}月，请以此计算"至今"的工作年限】\n\n=== 以下为候选人简历正文 ===\n\n${resumeText}`;
        console.log("[步骤3] 已注入当前时间上下文, 长度:", injectedResumeText.length)

        const cozeParams = { injectedResumeText: injectedResumeText }
        console.log("[步骤3-Debug] 准备发送给 Coze 的参数对象:", cozeParams)
        console.log('[步骤3] 调用 Coze 简历解析工作流...')
        const parseStream = await coze.workflows.runs.stream({
          workflow_id: '7641517139460079657',
          parameters: cozeParams
        })

        let parseResult = ''
        let parseChunkCount = 0
        for await (const chunk of parseStream) {
          const data = chunk.data as any
          if (data?.content) {
            parseResult += data.content
            parseChunkCount++
          }
        }
        console.log('[步骤3] Coze 原始响应 parseResult 长度:', parseResult.length, 'chunks:', parseChunkCount)
        console.log('[步骤3] Coze 原始响应 parseResult 内容:', parseResult.substring(0, 500))

        let parsedData: any = null
        try {
          parsedData = JSON.parse(parseResult)
          console.log('[步骤3] 初步解析成功, top-level keys:', Object.keys(parsedData))
          if (parsedData.output) {
            parsedData = parsedData.output
            console.log('[步骤3] 提取 output, keys:', Object.keys(parsedData))
          } else if (parsedData.data) {
            parsedData = parsedData.data
            console.log('[步骤3] 提取 data, keys:', Object.keys(parsedData))
          } else if (parsedData.result) {
            parsedData = parsedData.result
            console.log('[步骤3] 提取 result, keys:', Object.keys(parsedData))
          }
        } catch (e) {
          console.warn('[步骤3] JSON.parse 失败, 使用原始结果:', e)
          parsedData = { raw_result: parseResult }
        }

        console.log('[步骤3] 最终 parsedData 完整内容:', JSON.stringify(parsedData, null, 2))

        if (!parsedData) {
          console.log('[步骤3] parsedData 为空, 使用默认值')
          parsedData = {
            personal_info: { name: '未知' },
            work_experience: [],
            experience_years: null,
            age: null,
            expected_min_salary: null,
            expected_max_salary: null
          }
        }

        if (!parsedData.work_experience || !Array.isArray(parsedData.work_experience)) {
          console.log('[步骤3] work_experience 不存在或不是数组, 设为 []')
          parsedData.work_experience = []
        }

        if (!parsedData.personal_info) {
          console.log('[步骤3] personal_info 不存在, 使用默认值')
          parsedData.personal_info = { name: '未知' }
        }

        console.log('[步骤3] 修正后的 parsedData 字段:')
        console.log('  name:', parsedData.name)
        console.log('  personal_info:', JSON.stringify(parsedData.personal_info))
        console.log('  work_experience 数量:', parsedData.work_experience?.length || 0)
        console.log('  work_experience 第一项:', JSON.stringify(parsedData.work_experience?.[0] || null))
        console.log('  experience_years:', parsedData.experience_years)
        console.log('  age:', parsedData.age)
        console.log('  expected_min_salary:', parsedData.expected_min_salary)
        console.log('  expected_max_salary:', parsedData.expected_max_salary)
        console.log('  skills:', JSON.stringify(parsedData.skills))

        sendProgress(3, 'done')
        sendProgress(4, 'start')

        console.log('[步骤4] 保存候选人数据 + 调用三层混合打分引擎...')

        if (Array.isArray(parsedData.skills) && parsedData.skills.length > 0 && typeof parsedData.skills[0] === 'string') {
          console.log('[步骤4] skills 是字符串数组, 转换为对象数组')
          parsedData.skills = parsedData.skills.map((s: string) => ({ name: s }))
        }

        console.log('\n' + '='.repeat(60))
        console.log('[步骤4-Mapping] ======== 字段映射调试开始 ========')
        console.log('='.repeat(60))

        // 1. name 字段提取
        const nameRaw = parsedData.name || parsedData.personal_info?.name || null
        const candidateName = nameRaw || '未知'
        console.log('[步骤4-Mapping] 【name 字段】')
        console.log('  原始值(parsedData.name):', nameRaw, !nameRaw ? '⚠️ 为空' : '')
        console.log('  兜底逻辑: parsedData.name || personal_info.name || "未知"')
        console.log('  最终值:', candidateName)

        // 2. experience_years 字段提取（工作年限，整数）
        const experienceYears = Number(parsedData.experience_years) || 0
        console.log('[步骤4-Mapping] 【experience_years 字段（工作年限）】')
        console.log('  原始值(parsedData.experience_years):', parsedData.experience_years)
        console.log('  最终值:', experienceYears, '年')

        // 3. education 字段提取（学历）
        let education = ''
        const degreeLevelRaw = parsedData.degree_level
        console.log('[步骤4-Mapping] 【education 字段（学历）】')
        console.log('  原始值(parsedData.degree_level):', degreeLevelRaw, !degreeLevelRaw ? '⚠️ 为空' : '')

        if (degreeLevelRaw && typeof degreeLevelRaw === 'string') {
          education = degreeLevelRaw
          console.log('  提取逻辑: 直接使用 degree_level →', education)
        } else if (parsedData.education && Array.isArray(parsedData.education) && parsedData.education.length > 0) {
          education = parsedData.education[0]?.degree || ''
          console.log('  备用逻辑: education[0].degree →', education)
        }

        if (!education) {
          console.log('  ⚠️ 最终值为空字符串')
        } else {
          console.log('  最终值:', education)
        }

        console.log('-'.repeat(60))

        // 4. 其他字段提取
        const age = typeof parsedData.age === 'number' && !isNaN(parsedData.age)
          ? parsedData.age
          : (typeof parsedData.personal_info?.age === 'number' && !isNaN(parsedData.personal_info?.age)
            ? parsedData.personal_info.age
            : null)

        let currentCompany = ''
        const workExp = parsedData.work_experience
        if (Array.isArray(workExp) && workExp.length > 0) {
          for (const exp of workExp) {
            if (exp.company) {
              currentCompany = exp.company
              break
            }
          }
        }

        const expectedMinSalary = typeof parsedData.expected_min_salary === 'number' && !isNaN(parsedData.expected_min_salary) ? parsedData.expected_min_salary : null
        const expectedMaxSalary = typeof parsedData.expected_max_salary === 'number' && !isNaN(parsedData.expected_max_salary) ? parsedData.expected_max_salary : null

        console.log('[步骤4-Mapping] 【其他字段】')
        console.log('  age:', age)
        console.log('  current_company:', currentCompany)
        console.log('  expected_min_salary:', expectedMinSalary)
        console.log('  expected_max_salary:', expectedMaxSalary)
        console.log('='.repeat(60) + '\n')

        const candidateId = uuidv4()
        console.log('[步骤4] 生成 candidateId:', candidateId)

        const cleanParsedData = deepParseJSON(parsedData)
        console.log('[步骤4] 清洗 parsed_data 前类型:', typeof parsedData, '后类型:', typeof cleanParsedData)
        console.log('[步骤4] 清洗 parsed_data 前300字:', JSON.stringify(cleanParsedData).substring(0, 300))

        const jsonParsedData = serializeForJSON(cleanParsedData)
        console.log('[步骤4] parsed_data 序列化后长度:', jsonParsedData.length, '预览:', jsonParsedData.substring(0, 200))

        console.log('[步骤4] 即将 INSERT INTO candidates, 参数:')
        console.log('  id:', candidateId)
        console.log('  company_id:', companyId)
        console.log('  job_id:', jobId)
        console.log('  name:', candidateName)
        console.log('  raw_text 长度:', resumeText.length)
        console.log('  parsed_data(json str) 长度:', jsonParsedData.length)
        console.log('  experience_years:', experienceYears, '(integer)')
        console.log('  age:', age)
        console.log('  education:', education)
        console.log('  current_company:', currentCompany)
        console.log('  expected_min_salary:', expectedMinSalary)
        console.log('  expected_max_salary:', expectedMaxSalary)

        const candidateResult = await queryOne<any>(
          `INSERT INTO candidates (
            id, company_id, job_id, name, raw_text, parsed_data, status, source,
            experience_years, age, current_company, expected_min_salary, expected_max_salary, education, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6::json, $7, $8, $9, $10, $11, $12, $13, $14, NOW()) RETURNING *`,
          [
            candidateId,
            companyId,
            jobId,
            candidateName,
            resumeText,
            jsonParsedData,
            'pending',
            'upload',
            experienceYears,
            age,
            currentCompany,
            expectedMinSalary,
            expectedMaxSalary,
            education
          ]
        )

        if (!candidateResult) {
          throw new Error('插入候选人数据失败')
        }

        const candidate = candidateResult
        console.log('[步骤4] INSERT INTO candidates 成功, 返回的 candidate keys:', Object.keys(candidate))
        console.log('[步骤4] 返回的 candidate:', JSON.stringify(candidate, null, 2))

        // 调用三层混合打分引擎
        console.log('[步骤4] 调用 calculateHybridScore...')
        const scoringResult = await calculateHybridScore(candidateId, jobId, companyId)
        console.log('[步骤4] 混合打分完成, total_score:', scoringResult.total_score)

        // 风险标签动态逻辑
        // 1. 优先获取大模型返回的精准业务标签（根据你的接口结构，从 layer3 或 project_exp 中提取），读不到则默认 '低风险'
        let riskTag = scoringResult.layer3?.risk_tag || scoringResult.project_exp?.risk_tag || '低风险'

        // 2. 拦截 Layer 1 淘汰者，强制覆盖风险标签（优先级最高）
        if (scoringResult.hard_condition && !scoringResult.hard_condition.passed) {
          const failedDetails = scoringResult.hard_condition.details.filter((d: any) => !d.matched)
          const failedNames = failedDetails.map((d: any) => d.name)
          console.log('[步骤4] Layer 1 淘汰，未通过项:', failedNames)

          if (failedNames.includes('学历要求') && failedNames.includes('工作经验')) {
            riskTag = '学历与经验不符'
          } else if (failedNames.includes('学历要求')) {
            riskTag = '学历不符'
          } else if (failedNames.includes('工作经验')) {
            riskTag = '经验不足'
          } else {
            riskTag = '硬性条件不符'
          }
        }

        console.log('[步骤4] 最终风险标签:', riskTag)

        // 更新候选人的 risk_tag
        await query(
          `UPDATE candidates SET risk_tag = $1 WHERE id = $2`,
          [riskTag, candidateId]
        )
        candidate.risk_tag = riskTag

        sendProgress(4, 'done')
        sendProgress(5, 'start')

        // 组装兼容旧版的数据结构
        const matchData = {
          total_score: scoringResult.total_score,
          hard_condition: scoringResult.hard_condition,
          tech_skill: {
            vector_similarity: scoringResult.vector_similarity,
            matched_skills: [],
            missing_skills: [],
            extra_skills: [],
            total_score: scoringResult.vector_similarity?.score || 0,
            max_score: scoringResult.vector_similarity?.max_score || 40
          },
          project_exp: scoringResult.project_exp,
          risk_penalty: scoringResult.risk_penalty,
          risk_block: scoringResult.risk_block,
          risk_tag: riskTag,
          match_advantages: scoringResult.match_advantages || []
        }

        const safeHardCondition = toJSONObjectForPG(matchData.hard_condition)
        const safeTechSkill = toJSONObjectForPG(matchData.tech_skill)
        const safeProjectExp = toJSONObjectForPG(matchData.project_exp)
        const safeRiskPenalty = toJSONObjectForPG(matchData.risk_penalty)
        const safeRiskBlock = matchData.risk_block ? toJSONObjectForPG(matchData.risk_block) : null
        const safeMatchAdvantages = Array.isArray(matchData.match_advantages) ? matchData.match_advantages : []

        const jsonHardCondition = serializeForJSON(safeHardCondition)
        const jsonTechSkill = serializeForJSON(safeTechSkill)
        const jsonProjectExp = serializeForJSON(safeProjectExp)
        const jsonRiskPenalty = serializeForJSON(safeRiskPenalty)
        const jsonRiskBlock = safeRiskBlock ? serializeForJSON(safeRiskBlock) : serializeForJSON(null)
        const jsonMatchAdvantages = serializeForJSON(safeMatchAdvantages)

        console.log('[步骤5] 即将 INSERT INTO match_results, 参数:')
        console.log('  total_score:', matchData.total_score, '(类型:', typeof matchData.total_score, ')')
        console.log('  hard_condition(json str):', jsonHardCondition.substring(0, 150))
        console.log('  tech_skill(json str):', jsonTechSkill.substring(0, 150))
        console.log('  project_exp(json str):', jsonProjectExp.substring(0, 150))
        console.log('  risk_penalty(json str):', jsonRiskPenalty.substring(0, 150))
        console.log('  risk_block(json str):', jsonRiskBlock.substring(0, 150))
        console.log('  match_advantages(json str):', jsonMatchAdvantages.substring(0, 150))

        const finalScore = Math.round(scoringResult.total_score);

        await query(
          `INSERT INTO match_results (
            id, candidate_id, job_id, total_score, hard_condition, tech_skill, project_exp,
            risk_penalty, risk_block, match_advantages, created_at
          ) VALUES ($1, $2, $3, $4, $5::json, $6::json, $7::json, $8::json, $9::json, $10::json, NOW())`,
          [
            uuidv4(),
            candidate.id,
            jobId,
            finalScore,
            jsonHardCondition,
            jsonTechSkill,
            jsonProjectExp,
            jsonRiskPenalty,
            jsonRiskBlock,
            jsonMatchAdvantages,
          ]
        )
        console.log('[步骤5] INSERT INTO match_results 成功')

        console.log('===== [上传简历] 流程结束 =====')

        sendProgress(5, 'done')
        sendSuccess({ candidate, matchResult: matchData })

      } catch (error) {
        console.error('===== [上传简历] 流程报错 =====')
        console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error)
        console.error('错误信息:', error instanceof Error ? error.message : String(error))
        console.error('错误堆栈:', error instanceof Error ? error.stack : '无堆栈')
        console.error('完整错误对象:', error)
        console.error('===============================')
        let errorMessage = '未知错误'
        if (error instanceof Error) {
          errorMessage = error.message
        } else if (typeof error === 'string') {
          errorMessage = error
        } else if (error && typeof error === 'object') {
          errorMessage = (error as any).message || (error as any).error || '未知错误'
        }
        sendError(errorMessage)
      }
    }
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
