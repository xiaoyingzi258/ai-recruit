"use client"

import { useRouter } from "next/navigation"
import { Plus, X, FileText, Users, Target, BarChart2, FolderKanban, Settings, CircleDot, Search } from "lucide-react"
import { useState, useEffect } from "react"

const tabs = [
  { key: "jobs", label: "岗位管理", disabled: false },
  { key: "roles", label: "角色权限", disabled: false },
  { key: "company", label: "企业信息", disabled: false },
]


const defaultPermissions = {
  jobs: {
    enabled: false,
    sub: {
      view: false,
      edit: false,
      toggle: false,
      delete: false,
    },
  },
  candidates: {
    enabled: false,
    sub: {
      view: false,
      action: false,
      batchImport: false,
      changeStatus: false,
    },
    dataScope: 'all',
  },
  aiAnalysis: {
    enabled: false,
  },
  dashboard: {
    enabled: false,
  },
  interviewQuestions: {
    enabled: false,
  },
  systemManagement: {
    enabled: false,
  },
}

const PERMISSION_KEY_MAP: { [key: string]: { module: string; sub?: string } } = {
  'job:view': { module: 'jobs', sub: 'view' },
  'job:create': { module: 'jobs', sub: 'edit' },
  'job:status': { module: 'jobs', sub: 'toggle' },
  'job:delete': { module: 'jobs', sub: 'delete' },
  'candidate:view': { module: 'candidates', sub: 'view' },
  'candidate:import': { module: 'candidates', sub: 'batchImport' },
  'candidate:remove': { module: 'candidates', sub: 'action' },
  'candidate:status': { module: 'candidates', sub: 'changeStatus' },
  'analysis:access': { module: 'aiAnalysis' },
  'interview:access': { module: 'interviewQuestions' },
  'dashboard:access': { module: 'dashboard' },
  'system:manage': { module: 'systemManagement' },
}

// UI 值 → 数据库值
const DATA_SCOPE_MAP: { [key: string]: string } = {
  all: 'company',
  dept: 'department',
  mine: 'assigned',
  company: 'company',
  department: 'department',
  assigned: 'assigned',
}

// 数据库值 → UI 值
const DATA_SCOPE_REVERSE: { [key: string]: string } = {
  company: 'all',
  department: 'dept',
  assigned: 'mine',
}

type PermissionState = typeof defaultPermissions

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-orange-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-red-500',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? "bg-[#4AB5A9]" : "bg-gray-300"
      } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  )
}

function Checkbox({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onChange}
      className={`flex items-center justify-center w-4 h-4 rounded border transition-colors ${
        checked
          ? "bg-[#4AB5A9] border-[#4AB5A9]"
          : "bg-white border-gray-300"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {checked && (
        <svg
          className="w-3 h-3 text-white"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  )
}

function Radio({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onChange}
      className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
        checked
          ? "border-[#4AB5A9]"
          : "border-gray-300"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {checked && <span className="w-2 h-2 rounded-full bg-[#4AB5A9]" />}
    </button>
  )
}

export default function RolesPage() {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [roleName, setRoleName] = useState("")
  const [roleDesc, setRoleDesc] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [roles, setRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [nameError, setNameError] = useState("")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingRole, setDeletingRole] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [permissionRole, setPermissionRole] = useState<any>(null)
  const [permissions, setPermissions] = useState<PermissionState>(defaultPermissions)
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [memberRole, setMemberRole] = useState<any>(null)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [savingMembers, setSavingMembers] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')

  useEffect(() => {
    fetchRoles()
  }, [])

  async function fetchRoles() {
    try {
      setLoading(true)
      const res = await fetch("/api/roles")
      const data = await res.json()
      if (data.success) {
        setRoles(data.data)
      }
    } catch (error) {
      console.error("加载角色列表失败:", error)
    } finally {
      setLoading(false)
    }
  }

  function openModal() {
    setRoleName("")
    setRoleDesc("")
    setNameError("")
    setShowModal(true)
  }

  function closeModal() {
    if (submitting) return
    setShowModal(false)
  }

  async function handleSubmit() {
    if (!roleName.trim()) {
      setNameError("请输入角色名称")
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roleName.trim(),
          description: roleDesc.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowModal(false)
        fetchRoles()
      } else {
        setNameError(data.error || "创建失败")
      }
    } catch (error) {
      console.error("创建角色失败:", error)
    } finally {
      setSubmitting(false)
    }
  }

  function handleDeleteRole(role: any) {
    if (role.is_system) return
    setDeletingRole(role)
    setShowDeleteModal(true)
  }

  async function confirmDeleteRole() {
    if (!deletingRole) return

    try {
      setDeleting(true)
      const res = await fetch(`/api/roles?id=${deletingRole.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (data.success) {
        setShowDeleteModal(false)
        setDeletingRole(null)
        fetchRoles()
      } else {
        console.error("删除角色失败:", data.error)
      }
    } catch (error) {
      console.error("删除角色失败:", error)
    } finally {
      setDeleting(false)
    }
  }

  function cancelDeleteRole() {
    if (deleting) return
    setShowDeleteModal(false)
    setDeletingRole(null)
  }

  function openPermissionModal(role: any) {
    if (role.is_system) return
    setPermissionRole(role)

    const newPermissions: PermissionState = JSON.parse(JSON.stringify(defaultPermissions))

    if (role.permissions && Array.isArray(role.permissions) && role.permissions.length > 0) {
      role.permissions.forEach((permKey: string) => {
        const mapping = PERMISSION_KEY_MAP[permKey]
        if (!mapping) return

        const moduleData = (newPermissions as any)[mapping.module]
        if (!moduleData) return

        moduleData.enabled = true
        if (mapping.sub && moduleData.sub) {
          moduleData.sub[mapping.sub] = true
        }
      })
    }

    if (role.data_scope) {
      const mappedScope = DATA_SCOPE_REVERSE[role.data_scope] || role.data_scope
      ;(newPermissions as any).candidates.dataScope = mappedScope
      // 如果有 candidate 相关权限，则启用该模块
      if (
        role.permissions &&
        role.permissions.some((p: string) => p.startsWith('candidate:'))
      ) {
        ;(newPermissions as any).candidates.enabled = true
      }
    }

    console.log('[权限回显] 角色:', role.name, '权限状态:', newPermissions)
    setPermissions(newPermissions)
    setShowPermissionModal(true)
  }

  function closePermissionModal() {
    if (savingPermissions) return
    setShowPermissionModal(false)
    setPermissionRole(null)
  }

  async function savePermissions() {
    if (!permissionRole) return
    try {
      setSavingPermissions(true)

      const permissionKeys: string[] = []

      if ((permissions.jobs as any).enabled) {
        if ((permissions.jobs as any).sub.view) permissionKeys.push('job:view')
        if ((permissions.jobs as any).sub.edit) permissionKeys.push('job:create')
        if ((permissions.jobs as any).sub.toggle) permissionKeys.push('job:status')
        if ((permissions.jobs as any).sub.delete) permissionKeys.push('job:delete')
      }

      if ((permissions.candidates as any).enabled) {
        if ((permissions.candidates as any).sub.view) permissionKeys.push('candidate:view')
        if ((permissions.candidates as any).sub.batchImport) permissionKeys.push('candidate:import')
        if ((permissions.candidates as any).sub.action) permissionKeys.push('candidate:remove')
        if ((permissions.candidates as any).sub.changeStatus) permissionKeys.push('candidate:status')
      }

      if ((permissions.aiAnalysis as any).enabled) permissionKeys.push('analysis:access')
      if ((permissions.interviewQuestions as any).enabled) permissionKeys.push('interview:access')
      if ((permissions.dashboard as any).enabled) permissionKeys.push('dashboard:access')
      if ((permissions.systemManagement as any).enabled) permissionKeys.push('system:manage')

      const dataScope = DATA_SCOPE_MAP[(permissions.candidates as any).dataScope] || 'company'

      const res = await fetch('/api/roles/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_id: permissionRole.id,
          permission_keys: permissionKeys,
          data_scope: dataScope,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setShowPermissionModal(false)
        setPermissionRole(null)
        fetchRoles()
      } else {
        console.error('保存权限失败:', data.error)
      }
    } catch (error) {
      console.error('保存权限失败:', error)
    } finally {
      setSavingPermissions(false)
    }
  }

  async function openMemberModal(role: any) {
    if (role.is_system) return
    setMemberRole(role)
    setLoadingMembers(true)
    setMemberSearch('')
    try {
      const res = await fetch(`/api/roles/members?role_id=${role.id}`)
      const data = await res.json()
      if (data.success) {
        setAllUsers(data.data.all || [])
        setSelectedUserIds(data.data.assigned ? data.data.assigned.map((u: any) => u.id) : [])
      }
    } catch (error) {
      console.error('加载成员列表失败:', error)
    } finally {
      setLoadingMembers(false)
      setShowMemberModal(true)
    }
  }

  function closeMemberModal() {
    if (savingMembers) return
    setShowMemberModal(false)
    setMemberRole(null)
    setAllUsers([])
    setSelectedUserIds([])
  }

  async function saveMembers() {
    if (!memberRole) return
    try {
      setSavingMembers(true)
      const res = await fetch('/api/roles/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_id: memberRole.id,
          user_ids: selectedUserIds,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowMemberModal(false)
        setMemberRole(null)
        fetchRoles()
      } else {
        console.error('保存成员失败:', data.error)
      }
    } catch (error) {
      console.error('保存成员失败:', error)
    } finally {
      setSavingMembers(false)
    }
  }

  function toggleMember(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  function removeMember(userId: string) {
    setSelectedUserIds((prev) => prev.filter((id) => id !== userId))
  }

  function addMember(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev : [...prev, userId]
    )
  }

  function toggleAllMembers(users: any[]) {
    const visibleIds = users.map((u) => u.id)
    const allSelected = visibleIds.every((id) => selectedUserIds.includes(id))
    if (allSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      const newSelected = new Set(prev)
      visibleIds.forEach((id) => newSelected.add(id))
      setSelectedUserIds(Array.from(newSelected))
    }
  }

  function toggleModule(moduleKey: keyof PermissionState) {
    if (moduleKey === "dashboard" || moduleKey === "systemManagement") return
    setPermissions((prev) => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        enabled: !(prev[moduleKey] as any).enabled,
      } as any,
    }))
  }

  function toggleSubPermission(moduleKey: keyof PermissionState, subKey: string) {
    setPermissions((prev) => {
      const module = prev[moduleKey] as any
      if (!module.sub) return prev
      if (!module.enabled) return prev
      return {
        ...prev,
        [moduleKey]: {
          ...module,
          sub: {
            ...module.sub,
            [subKey]: !module.sub[subKey],
          },
        },
      } as any
    })
  }

  function setDataScope(scope: string) {
    setPermissions((prev) => {
      if (!(prev.candidates as any).enabled) return prev
      return {
        ...prev,
        candidates: {
          ...prev.candidates,
          dataScope: scope,
        },
      }
    })
  }

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center gap-1 border-b-0">
            {tabs.map((tab) => (
              <div
                key={tab.key}
                onClick={() => {
                  if (!tab.disabled) {
                    if (tab.key === "roles") router.push("/settings/roles")
                    if (tab.key === "jobs") router.push("/settings/jobs")
                    if (tab.key === "company") router.push("/settings/company")
                  }
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  tab.disabled
                    ? "text-gray-400 cursor-not-allowed"
                    : tab.key === "roles"
                    ? "bg-[#E8F5F3] text-[#4AB5A9] cursor-pointer"
                    : "text-gray-500 hover:text-gray-700 cursor-pointer"
                }`}
              >
                {tab.label}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="text-base font-semibold text-[#1C1E3A]">角色列表</h2>
          <button
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2 bg-[#4AB5A9] text-white rounded-lg hover:bg-[#3d9a8e] transition-colors text-sm font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新建角色
          </button>
        </div>

        <div className="px-6 pb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 rounded-lg overflow-hidden">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色名称</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色描述</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">关联账号</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                      加载中...
                    </td>
                  </tr>
                ) : roles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                      暂无角色
                    </td>
                  </tr>
                ) : (
                  roles.map((role: any) => (
                    <tr key={role.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-4">
                        <span className="font-medium text-[#1C1E3A]">{role.name}</span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {role.description || "-"}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {role.user_count || role.userCount || 0} 人
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-6 text-sm">
                          {role.is_system ? (
                            <span className="text-sm text-gray-400">系统预置，不可修改</span>
                          ) : (
                            <>
                              <button
                                onClick={() => openPermissionModal(role)}
                                className="font-medium text-[#4AB5A9] hover:text-[#3a9d90] transition-colors">
                                权限配置
                              </button>
                              <button
                                onClick={() => openMemberModal(role)}
                                className="font-medium text-[#4AB5A9] hover:text-[#3a9d90] transition-colors">
                                成员管理
                              </button>
                              <button
                                onClick={() => handleDeleteRole(role)}
                                className="font-medium text-red-500 hover:text-red-600 transition-colors">
                                删除
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeModal}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-[500px] mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-[#1C1E3A]">新建自定义角色</h3>
              <button
                onClick={closeModal}
                disabled={submitting}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1C1E3A] mb-2">
                  <span className="text-red-500 mr-0.5">*</span>角色名称
                </label>
                <input
                  type="text"
                  value={roleName}
                  onChange={(e) => {
                    setRoleName(e.target.value)
                    if (nameError) setNameError("")
                  }}
                  placeholder="例如：前端负责人、招聘BP"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4AB5A9]/20 focus:border-[#4AB5A9] transition-colors"
                />
                {nameError && (
                  <p className="mt-1.5 text-xs text-red-500">{nameError}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1C1E3A] mb-2">
                  角色职责描述
                </label>
                <textarea
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  placeholder="简要描述该角色的数据范围与功能权限..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4AB5A9]/20 focus:border-[#4AB5A9] transition-colors resize-y"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-[#4AB5A9] rounded-lg hover:bg-[#3d9a8e] transition-colors shadow-sm disabled:opacity-50">
                {submitting ? "创建中..." : "确认创建"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && deletingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={cancelDeleteRole}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-[420px] mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-5">
              <h3 className="text-lg font-semibold text-[#1C1E3A] mb-3">确认删除</h3>
              <p className="text-sm text-gray-500">
                确定要删除角色「{deletingRole.name}」吗？此操作不可恢复。
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50">
              <button
                onClick={cancelDeleteRole}
                disabled={deleting}
                className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                取消
              </button>
              <button
                onClick={confirmDeleteRole}
                disabled={deleting}
                className="px-6 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors shadow-sm disabled:opacity-50">
                {deleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPermissionModal && permissionRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closePermissionModal}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-[900px] mx-4 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-7 py-5">
              <h3 className="text-base">
                <span className="font-semibold text-[#1C1E3A]">权限配置</span>
                <span className="ml-1 text-sm text-gray-500">正在为「{permissionRole.name}」分配系统权限</span>
              </h3>
              <button
                onClick={closePermissionModal}
                disabled={savingPermissions}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="px-7 py-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-5">
                <div className="bg-[#F7F8FA] rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className={`w-4 h-4 ${(permissions.jobs as any).enabled ? "text-[#4AB5A9]" : "text-gray-400"}`} />
                      <span className={`text-sm font-medium ${(permissions.jobs as any).enabled ? "text-[#1C1E3A]" : "text-gray-400"}`}>岗位管理</span>
                    </div>
                    <Switch
                      checked={(permissions.jobs as any).enabled}
                      onChange={() => toggleModule("jobs")}
                    />
                  </div>
                  <div className="mt-6 pt-5 border-t border-gray-200 space-y-3.5">
                    <label className={`flex items-center gap-3 text-sm transition-colors ${(permissions.jobs as any).enabled ? "text-gray-600 cursor-pointer" : "text-gray-400 cursor-not-allowed"}`}>
                      <Checkbox
                        checked={(permissions.jobs as any).sub.view}
                        onChange={() => toggleSubPermission("jobs", "view")}
                        disabled={!(permissions.jobs as any).enabled}
                      />
                      <span>查看岗位列表</span>
                    </label>
                    <label className={`flex items-center gap-3 text-sm transition-colors ${(permissions.jobs as any).enabled ? "text-gray-600 cursor-pointer" : "text-gray-400 cursor-not-allowed"}`}>
                      <Checkbox
                        checked={(permissions.jobs as any).sub.edit}
                        onChange={() => toggleSubPermission("jobs", "edit")}
                        disabled={!(permissions.jobs as any).enabled}
                      />
                      <span>创建/编辑岗位</span>
                    </label>
                    <label className={`flex items-center gap-3 text-sm transition-colors ${(permissions.jobs as any).enabled ? "text-gray-600 cursor-pointer" : "text-gray-400 cursor-not-allowed"}`}>
                      <Checkbox
                        checked={(permissions.jobs as any).sub.toggle}
                        onChange={() => toggleSubPermission("jobs", "toggle")}
                        disabled={!(permissions.jobs as any).enabled}
                      />
                      <span>关闭/开启岗位状态</span>
                    </label>
                    <label className={`flex items-center gap-3 text-sm transition-colors ${(permissions.jobs as any).enabled ? "text-gray-600 cursor-pointer" : "text-gray-400 cursor-not-allowed"}`}>
                      <Checkbox
                        checked={(permissions.jobs as any).sub.delete}
                        onChange={() => toggleSubPermission("jobs", "delete")}
                        disabled={!(permissions.jobs as any).enabled}
                      />
                      <span>删除岗位</span>
                    </label>
                  </div>
                </div>

                <div className="bg-[#F7F8FA] rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className={`w-4 h-4 ${(permissions.candidates as any).enabled ? "text-[#4AB5A9]" : "text-gray-400"}`} />
                      <span className={`text-sm font-medium ${(permissions.candidates as any).enabled ? "text-[#1C1E3A]" : "text-gray-400"}`}>候选人管理库</span>
                    </div>
                    <Switch
                      checked={(permissions.candidates as any).enabled}
                      onChange={() => toggleModule("candidates")}
                    />
                  </div>
                  <div className="mt-6 pt-5 border-t border-gray-200 space-y-3.5">
                      <div className="grid grid-cols-2 gap-y-3.5">
                        <div>
                          <label className={`flex items-center gap-3 text-sm transition-colors ${(permissions.candidates as any).enabled ? "text-gray-600 cursor-pointer" : "text-gray-400 cursor-not-allowed"}`}>
                            <Checkbox
                              checked={(permissions.candidates as any).sub.view}
                              onChange={() => toggleSubPermission("candidates", "view")}
                              disabled={!(permissions.candidates as any).enabled}
                            />
                            <span>查看候选人列表</span>
                          </label>
                        </div>
                        <div>
                          <label className={`flex items-center gap-3 text-sm transition-colors ${(permissions.candidates as any).enabled ? "text-gray-600 cursor-pointer" : "text-gray-400 cursor-not-allowed"}`}>
                            <Checkbox
                              checked={(permissions.candidates as any).sub.batchImport}
                              onChange={() => toggleSubPermission("candidates", "batchImport")}
                              disabled={!(permissions.candidates as any).enabled}
                            />
                            <span>允许批量导入简历</span>
                          </label>
                        </div>
                        <div>
                          <label className={`flex items-center gap-3 text-sm transition-colors ${(permissions.candidates as any).enabled ? "text-gray-600 cursor-pointer" : "text-gray-400 cursor-not-allowed"}`}>
                            <Checkbox
                              checked={(permissions.candidates as any).sub.action}
                              onChange={() => toggleSubPermission("candidates", "action")}
                              disabled={!(permissions.candidates as any).enabled}
                            />
                            <span>操作移除/淘汰</span>
                          </label>
                        </div>
                        <div>
                          <label className={`flex items-center gap-3 text-sm transition-colors ${(permissions.candidates as any).enabled ? "text-gray-600 cursor-pointer" : "text-gray-400 cursor-not-allowed"}`}>
                            <Checkbox
                              checked={(permissions.candidates as any).sub.changeStatus}
                              onChange={() => toggleSubPermission("candidates", "changeStatus")}
                              disabled={!(permissions.candidates as any).enabled}
                            />
                            <span>修改候选人状态（待定→入职）</span>
                          </label>
                        </div>
                      </div>
                      <div className="pt-5 mt-3 border-t border-gray-200">
                        <p className={`text-xs mb-3.5 transition-colors ${(permissions.candidates as any).enabled ? "text-gray-400" : "text-gray-300"}`}>数据可视范围（数据隔离机制）</p>
                        <div className="grid grid-cols-3 gap-3">
                          <label className={`flex items-center gap-3 text-sm transition-colors ${(permissions.candidates as any).enabled ? "text-gray-600 cursor-pointer" : "text-gray-400 cursor-not-allowed"}`}>
                            <Radio
                              checked={(permissions.candidates as any).dataScope === "all"}
                              onChange={() => setDataScope("all")}
                              disabled={!(permissions.candidates as any).enabled}
                            />
                            <span>全公司所有数据</span>
                          </label>
                          <label className={`flex items-center gap-3 text-sm transition-colors ${(permissions.candidates as any).enabled ? "text-gray-600 cursor-pointer" : "text-gray-400 cursor-not-allowed"}`}>
                            <Radio
                              checked={(permissions.candidates as any).dataScope === "dept"}
                              onChange={() => setDataScope("dept")}
                              disabled={!(permissions.candidates as any).enabled}
                            />
                            <span>仅本部门数据</span>
                          </label>
                          <label className={`flex items-center gap-3 text-sm transition-colors ${(permissions.candidates as any).enabled ? "text-gray-600 cursor-pointer" : "text-gray-400 cursor-not-allowed"}`}>
                            <Radio
                              checked={(permissions.candidates as any).dataScope === "mine"}
                              onChange={() => setDataScope("mine")}
                              disabled={!(permissions.candidates as any).enabled}
                            />
                            <span>仅分配给我据</span>
                          </label>
                        </div>
                      </div>
                    </div>
                </div>

                <div className="bg-[#F7F8FA] rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CircleDot className={`w-4 h-4 ${(permissions.aiAnalysis as any).enabled ? "text-[#4AB5A9]" : "text-gray-400"}`} />
                      <span className={`text-sm font-medium ${(permissions.aiAnalysis as any).enabled ? "text-[#1C1E3A]" : "text-gray-400"}`}>AI 深度解析模块</span>
                    </div>
                    <Switch
                      checked={(permissions.aiAnalysis as any).enabled}
                      onChange={() => toggleModule("aiAnalysis")}
                    />
                  </div>
                </div>

                <div className="bg-[#F7F8FA] rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-400">数据看板</span>
                    </div>
                    <Switch
                      checked={(permissions.dashboard as any).enabled}
                      onChange={() => toggleModule("dashboard")}
                      disabled
                    />
                  </div>
                </div>

                <div className="bg-[#F7F8FA] rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderKanban className={`w-4 h-4 ${(permissions.interviewQuestions as any).enabled ? "text-[#4AB5A9]" : "text-gray-400"}`} />
                      <span className={`text-sm font-medium ${(permissions.interviewQuestions as any).enabled ? "text-[#1C1E3A]" : "text-gray-400"}`}>AI 面试题库辅助</span>
                    </div>
                    <Switch
                      checked={(permissions.interviewQuestions as any).enabled}
                      onChange={() => toggleModule("interviewQuestions")}
                    />
                  </div>
                </div>

                <div className="bg-[#F7F8FA] rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-400">系统管理</span>
                      <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-600 rounded">仅管理员可见</span>
                    </div>
                    <Switch
                      checked={(permissions.systemManagement as any).enabled}
                      onChange={() => toggleModule("systemManagement")}
                      disabled
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-7 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={closePermissionModal}
                disabled={savingPermissions}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50">
                取消
              </button>
              <button
                onClick={savePermissions}
                disabled={savingPermissions}
                className="px-4 py-2 text-sm font-medium text-white bg-[#4AB5A9] rounded-lg hover:bg-[#3d9a8e] transition-colors shadow-sm disabled:opacity-50">
                {savingPermissions ? "保存中..." : "保存并应用生效"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMemberModal && memberRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeMemberModal}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-[500px] mx-4 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-[#1C1E3A]">关联账号配置</h3>
              <button
                onClick={closeMemberModal}
                disabled={savingMembers}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="px-5 pt-4 pb-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="输入姓名或拼音检索企业通讯录..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4AB5A9]/20 focus:border-[#4AB5A9] transition-colors"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {loadingMembers ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  加载中...
                </div>
              ) : allUsers.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  暂无成员
                </div>
              ) : (
                <div>
                  <div className="pb-3">
                    <p className="text-xs text-gray-500 mb-2">
                      当前已拥有「{memberRole.name}」权限 ({selectedUserIds.length}人)
                    </p>
                    {selectedUserIds.length === 0 ? (
                      <p className="text-xs text-gray-300">暂无已添加成员</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {allUsers
                          .filter((u) => selectedUserIds.includes(u.id))
                          .map((user) => (
                            <span
                              key={user.id}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-[#4AB5A9] rounded-md">
                              {user.name || '未命名'}
                              <button
                                onClick={() => removeMember(user.id)}
                                className="hover:opacity-70 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">推荐添加</p>
                    {(() => {
                      const filtered = memberSearch.trim()
                        ? allUsers.filter(
                            (u) =>
                              u.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
                              u.email?.toLowerCase().includes(memberSearch.toLowerCase())
                          )
                        : allUsers.filter((u) => !selectedUserIds.includes(u.id))

                      return filtered.length === 0 ? (
                        <p className="text-xs text-gray-300 py-4 text-center">
                          {memberSearch.trim() ? '没有匹配的成员' : '暂无更多可推荐成员'}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {filtered.map((user: any) => {
                            const isSelected = selectedUserIds.includes(user.id)
                            const color = getAvatarColor(user.name || '用户')
                            const hasRoles = user.roles && user.roles.length > 0
                            return (
                              <div
                                key={user.id}
                                className="flex items-center gap-3 py-2"
                              >
                                <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>
                                  <span className="text-xs font-medium text-white">
                                    {(user.name || '用').charAt(0)}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[#1C1E3A] truncate">
                                    {user.name || '未命名'}
                                  </p>
                                  <p className="text-xs text-gray-400 truncate">
                                    {user.department || '未设置'}
                                    {user.position ? ` / ${user.position}` : ''}
                                  </p>
                                  {hasRoles && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {user.roles.slice(0, 3).map((role: string) => (
                                        <span
                                          key={role}
                                          className="inline-block px-1.5 py-0.5 text-[10px] text-gray-500 bg-gray-100 rounded">
                                          {role}
                                        </span>
                                      ))}
                                      {user.roles.length > 3 && (
                                        <span className="inline-block px-1.5 py-0.5 text-[10px] text-gray-500">
                                          +{user.roles.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {isSelected ? (
                                  <span className="text-xs text-gray-300">已加入</span>
                                ) : (
                                  <button
                                    onClick={() => addMember(user.id)}
                                    className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                                  >
                                    添加
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
              <button
                onClick={closeMemberModal}
                disabled={savingMembers}
                className="px-4 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50">
                取消
              </button>
              <button
                onClick={saveMembers}
                disabled={savingMembers}
                className="px-4 py-1.5 text-xs font-medium text-white bg-[#4AB5A9] rounded-md hover:bg-[#3d9a8e] transition-colors shadow-sm disabled:opacity-50">
                {savingMembers ? '保存中...' : '完成配置'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
