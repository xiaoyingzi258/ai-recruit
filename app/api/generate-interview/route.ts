import { NextRequest, NextResponse } from 'next/server'
import { CozeAPI } from '@coze/api'

function extractQuestionsArray(raw: any, keys: string[]): any[] {
  if (!raw || typeof raw !== 'object') return []
  for (const k of keys) {
    const val = raw[k]
    if (val && Array.isArray(val) && val.length > 0) return val
  }
  return []
}

function normalizeQuestionItem(item: any, type: string): any {
  if (!item || typeof item !== 'object') return null
  if (type === 'fraud') {
    return {
      question: item.question || item.title || item.content || item.text || '',
      anchor: item.anchor || item.resume_anchor || item.reference || item.original_text || item.context || '',
      follow_up: item.follow_up || item.followup || item.follow || item.next_question || '',
      excellent_benchmark: item.excellent_benchmark || item.excellent || item.good_answer || item.reference_answer || '',
      pitfall_warning: item.pitfall_warning || item.pitfall || item.warning || item.trap || '',
    }
  }
  if (type === 'tech') {
    return {
      question: item.question || item.title || item.content || item.text || '',
      difficulty: item.difficulty || item.level || item.rating || 'junior',
      follow_up: item.follow_up || item.followup || item.follow || item.next_question || '',
      full_score_benchmark: item.full_score_benchmark || item.full_score || item.excellent_answer || item.reference_answer || '',
      pass_level: item.pass_level || item.pass || item.minimum || item.baseline || '',
    }
  }
  if (type === 'soft') {
    return {
      question: item.question || item.title || item.content || item.text || '',
      assess_dimension: item.assess_dimension || item.dimension || item.category || item.assessment || '',
      follow_up: item.follow_up || item.followup || item.follow || item.next_question || '',
      excellent_benchmark: item.excellent_benchmark || item.excellent || item.good_answer || item.reference_answer || '',
      pitfall_warning: item.pitfall_warning || item.pitfall || item.warning || item.trap || '',
    }
  }
  return null
}

function parseInterviewJSON(rawText: string): any {
  const trimmed = rawText.trim()
  if (!trimmed) return null

  const jsonBlocks = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/gi)
  if (jsonBlocks && jsonBlocks.length > 0) {
    for (const block of jsonBlocks) {
      const inner = block.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
      try {
        return JSON.parse(inner)
      } catch (e) {
        // 继续尝试
      }
    }
  }

  const firstBrace = trimmed.indexOf('{')
  const firstBracket = trimmed.indexOf('[')
  const lastBrace = trimmed.lastIndexOf('}')
  const lastBracket = trimmed.lastIndexOf(']')

  let startIdx = -1
  let endIdx = -1

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace
    endIdx = lastBrace
  } else if (firstBracket !== -1) {
    startIdx = firstBracket
    endIdx = lastBracket
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const extracted = trimmed.substring(startIdx, endIdx + 1)
    try {
      return JSON.parse(extracted)
    } catch (e) {
      // 继续尝试
    }
  }

  try {
    return JSON.parse(trimmed)
  } catch (e) {
    // 继续尝试
  }

  try {
    const fixed = trimmed
      .replace(/(['"])?([a-zA-Z_][a-zA-Z0-9_]*)(['"])?\s*:/g, '"$2":')
      .replace(/,\s*([\]}])/g, '$1')
      .replace(/:(['"])([^'"]*),([^'"]*)\1/g, ':"$2，$3"')
    return JSON.parse(fixed)
  } catch (e) {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('=== generate-interview 收到请求 ===', body)
    const { resume_data: resumeText, jd_text: jobDescription } = body

    if (!resumeText) {
      console.log('=== generate-interview resumeText 为空 ===')
      return NextResponse.json({ error: '请提供简历文本' }, { status: 400 })
    }

    if (!jobDescription) {
      return NextResponse.json({ error: '请提供岗位描述' }, { status: 400 })
    }

    console.log('收到简历文本，长度:', resumeText.length, '岗位描述长度:', jobDescription.length)

    console.log('开始调用 Coze interview_generator 工作流 (workflow_id=7642569989741346870)...')
    const coze = new CozeAPI({
      token: process.env.COZE_API_KEY || '',
      baseURL: 'https://api.coze.cn'
    })

    const stream = await coze.workflows.runs.stream({
      workflow_id: '7642569989741346870',
      parameters: { resume_data: resumeText, jd_text: jobDescription }
    })

    let finalResult = ''
    let chunkCount = 0
    console.log('开始收集流式响应...')
    for await (const chunk of stream) {
      chunkCount++
      console.log('=== generate-interview chunk #' + chunkCount + ' keys:', Object.keys(chunk.data || {}));
      const data = chunk.data as any
      if (data?.content) {
        finalResult += data.content
      }
    }

    console.log('共收到 chunk:', chunkCount, '，最终收集的结果长度:', finalResult.length)
    console.log('最终收集的结果前500字:', finalResult.slice(0, 500))

    const parsedRaw = parseInterviewJSON(finalResult)
    console.log('解析后原始对象 keys:', parsedRaw ? Object.keys(parsedRaw) : 'null')
    if (parsedRaw) {
      console.log('解析后原始对象完整内容:', JSON.stringify(parsedRaw).slice(0, 1000))
    }

    let parsedData: any = parsedRaw
    let fraudQuestions: any[] = []
    let techQuestions: any[] = []
    let softQuestions: any[] = []

    if (parsedData && typeof parsedData === 'object') {
      if (parsedData.output && typeof parsedData.output === 'object') {
        const output = parsedData.output
        fraudQuestions = extractQuestionsArray(output, [
          'fraud_questions', 'fraudQuestions', 'fraud', 'fraud_questions_list',
          'resume_questions', 'resumeQuestions', 'resume',
          'water_questions', 'dig_questions', 'fraud_list'
        ])
        techQuestions = extractQuestionsArray(output, [
          'tech_questions', 'techQuestions', 'tech', 'tech_questions_list',
          'technical_questions', 'technicalQuestions', 'technical',
          'skill_questions', 'skillQuestions', 'skill'
        ])
        softQuestions = extractQuestionsArray(output, [
          'soft_questions', 'softQuestions', 'soft', 'soft_questions_list',
          'comprehensive_questions', 'comprehensiveQuestions', 'comprehensive',
          'general_questions', 'behavioral_questions', 'quality_questions'
        ])
      }

      if (fraudQuestions.length === 0 && techQuestions.length === 0 && softQuestions.length === 0) {
        fraudQuestions = extractQuestionsArray(parsedData, [
          'fraud_questions', 'fraudQuestions', 'fraud', 'fraud_questions_list',
          'resume_questions', 'resumeQuestions', 'resume'
        ])
        techQuestions = extractQuestionsArray(parsedData, [
          'tech_questions', 'techQuestions', 'tech', 'tech_questions_list',
          'technical_questions', 'technicalQuestions', 'technical',
          'skill_questions', 'skillQuestions', 'skill'
        ])
        softQuestions = extractQuestionsArray(parsedData, [
          'soft_questions', 'softQuestions', 'soft', 'soft_questions_list',
          'comprehensive_questions', 'comprehensiveQuestions', 'comprehensive',
          'general_questions', 'behavioral_questions', 'quality_questions'
        ])
      }
    }

    const normalizedFraud = fraudQuestions.map((q: any) => normalizeQuestionItem(q, 'fraud')).filter(Boolean) as any[]
    const normalizedTech = techQuestions.map((q: any) => normalizeQuestionItem(q, 'tech')).filter(Boolean) as any[]
    const normalizedSoft = softQuestions.map((q: any) => normalizeQuestionItem(q, 'soft')).filter(Boolean) as any[]

    console.log('规范化结果:')
    console.log('  - fraud_questions:', normalizedFraud.length)
    console.log('  - tech_questions:', normalizedTech.length)
    console.log('  - soft_questions:', normalizedSoft.length)

    const finalResponse = {
      fraud_questions: normalizedFraud,
      tech_questions: normalizedTech,
      soft_questions: normalizedSoft,
      raw_result: finalResult
    }

    return NextResponse.json({
      success: true,
      data: finalResponse
    })

  } catch (error) {
    console.error('面试题生成失败:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : '生成失败'
    }, { status: 500 })
  }
}
