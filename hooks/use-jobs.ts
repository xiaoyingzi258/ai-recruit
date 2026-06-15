"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/supabase"

type Job = Database["public"]["Tables"]["jobs"]["Row"] & {
  updated_by?: string
  creator?: {
    id: string
    name: string
    email: string
  }
}

export function useJobs(companyId?: string) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchJobs = async () => {
    // 等待 company_id 就绪后再查询，避免查出其他公司的岗位
    if (!companyId) {
      setLoading(false)
      return
    }
    try {
      // 获取 jobs，按 company_id 过滤
      let query = supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false })

      if (companyId) {
        query = query.eq("company_id", companyId)
      }

      const { data: jobsData } = await query
      
      if (jobsData && jobsData.length > 0) {
        // 获取所有相关用户
        const userIds = [...new Set(jobsData.map(job => job.created_by).filter(Boolean))]
        const { data: usersData } = await supabase
          .from("users")
          .select("id, name, email")
          .in("id", userIds)
        
        // 创建用户映射
        const userMap = new Map()
        usersData?.forEach(user => {
          userMap.set(user.id, user)
        })
        
        // 合并数据
        const formattedData = jobsData.map(job => ({
          ...job,
          creator: job.created_by ? userMap.get(job.created_by) : undefined
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
      await supabase
        .from("jobs")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id)
      await fetchJobs()
    } catch (error) {
      console.error("Failed to toggle job status:", error)
    }
  }

  const createJob = async (jobData: {
    title: string
    jd_text: string
    status: 'open' | 'closed'
    company_id: string
    created_by: string
  }) => {
    try {
      const { data } = await supabase
        .from("jobs")
        .insert({
          ...jobData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()
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

  return { jobs, loading, fetchJobs, toggleJobStatus, createJob }
}

export function useJobDetail(id: string) {
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchJob = async () => {
    try {
      // 获取 job
      const { data: jobData } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .single()
      
      if (jobData) {
        // 获取创建者信息
        let creator = undefined
        if (jobData.created_by) {
          const { data: userData } = await supabase
            .from("users")
            .select("id, name, email")
            .eq("id", jobData.created_by)
            .single()
          creator = userData
        }
        
        // 合并数据
        const formattedData = {
          ...jobData,
          creator
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
      const { updated_by, creator, ...cleanJobData } = jobData
      const { data } = await supabase
        .from("jobs")
        .update({
          ...cleanJobData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single()
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
