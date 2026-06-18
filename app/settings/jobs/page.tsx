"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { X, Plus, Briefcase, Search } from "lucide-react"
import { useJobs } from "@/hooks/use-jobs"
import { useAuth } from "@/contexts/auth-context"

type JobStatus = "open" | "closed"

interface Job {
  id: string
  title: string
  status: JobStatus
  created_at: string
}

const tabs = [
  { key: "jobs", label: "岗位管理", disabled: false },
  { key: "roles", label: "角色权限", disabled: false },
  { key: "company", label: "企业信息", disabled: false },
]

export default function JobsPage() {
  const router = useRouter()
  const { profile, user } = useAuth()
  const { jobs, loading, toggleJobStatus, createJob, fetchJobs } = useJobs(profile?.company_id)
  const [searchKeyword, setSearchKeyword] = useState("")

  // 新建岗位弹窗
  const [showModal, setShowModal] = useState(false)
  const [title, setTitle] = useState("")
  const [jdText, setJdText] = useState("")
  const [status, setStatus] = useState<"open" | "closed">("open")
  const [errors, setErrors] = useState<{ title?: string; jd?: string }>({})
  const [submitting, setSubmitting] = useState(false)

  // 编辑岗位弹窗
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingJob, setEditingJob] = useState<{ id: string; title: string; jd_text: string; status: "open" | "closed" } | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editJdText, setEditJdText] = useState("")
  const [editStatus, setEditStatus] = useState<"open" | "closed">("open")
  const [editErrors, setEditErrors] = useState<{ title?: string; jd?: string }>({})
  const [editSubmitting, setEditSubmitting] = useState(false)

  // 删除确认弹窗
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingJob, setDeletingJob] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const getUpdatedBy = (job: any) => {
    return job.creator_name || "未知"
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN")
  }

  const filteredJobs = useMemo(() => {
    if (!searchKeyword.trim()) return jobs
    const keyword = searchKeyword.trim().toLowerCase()
    return jobs.filter((job: any) =>
      job.title?.toLowerCase().includes(keyword)
    )
  }, [jobs, searchKeyword])

  // 新建岗位
  const openModal = () => {
    setTitle("")
    setJdText("")
    setStatus("open")
    setErrors({})
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
  }

  // 编辑岗位
  const openEditModal = (job: { id: string; title: string; jd_text?: string; status: "open" | "closed" }) => {
    setEditingJob({ id: job.id, title: job.title, jd_text: job.jd_text || "", status: job.status })
    setEditTitle(job.title)
    setEditJdText(job.jd_text || "")
    setEditStatus(job.status)
    setEditErrors({})
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditingJob(null)
  }

  const openDeleteConfirm = (id: string, title: string) => {
    setDeletingJob({ id, title })
    setShowDeleteConfirm(true)
  }

  const closeDeleteConfirm = () => {
    setShowDeleteConfirm(false)
    setDeletingJob(null)
  }

  const handleDelete = async () => {
    if (!deletingJob) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/jobs/${deletingJob.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '删除失败')
      }

      await fetchJobs()
      closeDeleteConfirm()
    } catch (error) {
      console.error("Failed to delete job:", error)
    } finally {
      setDeleting(false)
    }
  }

  const handleSubmit = async () => {
    const newErrors: { title?: string; jd?: string } = {}
    if (!title.trim()) newErrors.title = "请输入岗位名称"
    if (!jdText.trim()) newErrors.jd = "请输入岗位JD"
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    setSubmitting(true)
    try {
      await createJob({
        title,
        jd_text: jdText,
        status,
        company_id: profile?.company_id || "",
        created_by: user?.id || "",
      })
      await fetchJobs()
      setShowModal(false)
    } catch (error) {
      console.error("Failed to create job:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSubmit = async () => {
    if (!editingJob) return
    const newErrors: { title?: string; jd?: string } = {}
    if (!editTitle.trim()) newErrors.title = "请输入岗位名称"
    if (!editJdText.trim()) newErrors.jd = "请输入岗位JD"
    setEditErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    setEditSubmitting(true)
    try {
      const response = await fetch(`/api/jobs/${editingJob.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          jd_text: editJdText,
          status: editStatus,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '更新失败')
      }

      await fetchJobs()
      closeEditModal()
    } catch (error) {
      console.error("Failed to update job:", error)
    } finally {
      setEditSubmitting(false)
    }
  }

  // ESC 键关闭弹窗
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showModal) closeModal()
        if (showEditModal) closeEditModal()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showModal, showEditModal])

  return (
    <div>
      {/* 白色卡片容器（Tab + 搜索 + 表格） */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Tab 栏 */}
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center gap-1 border-b-0">
            {tabs.map((tab) => (
              <div
                key={tab.key}
                onClick={() => {
                  if (!tab.disabled) {
                    if (tab.key === "roles") router.push("/settings/roles")
                    if (tab.key === "jobs") router.push("/settings/jobs")
                    if (tab.key === "company") router.push("/settings/company")
                  }
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  tab.disabled
                    ? "text-gray-400 cursor-not-allowed"
                    : tab.key === "jobs"
                    ? "bg-[#E8F5F3] text-[#4AB5A9] cursor-pointer"
                    : "text-gray-500 hover:text-gray-700 cursor-pointer"
                }`}
              >
                {tab.label}
              </div>
            ))}
          </div>
        </div>

        {/* 搜索框和新建岗位按钮 */}
        <div className="flex items-center justify-between px-6 py-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索岗位名称..."
              className="w-72 pl-10 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-[#4AB5A9] focus:ring-1 focus:ring-[#4AB5A9]/30 transition-colors"
            />
          </div>
          <button
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2 bg-[#4AB5A9] text-white rounded-lg hover:bg-[#3d9a8e] transition-colors text-sm font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新建岗位
          </button>
        </div>

        {/* 岗位列表 */}
        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#4AB5A9] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Briefcase className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-400 mb-4">还没有创建岗位</p>
            <button
              onClick={openModal}
              className="px-5 py-2 bg-[#4AB5A9] text-white rounded-lg hover:bg-[#3d9a8e] transition-colors text-sm font-medium"
            >
              新建第一个岗位
            </button>
          </div>
        ) : (
          <div className="px-6 pb-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 rounded-lg overflow-hidden">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">岗位名称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">候选人数</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最后更新人</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredJobs.map((job: any) => (
                    <tr key={job.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-4">
                        <span className={`font-medium ${job.status === "open" ? "text-[#1C1E3A]" : "text-gray-400"}`}>
                          {job.title}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${
                          job.status === "open" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${job.status === "open" ? "bg-green-500" : "bg-gray-400"}`} />
                          {job.status === "open" ? "招聘中" : "暂停招聘"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{job.candidate_count ?? 0}人</td>
                      <td className="px-4 py-4 text-sm text-gray-500">{formatDate(job.created_at)}</td>
                      <td className="px-4 py-4 text-sm">
                        <span className="text-[#4AB5A9]">由 {getUpdatedBy(job)} 更新</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openEditModal(job)}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => toggleJobStatus(job.id, job.status)}
                            className={`text-sm font-medium ${
                              job.status === "open" ? "text-red-500 hover:text-red-600" : "text-[#4AB5A9] hover:text-[#3d9a8e]"
                            }`}
                          >
                            {job.status === "open" ? "关闭岗位" : "开启岗位"}
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(job.id, job.title)}
                            className="text-sm font-medium text-gray-500 hover:text-gray-700"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 新建岗位弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-[#1C1E3A]">新建岗位</h2>
              <button
                onClick={closeModal}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  岗位名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setErrors((prev) => ({ ...prev, title: undefined })) }}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4AB5A9]/30 focus:border-[#4AB5A9] transition-colors ${
                    errors.title ? "border-red-300" : "border-gray-200"
                  }`}
                  placeholder="如：高级前端开发工程师"
                />
                {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  岗位 JD（职位描述）<span className="text-red-500">*</span>
                </label>
                <textarea
                  value={jdText}
                  onChange={(e) => { setJdText(e.target.value); setErrors((prev) => ({ ...prev, jd: undefined })) }}
                  className={`w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4AB5A9]/30 focus:border-[#4AB5A9] transition-colors resize-none ${
                    errors.jd ? "border-red-300" : "border-gray-200"
                  }`}
                  style={{ minHeight: "160px" }}
                  placeholder="请粘贴岗位JD全文，包括岗位职责、任职要求、加分项等..."
                />
                <div className="mt-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-3 border border-gray-100 leading-relaxed">
                  <p className="mb-1">系统底层大模型将基于您在此处填写的 JD 内容，精准提取岗位画像，从而实现：</p>
                  <p className="ml-2">1. 简历的智能匹配与打分</p>
                  <p className="ml-2">2. 定制化防伪面试题的动态生成</p>
                  <p className="mt-2 text-gray-400">支持粘贴完整的职位描述，JD 内容越详细，AI 简历匹配与面试题生成的准确度越高。</p>
                </div>
                {errors.jd && <p className="mt-1 text-xs text-red-500">{errors.jd}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">岗位状态</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={status === "open"}
                      onChange={() => setStatus("open")}
                      className="w-4 h-4 text-[#4AB5A9] focus:ring-[#4AB5A9] accent-[#4AB5A9]"
                    />
                    <span className="text-sm text-gray-700">招聘中</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={status === "closed"}
                      onChange={() => setStatus("closed")}
                      className="w-4 h-4 text-[#4AB5A9] focus:ring-[#4AB5A9] accent-[#4AB5A9]"
                    />
                    <span className="text-sm text-gray-700">暂停招聘</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={closeModal}
                className="px-5 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-white hover:border-gray-400 transition-colors text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 bg-[#4AB5A9] text-white rounded-lg hover:bg-[#3d9a8e] transition-colors text-sm font-medium disabled:opacity-70 shadow-sm"
              >
                {submitting ? "保存中..." : "保存岗位"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑岗位弹窗 */}
      {showEditModal && editingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeEditModal}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-[#1C1E3A]">编辑岗位 - {editingJob.title}</h2>
              <button
                onClick={closeEditModal}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  岗位名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => { setEditTitle(e.target.value); setEditErrors((prev) => ({ ...prev, title: undefined })) }}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4AB5A9]/30 focus:border-[#4AB5A9] transition-colors ${
                    editErrors.title ? "border-red-300" : "border-gray-200"
                  }`}
                />
                {editErrors.title && <p className="mt-1 text-xs text-red-500">{editErrors.title}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  岗位 JD（职位描述）<span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editJdText}
                  onChange={(e) => { setEditJdText(e.target.value); setEditErrors((prev) => ({ ...prev, jd: undefined })) }}
                  className={`w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4AB5A9]/30 focus:border-[#4AB5A9] transition-colors resize-none ${
                    editErrors.jd ? "border-red-300" : "border-gray-200"
                  }`}
                  style={{ minHeight: "160px" }}
                />
                <div className="mt-2 text-xs text-gray-400 bg-gray-50 rounded-lg p-3 border border-gray-100 leading-relaxed">
                  <p className="mb-1">系统底层大模型将基于您在此处填写的 JD 内容，精准提取岗位画像，从而实现：</p>
                  <p className="ml-2">1. 简历的智能匹配与打分</p>
                  <p className="ml-2">2. 定制化防伪面试题的动态生成</p>
                  <p className="mt-2 text-gray-400">支持粘贴完整的职位描述，JD 内容越详细，AI 简历匹配与面试题生成的准确度越高。</p>
                </div>
                {editErrors.jd && <p className="mt-1 text-xs text-red-500">{editErrors.jd}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">岗位状态</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit-status"
                      checked={editStatus === "open"}
                      onChange={() => setEditStatus("open")}
                      className="w-4 h-4 text-[#4AB5A9] focus:ring-[#4AB5A9] accent-[#4AB5A9]"
                    />
                    <span className="text-sm text-gray-700">招聘中</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edit-status"
                      checked={editStatus === "closed"}
                      onChange={() => setEditStatus("closed")}
                      className="w-4 h-4 text-[#4AB5A9] focus:ring-[#4AB5A9] accent-[#4AB5A9]"
                    />
                    <span className="text-sm text-gray-700">暂停招聘</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={closeEditModal}
                className="px-5 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-white hover:border-gray-400 transition-colors text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={editSubmitting}
                className="px-5 py-2 bg-[#4AB5A9] text-white rounded-lg hover:bg-[#3d9a8e] transition-colors text-sm font-medium disabled:opacity-70 shadow-sm"
              >
                {editSubmitting ? "保存中..." : "保存岗位"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeDeleteConfirm}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5">
              <h3 className="text-base font-semibold text-[#1C1E3A] mb-2">确认删除</h3>
              <p className="text-sm text-gray-500">
                确定要删除岗位「<span className="font-medium text-gray-700">{deletingJob?.title}</span>」吗？此操作不可恢复。
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={closeDeleteConfirm}
                className="px-5 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-white hover:border-gray-400 transition-colors text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-70 shadow-sm"
              >
                {deleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
