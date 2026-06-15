"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Plus, Briefcase } from "lucide-react"
import { useJobs } from "@/hooks/use-jobs"
import { useAuth } from "@/contexts/auth-context"

type JobStatus = "open" | "closed"

interface Job {
  id: string
  title: string
  status: JobStatus
  created_at: string
  company_id?: string
  created_by?: string
  jd_text?: string
  updated_at?: string
  creator?: {
    id: string
    name: string
    email: string
  }
}

const tabs = [
  { key: "jobs", label: "岗位管理", disabled: false },
  { key: "roles", label: "角色权限", disabled: true },
  { key: "company", label: "企业信息", disabled: true },
]

export default function JobsPage() {
  const { profile } = useAuth()
  const { jobs, loading, toggleJobStatus } = useJobs(profile?.company_id)

  const getUpdatedBy = (job: Job) => {
    return job.creator?.name || profile?.name || "admin"
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN")
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

      {/* 页面标题行 */}
      <div className="flex items-center mb-5">
        <Link
          href="/settings/jobs/new"
          className="flex items-center gap-2 px-4 py-2 bg-[#4AB5A9] text-white rounded-lg hover:bg-[#3d9a8e] transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          新建岗位
        </Link>
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
          <Link
            href="/settings/jobs/new"
            className="px-5 py-2 bg-[#4AB5A9] text-white rounded-lg hover:bg-[#3d9a8e] transition-colors text-sm font-medium"
          >
            新建第一个岗位
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">岗位名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">候选人数</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最后更新人</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/settings/jobs/${job.id}`} className="font-medium text-[#1C1E3A] hover:text-blue-600 transition-colors">
                      {job.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded ${
                      job.status === "open" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"
                    }`}>
                      {job.status === "open" ? "招聘中" : "已关闭"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">0人</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(job.created_at)}</td>
                  <td className="px-6 py-4 text-sm text-[#4AB5A9]">由{getUpdatedBy(job)}更新</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Link href={`/settings/jobs/${job.id}`} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                        编辑
                      </Link>
                      <button
                        onClick={() => toggleJobStatus(job.id, job.status)}
                        className={`text-sm font-medium ${
                          job.status === "open" ? "text-red-500 hover:text-red-600" : "text-green-500 hover:text-green-600"
                        }`}
                      >
                        {job.status === "open" ? "关闭岗位" : "重新开启"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
