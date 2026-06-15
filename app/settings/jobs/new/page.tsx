"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useJobs } from "@/hooks/use-jobs"
import { useAuth } from "@/contexts/auth-context"

const tabs = [
  { key: "jobs", label: "岗位管理", disabled: false },
  { key: "roles", label: "角色权限", disabled: true },
  { key: "company", label: "企业信息", disabled: true },
]

export default function NewJobPage() {
  const router = useRouter()
  const { profile, user } = useAuth()
  const { createJob } = useJobs(profile?.company_id)
  
  const [title, setTitle] = useState("")
  const [jdText, setJdText] = useState("")
  const [status, setStatus] = useState<"open" | "closed">("open")
  const [errors, setErrors] = useState<{ title?: string; jd?: string }>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const newErrors: { title?: string; jd?: string } = {}
    if (!title.trim()) newErrors.title = "请输入岗位名称"
    if (!jdText.trim()) newErrors.jd = "请输入岗位JD"
    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) return

    setLoading(true)
    try {
      await createJob({
        title,
        jd_text: jdText,
        status,
        company_id: profile?.company_id || "",
        created_by: user?.id || "",
      })
      router.push("/settings/jobs")
    } catch (error) {
      console.error("Failed to create job:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* 顶部 Tab 栏 */}
      <div className="flex items-center gap-0 border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <div
            key={tab.key}
            className={`relative px-5 py-3 text-sm font-medium transition-colors ${
              tab.disabled
                ? "text-gray-400 cursor-not-allowed"
                : tab.key === "jobs"
                ? "text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={tab.disabled ? undefined : undefined}
          >
            <span>{tab.label}</span>
            {tab.disabled && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">即将上线</span>
            )}
            {tab.key === "jobs" && (
              <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-blue-500 rounded-t" />
            )}
          </div>
        ))}
      </div>

      {/* 面包屑 */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/settings/jobs" className="hover:text-gray-700">岗位管理</Link>
        <span>/</span>
        <span className="text-gray-400">新建岗位</span>
      </div>

      {/* 标题 */}
      <h1 className="text-xl font-bold text-[#1C1E3A] mb-6">新建岗位</h1>

      {/* 表单 */}
      <div className="space-y-6">
        {/* 岗位名称 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            岗位名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setErrors((prev) => ({ ...prev, title: undefined })) }}
            className={`w-full max-w-xl px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4AB5A9]/30 focus:border-[#4AB5A9] transition-colors ${
              errors.title ? "border-red-300" : "border-gray-200"
            }`}
            placeholder="如：高级前端开发工程师"
          />
          {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
        </div>

        {/* 岗位JD */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            岗位JD <span className="text-red-500">*</span>
          </label>
          <textarea
            value={jdText}
            onChange={(e) => { setJdText(e.target.value); setErrors((prev) => ({ ...prev, jd: undefined })) }}
            className={`w-full max-w-2xl px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4AB5A9]/30 focus:border-[#4AB5A9] transition-colors resize-none ${
              errors.jd ? "border-red-300" : "border-gray-200"
            }`}
            style={{ minHeight: "300px" }}
            placeholder="请粘贴岗位JD全文，AI将基于JD进行简历匹配和面试题生成"
          />
          {errors.jd && <p className="mt-1 text-xs text-red-500">{errors.jd}</p>}
          <p className="mt-1.5 text-xs text-gray-400">支持粘贴完整的职位描述，包括岗位职责、任职要求、加分项等</p>
        </div>

        {/* 岗位状态 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">岗位状态</label>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                checked={status === "open"}
                onChange={() => setStatus("open")}
                className="w-4 h-4 text-[#4AB5A9] focus:ring-[#4AB5A9]"
              />
              <span className="text-sm text-gray-700">招聘中</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                checked={status === "closed"}
                onChange={() => setStatus("closed")}
                className="w-4 h-4 text-[#4AB5A9] focus:ring-[#4AB5A9]"
              />
              <span className="text-sm text-gray-700">暂停招聘</span>
            </label>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex items-center gap-3 pt-6 border-t border-gray-200">
          <Link
            href="/settings/jobs"
            className="px-5 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            取消
          </Link>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 bg-[#4AB5A9] text-white rounded-lg hover:bg-[#3d9a8e] transition-colors text-sm font-medium disabled:opacity-70"
          >
            {loading ? "创建中..." : "创建岗位"}
          </button>
        </div>
      </div>
    </div>
  )
}
