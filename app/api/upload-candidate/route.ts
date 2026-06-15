import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CozeAPI } from '@coze/api'
import mammoth from 'mammoth'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

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
        sendProgress(1, 'start')

        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const jobId = formData.get('jobId') as string | null
        const companyId = formData.get('companyId') as string | null
        const jdText = formData.get('jdText') as string | null

        if (!file || !jobId || !companyId || !jdText) {
          sendError('缺少必要参数')
          return
        }

        const supabase = createClient()
        const coze = new CozeAPI({
          token: process.env.COZE_API_KEY || '',
          baseURL: 'https://api.coze.cn'
        })

        sendProgress(1, 'done')
        sendProgress(2, 'start')

        const fileName = file.name.toLowerCase()
        let resumeText = ''

        if (fileName.endsWith('.docx')) {
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const result = await mammoth.extractRawText({ buffer })
          resumeText = result.value
        } else if (fileName.endsWith('.pdf')) {
          const arrayBuffer = await file.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          resumeText = await new Promise<string>((resolve, reject) => {
            const PDFParser = require('pdf2json')
            const pdfParser = new PDFParser()

            pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
              const pages = pdfData.Pages || []
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
        } else {
          sendError('仅支持 .docx 和 .pdf 格式')
          return
        }

        sendProgress(2, 'done')
        sendProgress(3, 'start')

        const parseStream = await coze.workflows.runs.stream({
          workflow_id: '7641517139460079657',
          parameters: { resume_text: resumeText }
        })

        let parseResult = ''
        for await (const chunk of parseStream) {
          const data = chunk.data as any
          if (data?.content) {
            parseResult += data.content
          }
        }

        let parsedData: any = null
        try {
          parsedData = JSON.parse(parseResult)
          if (parsedData.output) {
            parsedData = parsedData.output
          } else if (parsedData.data) {
            parsedData = parsedData.data
          } else if (parsedData.result) {
            parsedData = parsedData.result
          }
        } catch (e) {
          parsedData = { raw_result: parseResult }
        }

        if (!parsedData) {
          parsedData = {
            personal_info: { name: '未知' },
            work_experience: [],
            expected_salary: ''
          }
        }

        if (!parsedData.work_experience || !Array.isArray(parsedData.work_experience)) {
          parsedData.work_experience = []
        }

        if (!parsedData.personal_info) {
          parsedData.personal_info = { name: '未知' }
        }

        sendProgress(3, 'done')
        sendProgress(4, 'start')

        const matchStream = await coze.workflows.runs.stream({
          workflow_id: '7642566426397655059',
          parameters: { resume_data: JSON.stringify(parsedData), jd_text: jdText }
        })

        let matchResult = ''
        for await (const chunk of matchStream) {
          const data = chunk.data as any
          if (data?.content) {
            matchResult += data.content
          }
        }

        let matchData: any = null
        try {
          matchData = JSON.parse(matchResult)
          if (matchData.output) {
            matchData = matchData.output
          } else if (matchData.data) {
            matchData = matchData.data
          } else if (matchData.result) {
            matchData = matchData.result
          }
        } catch (e) {
          matchData = { raw_result: matchResult }
        }

        if (!matchData) {
          matchData = {
            total_score: 0,
            hard_condition: {},
            tech_skill: {},
            project_exp: {},
            risk_penalty: {},
            risk_block: null,
            risk_tag: ''
          }
        }

        sendProgress(4, 'done')
        sendProgress(5, 'start')

        if (Array.isArray(parsedData.skills) && parsedData.skills.length > 0 && typeof parsedData.skills[0] === 'string') {
          parsedData.skills = parsedData.skills.map((s: string) => ({ name: s }))
        }

        const workYearsStr = parsedData.work_years || parsedData.personal_info?.work_years || ''
        let workYears: number | null = null
        const workYearsMatch = String(workYearsStr).match(/(\d+(\.\d+)?)/)
        if (workYearsMatch) {
          workYears = Math.round(parseFloat(workYearsMatch[1]))
        }

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

        const candidateName = parsedData.name || parsedData.personal_info?.name || '未知'
        const salaryExpectation = parsedData.expected_salary || ''
        const riskTag = matchData.risk_tag || ''

        const { data: candidateResult, error: candidateError } = await supabase
          .from('candidates')
          .insert({
            company_id: companyId,
            job_id: jobId,
            name: candidateName,
            raw_text: resumeText,
            parsed_data: parsedData,
            status: 'pending',
            source: 'upload',
            work_years: workYears,
            current_company: currentCompany,
            risk_tag: riskTag,
            salary_expectation: salaryExpectation
          })
          .select()

        if (candidateError) {
          throw candidateError
        }

        if (!candidateResult || candidateResult.length === 0) {
          throw new Error('插入候选人数据失败')
        }

        const candidate = candidateResult[0]

        const { error: matchError } = await supabase
          .from('match_results')
          .insert({
            candidate_id: candidate.id,
            job_id: jobId,
            total_score: (matchData.total_score ?? 0) as number,
            hard_condition: matchData.hard_condition || {},
            tech_skill: matchData.tech_skill || {},
            project_exp: matchData.project_exp || {},
            risk_penalty: matchData.risk_penalty || {},
            risk_block: matchData.risk_block || null,
            updated_at: new Date().toISOString()
          })

        if (matchError) {
          throw matchError
        }

        sendProgress(5, 'done')
        sendSuccess({ candidate, matchResult: matchData })

      } catch (error) {
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
