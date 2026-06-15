"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Database } from "@/types/supabase"

type Job = Database["public"]["Tables"]["jobs"]["Row"]

type JobContextType = {
  selectedJob: Job | null
  setSelectedJob: (job: Job | null) => void
  openJobs: Job[]
  loading: boolean
}

const JobContext = createContext<JobContextType>({
  selectedJob: null,
  setSelectedJob: () => {},
  openJobs: [],
  loading: true,
})

export function JobProvider({ children }: { children: React.ReactNode }) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [openJobs, setOpenJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { profile } = useAuth()

  const fetchOpenJobs = async () => {
    // 等待 company_id 就绪后再查询，避免查出其他公司的岗位
    if (!profile?.company_id) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      let query = supabase
        .from("jobs")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })

      if (profile?.company_id) {
        query = query.eq("company_id", profile.company_id)
      }

      const { data } = await query
      
      if (data) {
        setOpenJobs(data)
        // 默认选择第一个岗位
        if (data.length > 0 && !selectedJob) {
          setSelectedJob(data[0])
        }
      }
    } catch (error) {
      console.error("Failed to fetch open jobs:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOpenJobs()
  }, [profile?.company_id])

  return (
    <JobContext.Provider value={{ selectedJob, setSelectedJob, openJobs, loading }}>
      {children}
    </JobContext.Provider>
  )
}

export const useJob = () => useContext(JobContext)
