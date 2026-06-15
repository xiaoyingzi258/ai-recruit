"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

type AuthContextType = {
  user: any
  profile: any
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  console.log('[AuthProvider] 组件渲染', { user, profile, loading })

  useEffect(() => {
    console.log('[AuthProvider] useEffect 执行')
    
    // 加载用户和公司信息的函数
    const loadUserProfile = async (userId: string, userEmail?: string) => {
      try {
        console.log('[Auth] 加载用户信息...')
        
        // 1. 查询用户信息
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*, companies (name)')
          .eq('id', userId)
          .single()
        
        if (userError) {
          console.warn('[Auth] 未找到用户信息，创建默认用户:', userError)
          
          // 2. 如果用户不存在，检查是否有公司
          const { data: companies } = await supabase
            .from('companies')
            .select('*')
            .limit(1)
          
          let companyId = null
          let companyName = '我的公司'
          
          if (companies && companies.length > 0) {
            companyId = companies[0].id
            companyName = companies[0].name
          } else {
            // 如果没有公司，创建一个默认公司
            const { data: newCompany } = await supabase
              .from('companies')
              .insert({ name: '我的公司' })
              .select()
              .single()
            
            companyId = newCompany?.id
          }
          
          // 3. 创建用户记录
          const { data: newUser } = await supabase
            .from('users')
            .insert({
              id: userId,
              name: userEmail?.split('@')[0] || '用户',
              email: userEmail || '',
              role: 'hr',
              company_id: companyId
            })
            .select('*, companies (name)')
            .single()
          
          if (newUser) {
            console.log('[Auth] 用户创建成功:', newUser)
            const profileWithCompany = {
              ...newUser,
              company_name: newUser.companies?.name || companyName
            }
            setProfile(profileWithCompany)
          }
        } else {
          console.log('[Auth] 用户信息加载成功:', userData)
          const profileWithCompany = {
            ...userData,
            company_name: userData.companies?.name
          }
          setProfile(profileWithCompany)
        }
      } catch (error) {
        console.error('[Auth] 加载用户信息失败:', error)
        
        // 如果所有方法都失败，使用一个基础的默认值
        setProfile({
          id: userId,
          name: userEmail?.split('@')[0] || '用户',
          email: userEmail || '',
          role: 'hr' as const,
          company_id: 'b7d0f2e5-6c3a-4f8a-9b1c-3d5e7f9a1c2b',
          company_name: '我的公司'
        })
      }
    }
    
    // 1. 初始化
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[Auth] 初始 session:', session?.user?.email)
      const currentUser = session?.user ?? null
      setUser(currentUser)
      
      if (currentUser) {
        loadUserProfile(currentUser.id, currentUser.email)
      }
      
      setLoading(false)
    })

    // 2. 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] 状态变化:', event, session?.user?.email)
      const currentUser = session?.user ?? null
      setUser(currentUser)
      
      if (currentUser) {
        loadUserProfile(currentUser.id, currentUser.email)
      } else {
        setProfile(null)
      }
      
      setLoading(false)
      
      // 登录成功时，只在当前页面是登录页时才跳转
      if (event === 'SIGNED_IN' && window.location.pathname === '/login') {
        console.log('[Auth] 检测到登录成功，跳转到 candidates...')
        window.location.href = '/candidates'
      }
    })

    return () => {
      console.log('[AuthProvider] useEffect 清理')
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
