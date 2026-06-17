"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import type { Job } from "@/types/database"

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
  const { profile } = useAuth()

  const fetchOpenJobs = async () => {
    // 等待 company_id 就绪后再查询，避免查出其他公司的岗位
    if (!profile?.company_id) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const res = await fetch(`/api/jobs?company_id=${profile.company_id}&status=open`)
      if (!res.ok) throw new Error("Failed to fetch open jobs")
      const { data } = await res.json()

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
