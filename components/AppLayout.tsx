"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, Users, Settings, Sparkles, LogOut, FileSearch, MessageSquare, User, PanelLeft } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useJob } from "@/contexts/job-context"
import { TooltipProvider } from "@/components/ui/tooltip"

const navItems = [
  {
    href: "/candidates",
    icon: Users,
    label: "匹配候选人",
    matchPattern: (path: string) => path === "/candidates",
  },
  {
    href: "/deep-analysis",
    icon: FileSearch,
    label: "深度解析",
    matchPattern: (path: string) =>
      path === "/deep-analysis" ||
      /^\/candidates\/[^\/]+\/?$/.test(path) ||
      /^\/candidates\/[^\/]+\/analysis\/?/.test(path),
  },
  {
    href: "/interview-questions",
    icon: MessageSquare,
    label: "面试辅助",
    matchPattern: (path: string) =>
      path === "/interview-questions" ||
      /^\/candidates\/[^\/]+\/interview\/?/.test(path),
  },
  {
    href: "/settings",
    icon: Settings,
    label: "系统设置",
    matchPattern: (path: string) => path === "/settings" || path.startsWith("/settings/"),
  },
]

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const authState = useAuth()
  const { profile, loading: authLoading, signOut } = authState
  const { selectedJob, loading: jobsLoading } = useJob()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  console.log("[AppLayout] useAuth 返回:", authState)

  const isLoginPage = pathname === "/login"

  if (isLoginPage) {
    return <>{children}</>
  }

  // 如果未登录，重定向到登录页
  if (!authLoading && !authState.user) {
    router.push("/login")
    return null
  }

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  const roleLabel = profile?.role === "admin" ? "管理员" : profile?.role === "manager" ? "经理" : "招聘专员"
  const sidebarWidth = sidebarCollapsed ? '80px' : '236px'
  const mainMargin = sidebarCollapsed ? '80px' : '236px'

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside 
        className="bg-white border-r border-gray-200 flex flex-col fixed top-0 left-0 h-screen z-10 transition-all duration-300 ease-in-out" 
        style={{ width: sidebarWidth }}
      >
        <div className="border-b-0 flex items-center shrink-0" style={{ height: '70px', padding: sidebarCollapsed ? '0 24px' : '0 20px' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#4AB5A9] to-[#3d9a8e] rounded-xl flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className={`overflow-hidden transition-opacity duration-200 ${sidebarCollapsed ? 'opacity-0' : 'opacity-100'}`} style={{ transitionDelay: sidebarCollapsed ? '0ms' : '150ms' }}>
              <h1 className="text-lg font-bold text-[#1C1E3A] whitespace-nowrap">AI 招聘助手</h1>
              <p className="text-xs text-gray-500 whitespace-nowrap">B端管理平台</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-5 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = (() => {
              if (item.matchPattern) {
                return item.matchPattern(pathname)
              }
              return pathname === item.href || pathname.startsWith(item.href + '/')
            })()
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-[#E8F5F3] text-[#4AB5A9] font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                } ${sidebarCollapsed ? 'justify-center' : ''}`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span 
                  className={`whitespace-nowrap overflow-hidden transition-opacity duration-200 ${sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}
                  style={{ transitionDelay: sidebarCollapsed ? '0ms' : '150ms' }}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        <div className={`border-t-0 shrink-0 ${sidebarCollapsed ? 'p-3' : 'p-5'}`}>
          <div 
            className={`bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors ${sidebarCollapsed ? 'p-3 flex justify-center' : 'p-4'}`}
            onClick={() => router.push('/profile')}
          >
            <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <div className={`${sidebarCollapsed ? 'w-10 h-10' : 'w-12 h-12'} bg-gradient-to-br from-[#4AB5A9] to-[#3d9a8e] rounded-full flex items-center justify-center shrink-0`}>
                <User className={`${sidebarCollapsed ? 'w-5 h-5' : 'w-6 h-6'} text-white`} />
              </div>
              <div 
                className={`flex-1 min-w-0 overflow-hidden transition-opacity duration-200 ${sidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}
                style={{ transitionDelay: sidebarCollapsed ? '0ms' : '150ms' }}
              >
                <p className="text-sm font-medium text-gray-900 truncate">
                  {profile?.name || '用户'}
                </p>
                <p className="text-sm text-gray-500">
                  {roleLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col transition-all duration-300 ease-in-out" style={{ marginLeft: mainMargin }}>
        <header className="bg-white border-b border-gray-200 flex items-center justify-between fixed top-0 z-20 transition-all duration-300 ease-in-out" style={{ height: '70px', padding: '0 20px', width: `calc(100% - ${mainMargin})`, right: '0' }}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <PanelLeft className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            {profile?.company_name && (
              <span className="text-sm text-gray-600">{profile.company_name}</span>
            )}
            <div 
              className="w-8 h-8 bg-gradient-to-br from-[#4AB5A9] to-[#3d9a8e] rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => router.push('/profile')}
            >
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto" style={{ padding: '20px', marginTop: '70px' }}>
          <TooltipProvider>{children}</TooltipProvider>
        </div>
      </main>
    </div>
  )
}
