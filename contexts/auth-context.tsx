"use client"

import { createContext, useContext } from "react"
import { useSession, signOut } from "next-auth/react"

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
  const { data: session, status } = useSession()

  const user = session?.user ?? null
  const profile = session?.user ?? null
  const loading = status === 'loading'

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
