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
  const url = new URL(request.url)
  const roleId = url.searchParams.get('role_id')

  try {
    console.log('[get-members] 查询条件 company_id:', companyId)

    const allUsers = await query<any>(
      `SELECT u.id, u.name, u.email, u.department, u.position
       FROM users u
       ORDER BY u.created_at DESC`
    )

    console.log('[get-members] 用户总数:', allUsers?.length, '前3条:', JSON.stringify(allUsers?.slice(0, 3) || []))

    const allUserIds = allUsers.map((u: any) => u.id)

    const userRolesMap: { [key: string]: string[] } = {}
    if (allUserIds.length > 0) {
      const placeholders = allUserIds.map((_, i) => `$${i + 1}`).join(', ')
      const userRoles = await query<any>(
        `SELECT ur.user_id, r.name as role_name
         FROM user_roles ur
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id IN (${placeholders})`,
        allUserIds
      )
      userRoles.forEach((ur: any) => {
        if (!userRolesMap[ur.user_id]) userRolesMap[ur.user_id] = []
        userRolesMap[ur.user_id].push(ur.role_name)
      })
    }

    let assignedUserIds: string[] = []
    if (roleId) {
      const assignedResults = await query<any>(
        `SELECT user_id FROM user_roles WHERE role_id = $1`,
        [roleId]
      )
      assignedUserIds = assignedResults.map((r: any) => r.user_id)
    }

    const usersWithRoles = allUsers.map((u: any) => ({
      ...u,
      roles: userRolesMap[u.id] || [],
    }))

    const result = {
      assigned: usersWithRoles.filter((u: any) => assignedUserIds.includes(u.id)),
      available: usersWithRoles.filter((u: any) => !assignedUserIds.includes(u.id)),
      all: usersWithRoles,
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[get-members] 接口异常:', error)
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
    const body = await request.json()
    const { role_id, user_ids } = body

    if (!role_id) {
      return NextResponse.json({ success: false, error: '缺少角色 ID' }, { status: 400 })
    }

    const existing = await queryOne<any>(
      `SELECT * FROM roles WHERE id = $1 AND company_id = $2`,
      [role_id, companyId]
    )
    if (!existing) {
      return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 })
    }

    if (existing.is_system) {
      return NextResponse.json({ success: false, error: '系统角色不可修改' }, { status: 400 })
    }

    await query(`DELETE FROM user_roles WHERE role_id = $1`, [role_id])

    if (user_ids && user_ids.length > 0) {
      const validUserIds: string[] = []
      for (const uid of user_ids) {
        const userCheck = await queryOne<any>(
          `SELECT id FROM users WHERE id = $1`,
          [uid]
        )
        if (userCheck) validUserIds.push(uid)
      }
      console.log('[assign-members] 验证通过的用户数:', validUserIds.length, '请求的用户数:', user_ids.length)
      console.log('[assign-members] validUserIds:', validUserIds)
      console.log('[assign-members] role_id:', role_id)

      const values = validUserIds
        .map((_, i) => `($${i + 2}, $1, NOW())`)
        .join(', ')
      if (validUserIds.length > 0) {
        await query(
          `INSERT INTO user_roles (user_id, role_id, created_at) VALUES ${values}
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          [role_id, ...validUserIds]
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[assign-members] 接口异常:', error)
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 })
  }
}
