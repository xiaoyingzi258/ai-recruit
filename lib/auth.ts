import NextAuth, { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { query } from './db'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const rows = await query<any>(
          `SELECT u.id, u.name, u.email, u.role, u.company_id, c.name as company_name
           FROM users u
           LEFT JOIN companies c ON u.company_id = c.id
           WHERE u.email = $1`,
          [credentials.email]
        )

        const user = rows[0]
        if (!user) return null

        // 获取 password_hash
        const pwRows = await query<{ password_hash: string }>(
          'SELECT password_hash FROM users WHERE email = $1',
          [credentials.email]
        )

        if (!pwRows[0]) return null

        const isValid = await bcrypt.compare(credentials.password, pwRows[0].password_hash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          company_id: user.company_id,
          company_name: user.company_name,
          role: user.role,
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id || ''
        token.email = user.email || ''
        token.name = user.name || ''
        token.company_id = (user as any).company_id || ''
        token.company_name = (user as any).company_name || ''
        token.role = (user as any).role || ''
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.email = token.email
        session.user.name = token.name
        session.user.company_id = token.company_id
        session.user.company_name = token.company_name
        session.user.role = token.role
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' as const },
}

export default NextAuth(authOptions)
