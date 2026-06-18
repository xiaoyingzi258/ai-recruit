import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 })
  }

  const userId = session.user.id

  try {
    // 1. 查询用户的所有角色
    const userRoles = await query<any>(
      `SELECT r.id, r.name, r.description, r.is_system, r.data_scope
       FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [userId]
    )

    console.log('[user-permissions] 用户角色:', userRoles.map((r: any) => r.name))

    // 2. 如果用户没有任何角色，返回空权限
    if (userRoles.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          roles: [],
          permissions: [],
          data_scopes: [],
          is_admin: false,
        },
      })
    }

    // 3. 查询角色关联的所有权限
    const roleIds = userRoles.map((r: any) => r.id)
    const placeholders = roleIds.map((_, i) => `$${i + 1}`).join(', ')

    const permissionResults = await query<any>(
      `SELECT DISTINCT rp.permission_key
       FROM role_permissions rp
       WHERE rp.role_id IN (${placeholders})`,
      roleIds
    )

    const permissions = permissionResults.map((p: any) => p.permission_key)

    // 4. 收集数据可视范围
    const dataScopes = userRoles
      .map((r: any) => r.data_scope)
      .filter((s: any) => s && s !== null)

    // 5. 判断是否是系统管理员角色（通常包含 system:manage 权限或角色名为"管理员/系统管理员"）
    const isAdmin =
      permissions.includes('system:manage') ||
      userRoles.some((r: any) => r.is_system === true)

    console.log('[user-permissions] 权限列表:', permissions, 'isAdmin:', isAdmin)

    return NextResponse.json({
      success: true,
      data: {
        roles: userRoles,
        permissions,
        data_scopes: dataScopes,
        is_admin: isAdmin,
      },
    })
  } catch (error) {
    console.error('[user-permissions] 接口异常:', error)
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 })
  }
}
