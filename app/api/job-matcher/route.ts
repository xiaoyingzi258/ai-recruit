import { NextRequest, NextResponse } from 'next/server'
import { CozeAPI } from '@coze/api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('=== job-matcher 收到请求 ===', body)
    const { resume_data: resume_text, jd_text: job_description } = body
    
    if (!resume_text) {
      console.log('=== job-matcher resume_text 为空 ===')
      return NextResponse.json({ error: '请提供简历文本' }, { status: 400 })
    }

    if (!job_description) {
      return NextResponse.json({ error: '请提供岗位描述' }, { status: 400 })
    }

    console.log('收到人岗匹配请求，简历长度:', resume_text.length, '岗位描述长度:', job_description.length)

    console.log('开始调用 Coze job_matcher 工作流...')
    const coze = new CozeAPI({
      token: process.env.COZE_API_KEY || '',
      baseURL: 'https://api.coze.cn'
    })

    const stream = await coze.workflows.runs.stream({
      workflow_id: '7642566426397655059',
      parameters: { resume_data: resume_text, jd_text: job_description }
    })

    // 3. 收集流式响应结果
    let finalResult = ''
    console.log('开始收集流式响应...')
    for await (const chunk of stream) {
      console.log('=== job-matcher chunk ===', JSON.stringify(chunk, null, 2));
      const data = chunk.data as any
      if (data?.content) {
        finalResult += data.content
      }
    }

    console.log('最终收集的结果:', finalResult)

    let parsedData
    try {
      parsedData = JSON.parse(finalResult)
      // 取里面的 output
      parsedData = parsedData.output
    } catch (e) {
      parsedData = { raw_result: finalResult }
    }

    return NextResponse.json({
      success: true,
      data: parsedData
    })

  } catch (error) {
    console.error('人岗匹配失败:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : '匹配失败'
    }, { status: 500 })
  }
}
