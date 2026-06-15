"use client"

import { useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/types/supabase"

type AnalysisResultRow = Database["public"]["Tables"]["analysis_results"]["Row"]
type AnalysisResultInsert = Database["public"]["Tables"]["analysis_results"]["Insert"]
type AnalysisResultUpdate = Database["public"]["Tables"]["analysis_results"]["Update"]

export function useAnalysis() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const insertAnalysis = useCallback(async (data: Omit<AnalysisResultInsert, "id" | "created_at" | "updated_at"> & { id?: string }) => {
    setLoading(true)
    setError(null)
    try {
      const { data: result, error: insertError } = await supabase
        .from("analysis_results")
        .upsert({
          candidate_id: data.candidate_id,
          job_id: data.job_id,
          summary: data.summary,
          risk_warnings: data.risk_warnings,
          tech_translation: data.tech_translation,
          skill_match: data.skill_match || [],
        }, { onConflict: "candidate_id" })
        .select()
        .single()

      if (insertError) throw insertError
      return result as AnalysisResultRow
    } catch (err) {
      const message = err instanceof Error ? err.message : "插入解析结果失败"
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const getAnalysisByCandidateId = useCallback(async (candidateId: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: queryError } = await supabase
        .from("analysis_results")
        .select("*")
        .eq("candidate_id", candidateId)
        .single()

      if (queryError) {
        if (queryError.code === "PGRST116") {
          return null
        }
        throw queryError
      }
      return data as AnalysisResultRow
    } catch (err) {
      const message = err instanceof Error ? err.message : "查询解析结果失败"
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const updateAnalysis = useCallback(async (candidateId: string, data: AnalysisResultUpdate) => {
    setLoading(true)
    setError(null)
    try {
      const { data: result, error: updateError } = await supabase
        .from("analysis_results")
        .update(data)
        .eq("candidate_id", candidateId)
        .select()
        .single()

      if (updateError) throw updateError
      return result as AnalysisResultRow
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新解析结果失败"
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [supabase])

  return {
    insertAnalysis,
    getAnalysisByCandidateId,
    updateAnalysis,
    loading,
    error,
  }
}