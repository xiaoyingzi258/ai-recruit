"use client"

import { useState, useCallback } from "react"
import type { AnalysisResult } from "@/types/database"

export function useAnalysis() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const insertAnalysis = useCallback(async (data: Omit<AnalysisResult, "id" | "created_at" | "updated_at"> & { id?: string }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/analyze-candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("插入解析结果失败")
      const { data: result } = await res.json()
      return result as AnalysisResult
    } catch (err) {
      const message = err instanceof Error ? err.message : "插入解析结果失败"
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const getAnalysisByCandidateId = useCallback(async (candidateId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/candidates/${candidateId}/analysis`)
      if (!res.ok) {
        if (res.status === 404) {
          return null
        }
        throw new Error("查询解析结果失败")
      }
      const { data } = await res.json()
      return data as AnalysisResult
    } catch (err) {
      const message = err instanceof Error ? err.message : "查询解析结果失败"
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const updateAnalysis = useCallback(async (candidateId: string, data: Partial<AnalysisResult>) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/analyze-candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, force: true }),
      })
      if (!res.ok) throw new Error("更新解析结果失败")
      const { data: result } = await res.json()
      return result as AnalysisResult
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新解析结果失败"
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    insertAnalysis,
    getAnalysisByCandidateId,
    updateAnalysis,
    loading,
    error,
  }
}
