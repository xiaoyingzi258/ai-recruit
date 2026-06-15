import { NextRequest, NextResponse } from 'next/server'
import { CozeAPI } from '@coze/api'

export async function POST(request: NextRequest) {
  try {
    const { resume_text: resumeText } = await request.json()
    
    if (!resumeText) {
      return NextResponse.json({ error: '请提供简历文本' }, { status: 400 })
    }

    console.log('收到简历文本，长度:', resumeText.length)

    console.log('开始调用 Coze 工作流...')
    const coze = new CozeAPI({
      token: process.env.COZE_API_KEY || '',
      baseURL: 'https://api.coze.cn'
    })

    const stream = await coze.workflows.runs.stream({
      workflow_id: '7641517139460079657',
      parameters: { resume_text: resumeText }
    })

    // 3. 收集流式响应结果
    let finalResult = ''
    console.log('开始收集流式响应...')
    for await (const chunk of stream) {
      console.log('=== 完整 chunk ===', JSON.stringify(chunk, null, 2));
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
    console.error('解析失败:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : '解析失败'
    }, { status: 500 })
  }
}
