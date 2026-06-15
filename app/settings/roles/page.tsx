import { Plus, Edit, Trash2, Shield } from "lucide-react"

export default function RolesPage() {
  const roles = [
    { id: "1", name: "系统管理员", description: "拥有系统最高权限", permissions: ["全部权限"], users: 1 },
    { id: "2", name: "HR主管", description: "审核管理者，可管理招聘流程", permissions: ["岗位管理", "候选人管理", "数据分析"], users: 3 },
    { id: "3", name: "招聘专员", description: "业务执行者，负责日常招聘", permissions: ["候选人管理", "匹配分析"], users: 12 },
    { id: "4", name: "面试官", description: "仅可查看候选人信息和面试题目", permissions: ["查看候选人", "面试题库"], users: 8 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">角色权限管理</h1>
          <p className="text-gray-500 mt-1">管理系统角色和权限分配</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors">
          <Plus className="w-4 h-4" />
          新建角色
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {roles.map((role) => (
          <div key={role.id} className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{role.name}</h3>
                <p className="text-xs text-gray-500">{role.users} 位用户</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">{role.description}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {role.permissions.map((perm, index) => (
                <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                  {perm}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button className="flex-1 p-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-center gap-1">
                <Edit className="w-4 h-4" />
                编辑
              </button>
              <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
