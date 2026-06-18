import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.company_id) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  const companyId = session.user.company_id

  try {
    await ensureTables()

    const rows = await query<any>(
      `SELECT r.*, COALESCE(ur.user_count, 0) as user_count
       FROM roles r
       LEFT JOIN (
         SELECT role_id, COUNT(*) as user_count
         FROM user_roles
         GROUP BY role_id
       ) ur ON ur.role_id = r.id
       ORDER BY r.created_at DESC`
    )

    const rolesWithPermissions = []
    for (const role of rows) {
      const perms = await query<any>(
        `SELECT permission_key FROM role_permissions WHERE role_id = $1`,
        [role.id]
      )
      rolesWithPermissions.push({
        ...role,
        permissions: perms.map((p: any) => p.permission_key),
        data_scope: role.data_scope,
      })
    }

    console.log('[roles-list] 返回角色数:', rolesWithPermissions.length)
    return NextResponse.json({ success: true, data: rolesWithPermissions })
  } catch (error) {
    console.error('[roles-list] 接口异常:', error)
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
    await ensureTables()

    const body = await request.json()
    const { name, description } = body

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: '请输入角色名称' }, { status: 400 })
    }

    const role = await queryOne<any>(
      `INSERT INTO roles (company_id, name, description, is_system, data_scope, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [companyId, name.trim(), description?.trim() || '', false, 'company']
    )

    console.log('[create-role] 新角色创建:', role?.name, 'id:', role?.id)
    return NextResponse.json({ success: true, data: role })
  } catch (error) {
    console.error('[create-role] 接口异常:', error)
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params?: { id?: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.company_id) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  const url = new URL(request.url)
  const idFromQuery = url.searchParams.get('id')
  const roleId = params?.id || idFromQuery

  if (!roleId) {
    return NextResponse.json({ success: false, error: '缺少角色 ID' }, { status: 400 })
  }

  try {
    const existing = await queryOne<any>(
      `SELECT * FROM roles WHERE id = $1`,
      [roleId]
    )
    if (!existing) {
      return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 })
    }

    if (existing.is_system) {
      return NextResponse.json({ success: false, error: '系统角色不可删除' }, { status: 400 })
    }

    await query(
      `DELETE FROM roles WHERE id = $1`,
      [roleId]
    )

    console.log('[delete-role] 角色已删除:', existing.name)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[delete-role] 接口异常:', error)
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 })
  }
}

async function ensureTables() {
  try {
    const exists = await queryOne<any>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'roles'
      )`
    )

    if (!exists?.exists) {
      await query(`
        CREATE TABLE IF NOT EXISTS roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id VARCHAR NOT NULL,
          name VARCHAR NOT NULL,
          description TEXT DEFAULT '',
          is_system BOOLEAN DEFAULT FALSE,
          data_scope VARCHAR DEFAULT 'company',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `)
    } else {
      const requiredColumns = [
        { name: 'company_id', def: 'VARCHAR NOT NULL DEFAULT \'\'' },
        { name: 'description', def: 'TEXT DEFAULT \'\'' },
        { name: 'is_system', def: 'BOOLEAN DEFAULT FALSE' },
        { name: 'data_scope', def: 'VARCHAR DEFAULT \'company\'' },
        { name: 'created_at', def: 'TIMESTAMP DEFAULT NOW()' },
      ]

      for (const col of requiredColumns) {
        const colExists = await queryOne<any>(
          `SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'roles' AND column_name = $1
          )`,
          [col.name]
        )
        if (!colExists?.exists) {
          try {
            await query(`ALTER TABLE roles ADD COLUMN ${col.name} ${col.def}`)
            console.log(`[ensure-roles-table] 添加列: ${col.name}`)
          } catch (e) {
            console.log(`[ensure-roles-table] 添加列 ${col.name} 跳过:`, (e as Error).message)
          }
        }
      }
    }

    const rpExists = await queryOne<any>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'role_permissions'
      )`
    )

    if (!rpExists?.exists) {
      await query(`
        CREATE TABLE IF NOT EXISTS role_permissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
          permission_key VARCHAR NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          UNIQUE(role_id, permission_key)
        )
      `)
      console.log('[ensure-tables] 创建 role_permissions 表')
    }

    const urExists = await queryOne<any>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_roles'
      )`
    )

    if (!urExists?.exists) {
      await query(`
        CREATE TABLE IF NOT EXISTS user_roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          UNIQUE(user_id, role_id)
        )
      `)
      console.log('[ensure-tables] 创建 user_roles 表')
    }

    const userDeptCol = await queryOne<any>(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'department'
      )`
    )

    if (!userDeptCol?.exists) {
      try {
        await query(`ALTER TABLE users ADD COLUMN department VARCHAR(50)`)
        console.log('[ensure-tables] 添加 users.department 列')
      } catch (e) {
        console.log('[ensure-tables] 添加 users.department 跳过:', (e as Error).message)
      }
    }

    const userPosCol = await queryOne<any>(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'position'
      )`
    )

    if (!userPosCol?.exists) {
      try {
        await query(`ALTER TABLE users ADD COLUMN position VARCHAR(50)`)
        console.log('[ensure-tables] 添加 users.position 列')
      } catch (e) {
        console.log('[ensure-tables] 添加 users.position 跳过:', (e as Error).message)
      }
    }
  } catch (error) {
    console.error('[ensure-tables] 异常:', error)
  }
}
