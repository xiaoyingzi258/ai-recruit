import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { query, getClient } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, companyName } = await request.json()

    if (!email || !password || !name || !companyName) {
      return NextResponse.json({ error: '请填写所有必填字段' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: '密码至少6位' }, { status: 400 })
    }

    const client = await getClient()

    try {
      await client.query('BEGIN')

      // 检查 email 是否已存在
      const existingUsers = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      )

      if (existingUsers.rows.length > 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: '该邮箱已被注册' }, { status: 409 })
      }

      // 查询或创建公司
      let companyRows = await client.query(
        "SELECT id FROM companies WHERE name = $1",
        [companyName]
      )

      let companyId: string

      if (companyRows.rows.length > 0) {
        companyId = companyRows.rows[0].id
      } else {
        companyId = uuidv4()
        await client.query(
          'INSERT INTO companies (id, name) VALUES ($1, $2)',
          [companyId, companyName]
        )
      }

      // 创建用户
      const userId = uuidv4()
      const passwordHash = await bcrypt.hash(password, 10)

      await client.query(
        `INSERT INTO users (id, company_id, name, role, email, password_hash)
         VALUES ($1, $2, $3, 'hr', $4, $5)`,
        [userId, companyId, name, email, passwordHash]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        data: { id: userId, email, name, company_id: companyId }
      })

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('[register] 错误:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '注册失败' },
      { status: 500 }
    )
  }
}
