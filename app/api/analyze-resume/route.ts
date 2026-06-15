import { NextRequest, NextResponse } from 'next/server'
import { CozeAPI } from '@coze/api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('=== analyze-resume 收到请求 ===', body)
    const { resume_data: resumeText, jd_text: jobDescription } = body
    
    if (!resumeText) {
      console.log('=== analyze-resume resumeText 为空 ===')
      return NextResponse.json({ error: '请提供简历文本' }, { status: 400 })
    }

    if (!jobDescription) {
      return NextResponse.json({ error: '请提供岗位描述' }, { status: 400 })
    }

    console.log('收到简历文本，长度:', resumeText.length, '岗位描述长度:', jobDescription.length)

    console.log('开始调用 Coze resume_analyzer 工作流...')
    const coze = new CozeAPI({
      token: process.env.COZE_API_KEY || '',
      baseURL: 'https://api.coze.cn'
    })

    const stream = await coze.workflows.runs.stream({
      workflow_id: '7642568363239571466',
      parameters: { resume_data: resumeText, jd_text: jobDescription }
    })

    let finalResult = ''
    console.log('开始收集流式响应...')
    for await (const chunk of stream) {
      console.log('=== analyze-resume chunk ===', JSON.stringify(chunk, null, 2));
      const data = chunk.data as any
      if (data?.content) {
        finalResult += data.content
      }
    }

    console.log('最终收集的结果:', finalResult)

    let parsedData
    try {
      parsedData = JSON.parse(finalResult)
      parsedData = parsedData.output
    } catch (e) {
      parsedData = { raw_result: finalResult }
    }

    return NextResponse.json({
      success: true,
      data: parsedData
    })

  } catch (error) {
    console.error('深度解析失败:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : '解析失败'
    }, { status: 500 })
  }
}
