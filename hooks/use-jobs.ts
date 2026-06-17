"use client"

import { useState, useEffect } from "react"
import type { Job } from "@/types/database"

export function useJobs(companyId?: string) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  const fetchJobs = async () => {
    // 等待 company_id 就绪后再查询，避免查出其他公司的岗位
    if (!companyId) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/jobs?company_id=${companyId}`)
      if (!res.ok) throw new Error("Failed to fetch jobs")
      const { data: jobsData } = await res.json()

      if (jobsData && jobsData.length > 0) {
        // 获取所有相关用户
        const userIds = [...new Set(jobsData.map((job: Job) => job.created_by).filter(Boolean))]
        const usersRes = await fetch(`/api/users?ids=${userIds.join(",")}`)
        const usersData = usersRes.ok ? (await usersRes.json()).data || [] : []

        // 创建用户映射
        const userMap = new Map()
        usersData?.forEach((user: { id: string; name: string; email: string }) => {
          userMap.set(user.id, user)
        })

        // 合并数据
        const formattedData = jobsData.map((job: Job) => ({
          ...job,
          creator: job.created_by ? userMap.get(job.created_by) : undefined,
        }))
        setJobs(formattedData as Job[])
      } else {
        setJobs([])
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleJobStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "open" ? "closed" : "open"
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("Failed to toggle job status")
      await fetchJobs()
    } catch (error) {
      console.error("Failed to toggle job status:", error)
    }
  }

  const deleteJob = async (id: string) => {
    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete job")
      await fetchJobs()
    } catch (error) {
      console.error("Failed to delete job:", error)
    }
  }

  const createJob = async (jobData: {
    title: string
    jd_text: string
    status: "open" | "closed"
    company_id: string
    created_by: string
  }) => {
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobData),
      })
      if (!res.ok) throw new Error("Failed to create job")
      const { data } = await res.json()
      await fetchJobs()
      return data
    } catch (error) {
      console.error("Failed to create job:", error)
      throw error
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [companyId])

  return { jobs, loading, fetchJobs, toggleJobStatus, createJob, deleteJob }
}

export function useJobDetail(id: string) {
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchJob = async () => {
    try {
      const res = await fetch(`/api/jobs/${id}`)
      if (!res.ok) throw new Error("Failed to fetch job")
      const { data: jobData } = await res.json()

      if (jobData) {
        // 获取创建者信息
        let creator = undefined
        if (jobData.created_by) {
          const userRes = await fetch(`/api/users/${jobData.created_by}`)
          if (userRes.ok) {
            const { data: userData } = await userRes.json()
            creator = userData
          }
        }

        // 合并数据
        const formattedData = {
          ...jobData,
          creator,
        }
        setJob(formattedData as Job)
      }
    } catch (error) {
      console.error("Failed to fetch job:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateJob = async (jobData: Partial<Job>) => {
    try {
      // 移除不存在的字段
      const { creator, ...cleanJobData } = jobData as any
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanJobData),
      })
      if (!res.ok) throw new Error("Failed to update job")
      const { data } = await res.json()
      setJob(data as Job)
      return data
    } catch (error) {
      console.error("Failed to update job:", error)
      throw error
    }
  }

  useEffect(() => {
    if (id) {
      fetchJob()
    }
  }, [id])

  return { job, loading, fetchJob, updateJob }
}
