import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

async function ensureCompanyColumns() {
  try {
    const existingCols = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'companies'`
    )
    const existingNames = new Set(existingCols.map((c: any) => c.column_name))

    const needed = [
      { name: 'logo', type: 'TEXT' },
      { name: 'industry', type: 'VARCHAR(100)' },
      { name: 'scale', type: 'VARCHAR(50)' },
      { name: 'description', type: 'TEXT' },
      { name: 'social_credit_code', type: 'VARCHAR(50)' },
      { name: 'legal_representative', type: 'VARCHAR(100)' },
      { name: 'is_verified', type: 'BOOLEAN DEFAULT true' },
      { name: 'created_at', type: 'TIMESTAMPTZ DEFAULT NOW()' },
      { name: 'updated_at', type: 'TIMESTAMPTZ DEFAULT NOW()' },
    ]

    for (const col of needed) {
      if (!existingNames.has(col.name)) {
        await query(`ALTER TABLE companies ADD COLUMN ${col.name} ${col.type}`)
        console.log(`[company] 新增字段: ${col.name}`)
      }
    }
  } catch (error) {
    console.error('[company] 确保字段失败:', error)
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.company_id) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  const companyId = session.user.company_id

  try {
    await ensureCompanyColumns()

    const company = await queryOne<any>(
      `SELECT c.*,
        COALESCE(
          (SELECT COUNT(*) FROM candidates c2 WHERE c2.company_id = c.id),
          0
        ) as candidate_count,
        COALESCE(
          (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id),
          0
        ) as user_count
       FROM companies c
       WHERE c.id = $1`,
      [companyId]
    )

    if (!company) {
      return NextResponse.json({ success: false, error: '企业不存在' }, { status: 404 })
    }

    const totalUsers = await queryOne<any>(
      `SELECT COUNT(*) as count FROM users WHERE company_id = $1`,
      [companyId]
    )

    const totalCandidates = await queryOne<any>(
      `SELECT COUNT(*) as count FROM candidates WHERE company_id = $1`,
      [companyId]
    )

    return NextResponse.json({
      success: true,
      data: {
        ...company,
        user_count: totalUsers?.count || 0,
        candidate_count: totalCandidates?.count || 0,
      },
    })
  } catch (error) {
    console.error('[company] 接口异常:', error)
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.company_id) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  const companyId = session.user.company_id

  try {
    await ensureCompanyColumns()

    const body = await request.json()
    const {
      company_name,
      logo,
      industry,
      scale,
      description,
      social_credit_code,
      legal_representative,
    } = body

    const existing = await queryOne<any>(
      `SELECT id FROM companies WHERE id = $1`,
      [companyId]
    )

    if (!existing) {
      return NextResponse.json({ success: false, error: '企业不存在' }, { status: 404 })
    }

    await query(
      `UPDATE companies
       SET logo = $1, industry = $2, scale = $3, description = $4,
           social_credit_code = $5, legal_representative = $6, updated_at = NOW()
       WHERE id = $7`,
      [
        logo || null,
        industry || null,
        scale || null,
        description || null,
        social_credit_code || null,
        legal_representative || null,
        companyId,
      ]
    )

    console.log('[company] 企业信息已更新:', company_name)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[company] 保存接口异常:', error)
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 })
  }
}
