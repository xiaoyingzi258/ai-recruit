import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.company_id) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  const companyId = session.user.company_id

  try {
    const body = await request.json()
    const { role_id, permission_keys, data_scope } = body

    if (!role_id) {
      return NextResponse.json({ success: false, error: '缺少角色 ID' }, { status: 400 })
    }

    const existing = await queryOne<any>(
      `SELECT * FROM roles WHERE id = $1`,
      [role_id]
    )
    if (!existing) {
      return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 })
    }

    if (existing.is_system) {
      return NextResponse.json({ success: false, error: '系统角色不可修改' }, { status: 400 })
    }

    if (data_scope) {
      await query(`UPDATE roles SET data_scope = $1 WHERE id = $2`, [data_scope, role_id])
    }

    await query(`DELETE FROM role_permissions WHERE role_id = $1`, [role_id])

    if (permission_keys && permission_keys.length > 0) {
      const values = permission_keys
        .map((_: string, i: number) => `($1, $${i + 2}, NOW())`)
        .join(', ')
      await query(
        `INSERT INTO role_permissions (role_id, permission_key, created_at) VALUES ${values}
         ON CONFLICT (role_id, permission_key) DO NOTHING`,
        [role_id, ...permission_keys]
      )
    }

    console.log('[save-permissions] 角色:', existing.name, '权限:', permission_keys, '数据范围:', data_scope)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[save-permissions] 接口异常:', error)
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.company_id) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  const companyId = session.user.company_id
  const url = new URL(request.url)
  const roleId = url.searchParams.get('role_id')

  if (!roleId) {
    return NextResponse.json({ success: false, error: '缺少角色 ID' }, { status: 400 })
  }

  try {
    const role = await queryOne<any>(
      `SELECT * FROM roles WHERE id = $1`,
      [roleId]
    )
    if (!role) {
      return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 })
    }

    const perms = await query<any>(
      `SELECT permission_key FROM role_permissions WHERE role_id = $1`,
      [roleId]
    )

    return NextResponse.json({
      success: true,
      data: {
        role,
        permission_keys: perms.map((p: any) => p.permission_key),
        data_scope: role.data_scope,
      },
    })
  } catch (error) {
    console.error('[get-permissions] 接口异常:', error)
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 })
  }
}
