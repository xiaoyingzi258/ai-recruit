"use client"

import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

const tabs = [
  { key: "jobs", label: "岗位管理", disabled: false },
  { key: "roles", label: "角色权限", disabled: false },
  { key: "company", label: "企业信息", disabled: true },
]

const roles = [
  {
    id: "1",
    name: "系统管理员",
    description: "拥有平台所有模块及AI基础配置的最高权限。",
    userCount: 1,
    status: "active",
  },
]

export default function RolesPage() {
  const router = useRouter()

  return (
    <div>
      {/* 白色卡片容器（Tab + 表格） */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Tab 栏 */}
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center gap-1 border-b-0">
            {tabs.map((tab) => (
              <div
                key={tab.key}
                onClick={() => {
                  if (!tab.disabled) {
                    if (tab.key === "roles") router.push("/settings/roles")
                    if (tab.key === "jobs") router.push("/settings/jobs")
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

        {/* 标题栏和新建角色按钮 */}
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="text-base font-semibold text-[#1C1E3A]">角色列表</h2>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-[#4AB5A9] text-white rounded-lg hover:bg-[#3d9a8e] transition-colors text-sm font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新建角色
          </button>
        </div>

        {/* 角色列表表格 */}
        <div className="px-6 pb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 rounded-lg overflow-hidden">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色名称</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色描述</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">关联账号</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-4">
                      <span className="font-medium text-[#1C1E3A]">{role.name}</span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {role.description}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {role.userCount} 人
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${
                        role.status === "active"
                          ? "bg-green-50 text-green-600"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          role.status === "active" ? "bg-green-500" : "bg-gray-400"
                        }`} />
                        {role.status === "active" ? "已启用" : "已停用"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-400">系统预置，不可修改</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
