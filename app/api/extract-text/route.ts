import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '未上传文件' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    let text = ''

    if (fileName.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else if (fileName.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      text = await new Promise<string>((resolve, reject) => {
        const PDFParser = require('pdf2json')
        const pdfParser = new PDFParser()

        pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
          const pages = pdfData.Pages || []
          const pageTexts = pages.map((page: any) => {
            const texts = page.Texts || []
            return texts
              .map((t: any) => decodeURIComponent(t.R?.[0]?.T || ''))
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
      return NextResponse.json(
        { error: '仅支持 .docx 和 .pdf 格式' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, text })
  } catch (error) {
    console.error('文件解析失败:', error)
    return NextResponse.json(
      { error: '文件解析失败' },
      { status: 500 }
    )
  }
}
