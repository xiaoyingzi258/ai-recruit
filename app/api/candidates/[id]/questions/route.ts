import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { queryOne } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.company_id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const candidateId = params.id

  console.log('[interview-questions] 查询 candidate_id:', candidateId)

  const row = await queryOne(
    `SELECT * FROM interview_questions WHERE candidate_id = $1 LIMIT 1`,
    [candidateId]
  )

  console.log('[interview-questions] 原始查询结果:', row ? '有记录' : '无记录')

  let result = row
  if (row) {
    // 确保 JSON 字段被正确解析成数组
    result = { ...row }
    for (const key of ['fraud_questions', 'tech_questions', 'soft_questions']) {
      const val = (result as any)[key]
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val)
          ;(result as any)[key] = parsed
          console.log(`  ✅ ${key}: 字符串解析成功, 数量=${Array.isArray(parsed) ? parsed.length : '非数组'}`)
        } catch (e) {
          console.log(`  ⚠️  ${key}: 字符串解析失败, 内容=`, val.slice(0, 100))
          ;(result as any)[key] = []
        }
      } else if (Array.isArray(val)) {
        console.log(`  ✅ ${key}: 已为数组, 数量=${val.length}`)
      } else if (val === null || val === undefined) {
        console.log(`  ⚠️  ${key}: 为空, 设置为 []`)
        ;(result as any)[key] = []
      } else {
        console.log(`  ⚠️  ${key}: 类型=${typeof val}, 转换为 []`)
        ;(result as any)[key] = []
      }
    }
  }

  return NextResponse.json({ success: true, data: result || null })
}
