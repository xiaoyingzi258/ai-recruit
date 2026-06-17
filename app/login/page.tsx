"use client"

import { useState } from "react"
import { Sparkles, Eye, EyeOff, Loader2 } from "lucide-react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

type TabType = "login" | "register"

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<TabType>("login")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  // 登录字段
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // 注册字段
  const [companyName, setCompanyName] = useState("")
  const [name, setName] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error === 'CredentialsSignin' ? '邮箱或密码错误' : result.error)
        setLoading(false)
      } else {
        router.push('/candidates')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录异常')
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail,
          password: regPassword,
          name: name,
          companyName: companyName,
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '注册失败')
        setLoading(false)
        return
      }

      // 注册成功后自动登录
      const result = await signIn('credentials', {
        email: regEmail,
        password: regPassword,
        redirect: false,
      })

      if (result?.error) {
        setError('注册成功但登录失败，请手动登录')
        setTab('login')
        setLoading(false)
      } else {
        router.push('/candidates')
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '注册异常')
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] to-[#e2e8f0] relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-slate-200/25 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            {/* Logo */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-[#4AB5A9] to-[#3d9a8e] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-[#1C1E3A]">AI 招聘助手 B端</h1>
            </div>

            {/* Tab 切换 */}
            <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => { setTab("login"); setError("") }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  tab === "login"
                    ? "bg-white text-[#1C1E3A] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                登录
              </button>
              <button
                onClick={() => { setTab("register"); setError("") }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  tab === "register"
                    ? "bg-white text-[#1C1E3A] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                注册
              </button>
            </div>

            {/* 登录表单 */}
            {tab === "login" && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-[#e5e7eb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4AB5A9] focus:border-transparent transition-all bg-gray-50"
                    placeholder="请输入邮箱地址"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">密码</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-[#e5e7eb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4AB5A9] focus:border-transparent transition-all bg-gray-50"
                      placeholder="请输入密码"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#4AB5A9] text-white font-medium rounded-xl hover:bg-[#3d9a8e] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 className="w-5 h-5 animate-spin" />登录中...</> : "登录"}
                </button>
              </form>
            )}

            {/* 注册表单 */}
            {tab === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">企业名称</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-4 py-3 border border-[#e5e7eb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4AB5A9] focus:border-transparent transition-all bg-gray-50"
                    placeholder="请输入企业名称"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">姓名</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border border-[#e5e7eb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4AB5A9] focus:border-transparent transition-all bg-gray-50"
                    placeholder="请输入您的姓名"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-[#e5e7eb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4AB5A9] focus:border-transparent transition-all bg-gray-50"
                    placeholder="请输入邮箱地址"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">密码</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-[#e5e7eb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4AB5A9] focus:border-transparent transition-all bg-gray-50"
                      placeholder="请输入密码（至少6位）"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#4AB5A9] text-white font-medium rounded-xl hover:bg-[#3d9a8e] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 className="w-5 h-5 animate-spin" />注册中...</> : "注册"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
