import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne, getClient } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
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

function extractJSON(text: string): any {
  if (!text || !text.trim()) return null

  // 策略 1: 直接解析
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object') return parsed
  } catch (e) { /* continue */ }

  // 策略 2: 从 Markdown 代码块提取
  const codeBlocks = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/gi)
  if (codeBlocks && codeBlocks.length > 0) {
    for (const block of codeBlocks) {
      const inner = block.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
      try {
        const parsed = JSON.parse(inner)
        if (parsed && typeof parsed === 'object') return parsed
      } catch (e) { /* continue */ }
    }
  }

  // 策略 3: 找到第一个 { 到最后一个 } 的范围
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const extracted = text.substring(firstBrace, lastBrace + 1)
    try {
      const parsed = JSON.parse(extracted)
      if (parsed && typeof parsed === 'object') return parsed
    } catch (e) { /* continue */ }
  }

  // 策略 4: 找到第一个 [ 到最后一个 ] 的范围
  const firstBracket = text.indexOf('[')
  const lastBracket = text.lastIndexOf(']')
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const extracted = text.substring(firstBracket, lastBracket + 1)
    try {
      const parsed = JSON.parse(extracted)
      if (parsed && typeof parsed === 'object') return parsed
    } catch (e) { /* continue */ }
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const companyId = session.user.company_id

    const body = await request.json()
    const { candidate_id, job_id, job_description, force } = body

    if (!candidate_id || !job_id || !job_description) {
      return NextResponse.json(
        { error: '缺少必要参数：candidate_id, job_id, job_description' },
        { status: 400 }
      )
    }

    console.log('\n========== [generate-interview-questions] 开始 ==========')
    console.log('candidate_id:', candidate_id)
    console.log('job_id:', job_id)
    console.log('force:', force)
    console.log('job_description 长度:', job_description.length)

    // ---- 缓存检查 ----
    if (!force) {
      console.log('[阶段 1] 检查缓存...')
      const existingQuestions = await queryOne<any>(
        `SELECT * FROM interview_questions WHERE candidate_id = $1 LIMIT 1`,
        [candidate_id]
      )

      if (existingQuestions) {
        const fraudCount = Array.isArray(existingQuestions.fraud_questions) ? existingQuestions.fraud_questions.length : 0
        const techCount = Array.isArray(existingQuestions.tech_questions) ? existingQuestions.tech_questions.length : 0
        const softCount = Array.isArray(existingQuestions.soft_questions) ? existingQuestions.soft_questions.length : 0

        if (fraudCount > 0 || techCount > 0 || softCount > 0) {
          console.log(`  ✅ 命中有效缓存: fraud=${fraudCount}, tech=${techCount}, soft=${softCount}`)
          return NextResponse.json({ success: true, data: existingQuestions, from_cache: true })
        } else {
          console.log('  ⚠️  缓存存在但内容为空，需要重新生成')
        }
      } else {
        console.log('  ❌ 无缓存记录，需要生成')
      }
    } else {
      console.log('[阶段 1] force=true，跳过缓存')
    }

    // ---- 获取候选人信息 ----
    console.log('[阶段 2] 查询候选人信息...')
    const candidate = await queryOne<any>(
      `SELECT * FROM candidates WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [candidate_id, companyId]
    )

    if (!candidate) {
      return NextResponse.json({ error: '候选人不存在' }, { status: 404 })
    }

    if (!candidate.parsed_data) {
      return NextResponse.json({ error: '候选人缺少解析后的数据 (parsed_data)' }, { status: 400 })
    }

    console.log('  ✅ 候选人:', candidate.name)
    console.log('  parsed_data 类型:', typeof candidate.parsed_data)

    const resumeDataStr = typeof candidate.parsed_data === 'string'
      ? candidate.parsed_data
      : JSON.stringify(candidate.parsed_data)

    console.log('  resume_data (传给 Coze 的参数) 长度:', resumeDataStr.length)
    console.log('  resume_data 前 200 字:', resumeDataStr.slice(0, 200))
    console.log('  jd_text 前 200 字:', job_description.slice(0, 200))

    // ---- 调用 Coze Workflow ----
    console.log('[阶段 3] 调用 Coze workflow (ID: 7642569989741346870)...')

    const cozeToken = process.env.COZE_API_KEY || ''
    if (!cozeToken) {
      throw new Error('COZE_API_KEY 环境变量未设置')
    }

    const coze = new CozeAPI({
      token: cozeToken,
      baseURL: 'https://api.coze.cn'
    })

    console.log('  传给 Coze 的 parameters:')
    console.log('    - resume_data (stringified JSON, 长度: ' + resumeDataStr.length + ')')
    console.log('    - jd_text (string, 长度: ' + job_description.length + ')')

    let interviewStream: any
    try {
      interviewStream = await coze.workflows.runs.stream({
        workflow_id: '7642569989741346870',
        parameters: {
          resume_data: resumeDataStr,
          jd_text: job_description
        }
      })
      console.log('  ✅ 已获取流对象，开始读取 chunks...')
    } catch (cozeErr: any) {
      console.error('  ❌ Coze API 调用失败:', cozeErr)
      throw new Error('Coze API 调用失败: ' + (cozeErr?.message || cozeErr?.code || JSON.stringify(cozeErr)))
    }

    // ---- 读取流响应 ----
    let interviewResult = ''
    let chunkCount = 0
    let allChunkData: any[] = []

    const isEmptyContent = (s: string): boolean => {
      if (!s) return true
      const trimmed = s.trim()
      if (trimmed === '') return true
      if (trimmed === '{}') return true
      if (trimmed === '[]') return true
      if (trimmed === 'null') return true
      return false
    }

    try {
      for await (const chunk of interviewStream) {
        chunkCount++
        if (chunkCount <= 10) {
          allChunkData.push(chunk)
        }

        // 尝试从多个可能的字段读取内容
        let contentVal: string | null = null

        if (chunk && typeof chunk === 'object') {
          const candidates = [
            (chunk as any).content,
            (chunk as any).data?.content,
            (chunk as any).data?.output,
            (chunk as any).output,
            (chunk as any).message,
            (chunk as any).message?.content,
            (chunk as any).text,
          ]
          for (const c of candidates) {
            if (c && typeof c === 'string' && !isEmptyContent(c)) {
              contentVal = c
              break
            }
          }
        }

        if (contentVal) {
          interviewResult += contentVal
        }
      }
    } catch (streamErr: any) {
      console.error('  ❌ 流读取失败:', streamErr)
      throw new Error('流读取失败: ' + (streamErr?.message || JSON.stringify(streamErr)))
    }

    console.log(`  ✅ 共收到 ${chunkCount} 个 chunk`)

    // 记录前几个 chunk 的完整结构用于调试
    if (allChunkData.length > 0) {
      console.log('  === chunk 调试信息 ===')
      allChunkData.forEach((c, i) => {
        console.log(`  chunk[${i}] 顶层 keys:`, Object.keys(c))
        if (c.data) {
          console.log(`  chunk[${i}].data keys:`, Object.keys(c.data))
          const contentStr = typeof c.data.content === 'string' ? c.data.content : JSON.stringify(c.data.content)
          console.log(`  chunk[${i}].data.content 前 200 字:`, String(contentStr).slice(0, 200))
        }
      })
    }

    console.log('  合并后 interviewResult 长度:', interviewResult.length)
    if (interviewResult.length > 0) {
      console.log('  interviewResult 前 500 字:', interviewResult.slice(0, 500))
      console.log('  interviewResult 后 500 字:', interviewResult.slice(-500))
    }

    // 额外清理：如果开头是 }{ 或 }{", 说明有多个 JSON 对象拼接，找到第一个完整对象的结尾
    // 更稳妥的做法：去掉所有前缀的空 {}，从第一个真正的 { 开始
    if (interviewResult) {
      const cleaned = interviewResult.replace(/^[\s{}]+/, '')
      if (cleaned !== interviewResult) {
        interviewResult = '{' + cleaned
        console.log('  🧹 清理空对象前缀后:', interviewResult.slice(0, 200))
      }
    }

    if (!interviewResult || interviewResult.trim().length < 5) {
      throw new Error('Coze workflow 返回内容为空或过短 (长度=' + interviewResult.length + ')')
    }

    // ---- 解析 JSON ----
    console.log('[阶段 4] 解析 JSON...')

    let interviewData: any = null
    let parseMethod = ''

    // 策略 A: 直接解析
    try {
      const parsed = JSON.parse(interviewResult)
      interviewData = parsed
      parseMethod = 'direct'
      console.log('  ✅ 策略 A (直接解析) 成功, keys:', Object.keys(parsed))
    } catch (e1) {
      console.log('  ⚠️  策略 A 失败:', (e1 as Error).message)
    }

    // 策略 B: 从文本中提取 JSON 片段
    if (!interviewData) {
      const extracted = extractJSON(interviewResult)
      if (extracted) {
        interviewData = extracted
        parseMethod = 'extracted'
        console.log('  ✅ 策略 B (文本提取) 成功, keys:', Object.keys(extracted))
      } else {
        console.log('  ⚠️  策略 B 失败')
      }
    }

    // 策略 C: 如果解析结果本身是字符串 (双重编码)，再解析一次
    if (interviewData && typeof interviewData === 'string') {
      console.log('  🔍 解析结果还是字符串，尝试再次解析...')
      console.log('  字符串前 200 字:', interviewData.slice(0, 200))
      try {
        const doubleParsed = JSON.parse(interviewData)
        interviewData = doubleParsed
        parseMethod = 'double_parse'
        console.log('  ✅ 策略 C (双重解析) 成功, keys:', Object.keys(doubleParsed))
      } catch (e2) {
        console.log('  ⚠️  策略 C 失败:', (e2 as Error).message)
        // 尝试从字符串中提取 JSON
        const inner = extractJSON(interviewData)
        if (inner) {
          interviewData = inner
          parseMethod = 'double_parse_extracted'
          console.log('  ✅ 策略 C-2 成功, keys:', Object.keys(inner))
        }
      }
    }

    // 策略 D: 如果顶层有 output 字段，优先用它
    if (interviewData && interviewData.output && typeof interviewData.output === 'string') {
      console.log('  🔍 发现 output 是字符串，尝试解析...')
      try {
        const outputParsed = JSON.parse(interviewData.output)
        interviewData = outputParsed
        parseMethod += ' -> output_parsed'
        console.log('  ✅ output 解析成功, keys:', Object.keys(outputParsed))
      } catch (e3) {
        const inner = extractJSON(interviewData.output)
        if (inner) {
          interviewData = inner
          parseMethod += ' -> output_extracted'
        }
      }
    } else if (interviewData && interviewData.output && typeof interviewData.output === 'object') {
      console.log('  ✅ 直接使用 output 对象, keys:', Object.keys(interviewData.output))
      interviewData = interviewData.output
      parseMethod += ' -> output_object'
    }

    // 策略 E: 如果还有 result/data/content 字段
    if (interviewData && typeof interviewData === 'object') {
      const tryKeys = ['result', 'data', 'content', 'response']
      for (const k of tryKeys) {
        const v = (interviewData as any)[k]
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          if (v.fraud_questions || v.tech_questions || v.questions || v.soft_questions) {
            console.log(`  ✅ 从 ${k} 字段找到题目数据`)
            interviewData = v
            parseMethod += ` -> ${k}`
            break
          }
        } else if (v && typeof v === 'string' && v.length > 20) {
          const inner = extractJSON(v)
          if (inner && (inner.fraud_questions || inner.tech_questions || inner.questions || inner.soft_questions)) {
            console.log(`  ✅ 从 ${k} 字段 (string) 解析到题目数据`)
            interviewData = inner
            parseMethod += ` -> ${k}_parsed`
            break
          }
        }
      }
    }

    console.log('  最终使用的解析方法:', parseMethod)
    console.log('  interviewData keys:', interviewData ? Object.keys(interviewData) : 'null')
    if (interviewData) {
      console.log('  interviewData 完整内容:', JSON.stringify(interviewData).slice(0, 2000))
    }

    // ---- 提取题目数组 ----
    console.log('[阶段 5] 提取题目数组...')

    let fraudQuestions: any[] = []
    let techQuestions: any[] = []
    let softQuestions: any[] = []

    const findInObject = (obj: any, depth: number = 0): void => {
      if (!obj || typeof obj !== 'object' || depth > 5) return

      const fraudKeys = ['fraud_questions', 'fraudQuestions', 'fraud', 'fraud_questions_list', 'resume_questions', 'resumeQuestions', 'resume', 'water_questions', 'dig_questions', 'fraud_list']
      const techKeys = ['tech_questions', 'techQuestions', 'tech', 'tech_questions_list', 'technical_questions', 'technicalQuestions', 'technical', 'skill_questions', 'skillQuestions', 'skill', 'technology_questions']
      const softKeys = ['soft_questions', 'softQuestions', 'soft', 'soft_questions_list', 'comprehensive_questions', 'comprehensiveQuestions', 'comprehensive', 'general_questions', 'behavioral_questions', 'quality_questions', 'quality']

      if (fraudQuestions.length === 0) {
        const found = extractQuestionsArray(obj, fraudKeys)
        if (found.length > 0) {
          console.log(`    🔍 找到 fraud_questions, 数量=${found.length}`)
          fraudQuestions = found
        }
      }
      if (techQuestions.length === 0) {
        const found = extractQuestionsArray(obj, techKeys)
        if (found.length > 0) {
          console.log(`    🔍 找到 tech_questions, 数量=${found.length}`)
          techQuestions = found
        }
      }
      if (softQuestions.length === 0) {
        const found = extractQuestionsArray(obj, softKeys)
        if (found.length > 0) {
          console.log(`    🔍 找到 soft_questions, 数量=${found.length}`)
          softQuestions = found
        }
      }

      if (fraudQuestions.length === 0 || techQuestions.length === 0 || softQuestions.length === 0) {
        for (const key of Object.keys(obj)) {
          const val = (obj as any)[key]
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            findInObject(val, depth + 1)
          }
        }
      }
    }

    if (interviewData && typeof interviewData === 'object') {
      findInObject(interviewData, 0)

      // 如果还没找到，遍历所有字段做启发式识别
      if (fraudQuestions.length === 0 || techQuestions.length === 0 || softQuestions.length === 0) {
        console.log('  🔄 启发式识别所有对象字段...')
        for (const key of Object.keys(interviewData)) {
          const val = (interviewData as any)[key]
          if (val && Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
            const firstItem = val[0]
            if (firstItem && (firstItem.question || firstItem.title || firstItem.content || firstItem.text || firstItem.questions)) {
              const lowerKey = key.toLowerCase()
              console.log(`    🔍 启发式: key="${key}", 包含 ${val.length} 个题目项`)
              if (lowerKey.includes('fraud') || lowerKey.includes('resume') || lowerKey.includes('water') || lowerKey.includes('dig')) {
                if (fraudQuestions.length === 0) fraudQuestions = val
              } else if (lowerKey.includes('tech') || lowerKey.includes('technical') || lowerKey.includes('skill') || lowerKey.includes('technology')) {
                if (techQuestions.length === 0) techQuestions = val
              } else if (lowerKey.includes('soft') || lowerKey.includes('comprehensive') || lowerKey.includes('general') || lowerKey.includes('behavior') || lowerKey.includes('quality')) {
                if (softQuestions.length === 0) softQuestions = val
              }
            }
          }
        }
      }

      // 最后策略：如果只有一个数组，把它当作三类题目都填充
      if (fraudQuestions.length === 0 && techQuestions.length === 0 && softQuestions.length === 0) {
        console.log('  🔄 终极策略：查找任何包含 question 的数组...')
        const allArrays = Object.entries(interviewData).filter(
          ([k, v]) => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object'
        )
        for (const [key, val] of allArrays) {
          const arr = val as any[]
          const firstItem = arr[0]
          if (firstItem && Object.keys(firstItem).some(k => k.toLowerCase().includes('question') || k.toLowerCase().includes('title'))) {
            console.log(`    ✅ 找到数组 key="${key}", 数量=${arr.length}, 分配给三类题目`)
            if (fraudQuestions.length === 0) fraudQuestions = arr
            if (techQuestions.length === 0) techQuestions = arr
            if (softQuestions.length === 0) softQuestions = arr
            break
          }
        }
      }
    }

    // ---- 规范化 ----
    console.log('[阶段 6] 规范化题目字段...')

    const normalizedFraud = fraudQuestions.map((q: any) => normalizeQuestionItem(q, 'fraud')).filter(Boolean) as any[]
    const normalizedTech = techQuestions.map((q: any) => normalizeQuestionItem(q, 'tech')).filter(Boolean) as any[]
    const normalizedSoft = softQuestions.map((q: any) => normalizeQuestionItem(q, 'soft')).filter(Boolean) as any[]

    console.log(`  ✅ fraud=${normalizedFraud.length}, tech=${normalizedTech.length}, soft=${normalizedSoft.length}`)

    // 如果结果仍然全为空，打印诊断信息但仍继续写入（不抛错！）
    if (normalizedFraud.length === 0 && normalizedTech.length === 0 && normalizedSoft.length === 0) {
      console.warn('  ⚠️  所有题目数组都为空')
      console.warn('  原始内容完整 2000 字:', interviewResult.slice(0, 2000))
      if (interviewData) {
        console.warn('  解析后的对象 keys:', Object.keys(interviewData))
      }
    }

    // ---- 写入数据库 (事务：DELETE 旧记录 + INSERT 新记录) ----
    console.log('[阶段 7] 写入数据库 (DELETE + INSERT)...')

    let savedRecord: any = null

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // 先删除该 candidate_id 的旧记录
      await client.query(
        `DELETE FROM interview_questions WHERE candidate_id = $1`,
        [candidate_id]
      )
      console.log('  ✅ 已删除 candidate_id=' + candidate_id + ' 的旧记录')

      // 插入新记录
      const { rows } = await client.query(
        `INSERT INTO interview_questions (
          id, candidate_id, job_id, fraud_questions, tech_questions, soft_questions, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
        [
          uuidv4(),
          candidate_id,
          job_id,
          normalizedFraud,
          normalizedTech,
          normalizedSoft
        ]
      )

      savedRecord = rows[0]
      console.log('  ✅ INSERT 成功, record id:', savedRecord.id)

      await client.query('COMMIT')
    } catch (dbErr: any) {
      await client.query('ROLLBACK')
      console.warn('  ⚠️  DB 写入异常，使用内存数据返回:', dbErr?.message)
      savedRecord = {
        id: 'temp-' + Date.now(),
        candidate_id,
        job_id,
        fraud_questions: normalizedFraud,
        tech_questions: normalizedTech,
        soft_questions: normalizedSoft
      }
    } finally {
      client.release()
    }

    console.log('========== [generate-interview-questions] 完成 ✅ ==========\n')

    return NextResponse.json({
      success: true,
      data: savedRecord,
      from_cache: false
    })

  } catch (error: any) {
    const errMsg = error instanceof Error ? error.message : (error?.message || '未知错误')
    console.error(`\n========== [generate-interview-questions] 错误 ❌ ==========`)
    console.error('错误:', errMsg)
    console.error(error)
    console.error(`==========================================================\n`)

    return NextResponse.json(
      {
        error: errMsg,
        detail: error instanceof Error ? { stack: error.stack, name: error.name } : error
      },
      { status: 500 }
    )
  }
}
