'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { User, AlertTriangle, Play, Activity, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'

const supabase = createClient()

type Candidate = {
  id: string
  name: string
  work_years?: string | number
  current_company?: string
  parsed_data?: any
  job_id: string | null
}

type AnalysisResult = {
  id: string
  summary?: any
  risk_warnings?: any
  tech_translation?: any
  skill_match?: any
}

type Job = {
  id: string
  title: string
  jd_text: string
}

export default function CandidateDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { profile } = useAuth()
  const candidateId = params.id as string
  const source = searchParams?.get('source') || ''
  const isFromDeepAnalysis = source === 'deep-analysis'

  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [candidateJob, setCandidateJob] = useState<Job | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const analysisRequestedRef = useRef(false)

  useEffect(() => {
    if (candidateId && profile) {
      loadCandidateData()
    }
  }, [candidateId, profile])

  const loadCandidateData = async () => {
    try {
      setLoading(true)

      const { data: candidateRows } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', candidateId)
        .limit(1)

      if (!candidateRows || candidateRows.length === 0) {
        setLoading(false)
        return
      }

      const candidateData = candidateRows[0]
      setCandidate(candidateData)

      // 根据候选人记录的 job_id 加载独立的岗位信息（不依赖页面顶部的岗位选择器）
      let jobData: Job | null = null
      if (candidateData.job_id) {
        const { data: jobRows } = await supabase
          .from('jobs')
          .select('id, title, jd_text')
          .eq('id', candidateData.job_id)
          .limit(1)

        if (jobRows && jobRows.length > 0) {
          jobData = jobRows[0]
          setCandidateJob(jobData)
        }
      }

      const { data: analysisRows } = await supabase
        .from('analysis_results')
        .select('*')
        .eq('candidate_id', candidateId)
        .limit(1)

      if (analysisRows && analysisRows.length > 0) {
        const analysisData = analysisRows[0]
        setAnalysis(analysisData)
      } else if (!analysisRequestedRef.current) {
        analysisRequestedRef.current = true
        await generateAnalysis(candidateData, jobData)
      }

    } catch (error) {
      console.error('加载候选人数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateAnalysis = async (candidateData: Candidate, jobData?: Job | null) => {
    const activeJob = jobData || candidateJob
    if (!activeJob || !profile?.company_id) {
      alert('请先选择一个岗位')
      return
    }

    setAnalyzing(true)

    try {
      const response = await fetch('/api/analyze-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidateId,
          job_id: activeJob.id,
          job_description: activeJob.jd_text
        })
      })

      const result = await response.json()

      if (result.success) {
        setAnalysis(result.data)
      } else {
        alert('深度解析失败: ' + result.error)
      }

    } catch (error) {
      console.error('生成分析失败:', error)
      alert('深度解析失败: ' + (error as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleRegenerate = async () => {
    const activeJob = candidateJob
    if (!activeJob || !profile?.company_id) {
      alert('请先选择一个岗位')
      return
    }

    setRegenerating(true)

    try {
      const response = await fetch('/api/analyze-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidateId,
          job_id: activeJob.id,
          job_description: activeJob.jd_text,
          force: true
        })
      })

      const result = await response.json()

      if (result.success) {
        setAnalysis(result.data)
      } else {
        alert('重新生成失败: ' + result.error)
      }
    } catch (error) {
      console.error('重新生成分析失败:', error)
      alert('重新生成失败: ' + (error as Error).message)
    } finally {
      setRegenerating(false)
    }
  }

  const handleGenerateInterview = () => {
    router.push(`/candidates/${candidateId}/interview`)
  }

  if (loading || analyzing) {
    return (
      <div>
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4AB5A9] mx-auto mb-4"></div>
              <p className="text-gray-700 font-medium">
                {analyzing ? '正在进行深度解析...' : '加载中...'}
              </p>
              <p className="text-sm text-gray-500 mt-1">请稍候，处理中勿操作</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-600">候选人不存在</p>
      </div>
    )
  }

  const education = candidate.parsed_data?.education?.[0]
  const skills = candidate.parsed_data?.skills

  return (
    <div>
      {regenerating && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4AB5A9] mx-auto mb-4"></div>
              <p className="text-gray-700 font-medium">正在重新生成解析结果...</p>
              <p className="text-sm text-gray-500 mt-1">请稍候，处理中勿操作</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1280px] mx-auto space-y-6">
        <div className="bg-white rounded-3xl p-8 shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-gradient-to-br from-[#1C1E3A] to-[#374151] rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                {candidate.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-[#1C1E3A]">{candidate.name}</h1>
                  <span className={`px-3 py-1 text-sm font-medium rounded-lg ${isFromDeepAnalysis ? 'bg-[#E8F5F3] text-[#4AB5A9]' : 'bg-gray-100 text-gray-600'}`}>
                    {isFromDeepAnalysis ? '深度解析' : '候选人'}
                  </span>
                </div>
                <div className="flex items-center gap-5 text-gray-500">
                  {education && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">🎓</span>
                      <span>{education.degree || ''} · {education.major || ''}</span>
                    </div>
                  )}
                  {candidate.work_years != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">⏱</span>
                      <span>{typeof candidate.work_years === 'number' ? (candidate.work_years === 0 ? '应届生' : `${candidate.work_years}年经验`) : candidate.work_years}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              {candidateJob && (
                <div className="text-gray-500">
                  <span>匹配岗位：</span>
                  <span className="font-medium text-[#1C1E3A]">{candidateJob.title}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-4 justify-end">
                {skills && skills.slice(0, 4).map((skill: any, idx: number) => (
                  <span key={idx} className="px-4 py-1.5 bg-white text-[#1C1E3A] text-sm rounded-xl border border-gray-200">
                    {typeof skill === 'string' ? skill : skill.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-white to-[#F8FFFD] rounded-3xl p-7 shadow-sm border border-[#E0F3F0]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#E8F5F3] rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-[#4AB5A9]" />
              </div>
              <h2 className="text-xl font-semibold text-[#1C1E3A]">AI 智能解析摘要</h2>
            </div>
            
            <div className="space-y-4">
              {analysis?.summary?.core_value && (
                <div>
                  <p className="text-sm font-medium text-[#1C1E3A] mb-2">核心业务价值</p>
                  <p className="text-gray-600 leading-relaxed">{analysis.summary.core_value}</p>
                </div>
              )}
              {analysis?.summary?.top_achievement && (
                <div>
                  <p className="text-sm font-medium text-[#1C1E3A] mb-2">最高成就体现</p>
                  <p className="text-gray-600 leading-relaxed">{analysis.summary.top_achievement}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-[#FFF8F8] rounded-3xl p-7 shadow-sm border border-[#F5D8D8]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#FFF0F0] rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
              </div>
              <h2 className="text-xl font-semibold text-[#1C1E3A]">风险与水分预警</h2>
            </div>
            
            {(() => {
              const severeRisks = Array.isArray(analysis?.risk_warnings?.severe_risks) ? analysis.risk_warnings.severe_risks : []
              const minorRisks = Array.isArray(analysis?.risk_warnings?.minor_risks) ? analysis.risk_warnings.minor_risks : []
              const allRisks = [...severeRisks, ...minorRisks]

              const getSeverityStyle = (severity: string) => {
                const s = (severity || '').toLowerCase()
                if (s === 'high') return { border: 'border-[#EF4444]', bg: 'bg-[#FFF0F0]', text: 'text-[#EF4444]', icon: '🔴', label: 'High' }
                if (s === 'medium') return { border: 'border-[#F59E0B]', bg: 'bg-[#FFF8E6]', text: 'text-[#F59E0B]', icon: '🟠', label: 'Medium' }
                if (s === 'low') return { border: 'border-[#4AB5A9]', bg: 'bg-[#E8F5F3]', text: 'text-[#4AB5A9]', icon: '🟢', label: 'Low' }
                return { border: 'border-gray-300', bg: 'bg-gray-50', text: 'text-gray-600', icon: '⚠️', label: severity || 'Info' }
              }

              if (allRisks.length === 0) {
                return (
                  <div className="bg-white rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 w-5 h-5 text-green-500">✅</div>
                      <div>
                        <p className="font-semibold text-green-700">无风险</p>
                        <p className="text-gray-600 text-sm">AI交叉验证未发现风险问题。</p>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div className="space-y-3">
                  {severeRisks.map((flag: any, idx: number) => {
                    const style = getSeverityStyle(flag.severity || 'high')
                    return (
                      <div key={`severe-${idx}`} className={`bg-white rounded-xl p-4 border-l-4 ${style.border} shadow-sm`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-5 h-5 text-center">{style.icon}</span>
                          <p className={`font-semibold ${style.text}`}>{flag.type}</p>
                          <span className={`px-2 py-0.5 ${style.bg} ${style.text} text-xs font-medium rounded-lg`}>{style.label}</span>
                        </div>
                        <p className="text-gray-600">{flag.detail}</p>
                      </div>
                    )
                  })}
                  {minorRisks.map((flag: any, idx: number) => {
                    const style = getSeverityStyle(flag.severity)
                    return (
                      <div key={`minor-${idx}`} className={`bg-white rounded-xl p-4 border-l-4 ${style.border} shadow-sm`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-5 h-5 text-center">{style.icon}</span>
                          <p className={`font-semibold ${style.text}`}>{flag.type}</p>
                          <span className={`px-2 py-0.5 ${style.bg} ${style.text} text-xs font-medium rounded-lg`}>{style.label}</span>
                        </div>
                        <p className="text-gray-600">{flag.detail}</p>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-7 shadow-sm">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <Play className="w-5 h-5 text-[#1C1E3A]" />
            </div>
            <h2 className="text-xl font-semibold text-[#1C1E3A]">HR 专业技术翻译官</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {analysis?.tech_translation && Array.isArray(analysis.tech_translation) && analysis.tech_translation.length > 0 ? (
              analysis.tech_translation.slice(0, 2).map((item: any, idx: number) => (
                <div key={idx} className="bg-gray-50 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold text-[#4AB5A9] text-base">{item.original}</span>
                    <span className="px-2.5 py-1 bg-white text-gray-600 text-xs rounded-lg border border-gray-200">{item.level}</span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">{item.plain_explanation}</p>
                </div>
              ))
            ) : (
              <div className="col-span-2 bg-gray-50 rounded-2xl p-6 text-center text-gray-500">
                暂无技术术语数据
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-7 shadow-sm">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-[#1C1E3A]" />
            </div>
            <h2 className="text-xl font-semibold text-[#1C1E3A]">技能匹配度雷达</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
            {analysis?.skill_match && Array.isArray(analysis.skill_match) && analysis.skill_match.length > 0 ? (
              analysis.skill_match.map((item: any, idx: number) => {
                const score = item.match_level || 0
                const scoreColor = score >= 80 ? '#4AB5A9' : score >= 60 ? '#F59E0B' : '#EF4444'
                const commentColor = score >= 60 ? 'text-yellow-600' : 'text-red-600'
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-[#1C1E3A]">{item.skill_name}</span>
                      <span className="text-xl font-bold" style={{ color: scoreColor }}>{score}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${score}%`,
                          backgroundColor: scoreColor
                        }}
                      />
                    </div>
                    <p className="text-sm text-[#4AB5A9]">岗位要求：{item.job_requirement}</p>
                    {item.match_comment && (
                      <p className={`text-sm mt-1 ${commentColor}`}>{item.match_comment}</p>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="col-span-2 text-center text-gray-500 py-8">
                暂无技能匹配数据
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 py-4">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="px-8 py-3 bg-white text-gray-700 font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
            重新生成
          </button>
          <button
            onClick={handleGenerateInterview}
            className="px-8 py-3 bg-white text-[#4AB5A9] font-medium rounded-xl border border-[#4AB5A9] hover:bg-[#E8F5F3] transition-colors"
          >
            进入面试辅助出题页
          </button>
          <button
            onClick={() => router.push('/candidates')}
            className="px-8 py-3 bg-[#4AB5A9] text-white font-medium rounded-xl hover:bg-[#3d9a8e] transition-colors"
          >
            返回候选列表
          </button>
        </div>
      </div>
    </div>
  )
}
