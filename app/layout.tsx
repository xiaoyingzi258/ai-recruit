import type { Metadata } from "next"
import "./globals.css"
import AppLayout from "@/components/AppLayout"
import { AuthProvider } from "@/contexts/auth-context"
import { JobProvider } from "@/contexts/job-context"

export const metadata: Metadata = {
  title: "AI 招聘助手",
  description: "AI-powered recruitment platform",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          <JobProvider>
            <AppLayout>{children}</AppLayout>
          </JobProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
