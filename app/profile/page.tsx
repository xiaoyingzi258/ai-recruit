"use client"

import { User, LogOut, Lock } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"

export default function ProfilePage() {
  const { profile, signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <User className="w-6 h-6 text-gray-600" />
            <h1 className="text-2xl font-bold text-gray-900">个人中心</h1>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>退出登录</span>
          </button>
        </div>

        <div className="flex items-start gap-8">
          <div className="w-24 h-24 bg-gradient-to-br from-[#4AB5A9] to-[#3d9a8e] rounded-full flex items-center justify-center shrink-0">
            <User className="w-12 h-12 text-white" />
          </div>

          <div className="flex-1">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-gray-900">
                {profile?.name || '用户'}
              </h2>
              <p className="text-sm text-gray-500">
                ID: {profile?.id || '-'}
              </p>
              <p className="text-sm text-gray-500">
                邮箱: {profile?.email || '未绑定'}
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  <Lock className="w-4 h-4" />
                  <span>修改密码</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
