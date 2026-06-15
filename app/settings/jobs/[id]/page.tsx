"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useJobDetail } from "@/hooks/use-jobs"

const tabs = [
  { key: "jobs", label: "岗位管理", disabled: false },
  { key: "roles", label: "角色权限", disabled: true },
  { key: "company", label: "企业信息", disabled: true },
]

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { job, loading, updateJob } = useJobDetail(id)
  
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState("")
  const [jdText, setJdText] = useState("")
  const [status, setStatus] = useState<"open" | "closed">("open")
  const [errors, setErrors] = useState<{ title?: string; jd?: string }>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (job) {
      setTitle(job.title)
      setJdText(job.jd_text || "")
      setStatus(job.status as "open" | "closed")
    }
  }, [job])

  const handleCancel = () => {
    if (job) {
      setTitle(job.title)
      setJdText(job.jd_text || "")
      setStatus(job.status as "open" | "closed")
    }
    setErrors({})
    setIsEditing(false)
  }

  const handleSave = async () => {
    const newErrors: { title?: string; jd?: string } = {}
    if (!title.trim()) newErrors.title = "请输入岗位名称"
    if (!jdText.trim()) newErrors.jd = "请输入岗位JD"
    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) return

    setSaving(true)
    try {
      await updateJob({
        title,
        jd_text: jdText,
        status,
      })
      setIsEditing(false)
    } catch (error) {
      console.error("Failed to update job:", error)
    } finally {
      setSaving(false)
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
        <span className="text-gray-400">{job?.title || "加载中"}</span>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#4AB5A9] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !job ? (
        <div className="py-20 text-center text-gray-500">
          <p>岗位不存在</p>
        </div>
      ) : (
        <>
          {/* 标题行 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[#1C1E3A]">{title || job.title}</h1>
              <span className={`px-2.5 py-0.5 text-xs font-medium rounded ${
                (isEditing ? status : job.status) === "open"
                  ? "bg-green-100 text-green-600"
                  : "bg-gray-100 text-gray-500"
              }`}>
                {(isEditing ? status : job.status) === "open" ? "招聘中" : "已关闭"}
              </span>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                编辑
              </button>
            )}
          </div>

          {isEditing ? (
            /* 编辑模式 */
            <div className="space-y-6">
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
                />
                {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
              </div>

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
                />
                {errors.jd && <p className="mt-1 text-xs text-red-500">{errors.jd}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">岗位状态</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit-status"
                      checked={status === "open"}
                      onChange={() => setStatus("open")}
                      className="w-4 h-4 text-[#4AB5A9] focus:ring-[#4AB5A9]"
                    />
                    <span className="text-sm text-gray-700">招聘中</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit-status"
                      checked={status === "closed"}
                      onChange={() => setStatus("closed")}
                      className="w-4 h-4 text-[#4AB5A9] focus:ring-[#4AB5A9]"
                    />
                    <span className="text-sm text-gray-700">暂停招聘</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-6 border-t border-gray-200">
                <button
                  onClick={handleCancel}
                  className="px-5 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 bg-[#4AB5A9] text-white rounded-lg hover:bg-[#3d9a8e] transition-colors text-sm font-medium disabled:opacity-70"
                >
                  {saving ? "保存中..." : "保存修改"}
                </button>
              </div>
            </div>
          ) : (
            /* 查看模式 */
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">岗位名称</label>
                <p className="text-sm text-[#1C1E3A]">{job.title}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">岗位JD</label>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {job.jd_text}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">岗位状态</label>
                <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded ${
                  job.status === "open" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"
                }`}>
                  {job.status === "open" ? "招聘中" : "已关闭"}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">创建时间</label>
                <p className="text-sm text-gray-700">{new Date(job.created_at).toLocaleDateString("zh-CN")}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
