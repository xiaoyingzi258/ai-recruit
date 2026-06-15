'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { ChevronDown, ChevronRight, Star, AlertTriangle, RefreshCw, Download, AlertCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'

const supabase = createClient()

type TabType = 'fraud' | 'tech' | 'soft'

const tabConfig = [
  { key: 'fraud' as const, label: '简历水分深挖', color: 'text-red-600', borderColor: 'border-red-500', bgColor: 'bg-red-500' },
  { key: 'tech' as const, label: '专业技术考察', color: 'text-blue-600', borderColor: 'border-blue-500', bgColor: 'bg-blue-500' },
  { key: 'soft' as const, label: '综合素质评估', color: 'text-yellow-600', borderColor: 'border-yellow-500', bgColor: 'bg-yellow-500' },
]

const difficultyBadge: Record<string, { label: string; className: string }> = {
  junior: { label: '初级', className: 'bg-gray-100 text-gray-600 rounded' },
  senior: { label: '高级', className: 'bg-blue-100 text-blue-600 rounded' },
  expert: { label: '专家', className: 'bg-purple-100 text-purple-600 rounded' },
}

type Candidate = {
  id: string
  name: string
  parsed_data?: any
  job_id: string | null
}

type InterviewQuestions = {
  id: string
  fraud_questions?: any
  tech_questions?: any
  soft_questions?: any
}

type Job = {
  id: string
  title: string
  jd_text: string
}

export default function InterviewPage() {
  const params = useParams()
  const { profile } = useAuth()
  const candidateId = params.id as string
  
  const [activeTab, setActiveTab] = useState<TabType>('fraud')
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [candidateJob, setCandidateJob] = useState<Job | null>(null)
  const [questions, setQuestions] = useState<InterviewQuestions | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showToast, setShowToast] = useState(false)
  const questionsRequestedRef = useRef(false)

  const showToastMessage = (message: string, type: 'success' | 'error' | 'info') => {
    setToast(null)
    setShowToast(false)
    setTimeout(() => {
      setToast({ message, type })
      setShowToast(true)
      setTimeout(() => {
        setShowToast(false)
        setTimeout(() => setToast(null), 300)
      }, 3000)
    }, 50)
  }

  useEffect(() => {
    if (candidateId && profile) {
      loadInterviewData()
    }
  }, [candidateId, profile])

  const loadInterviewData = async () => {
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

      // 根据候选人记录的 job_id 加载独立的岗位信息
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

      const { data: questionsRows } = await supabase
        .from('interview_questions')
        .select('*')
        .eq('candidate_id', candidateId)
        .limit(1)

      if (questionsRows && questionsRows.length > 0) {
        const questionsData = questionsRows[0]
        setQuestions(questionsData)
      } else if (!questionsRequestedRef.current) {
        questionsRequestedRef.current = true
        await generateInterviewQuestions(candidateData, false, jobData)
      }

    } catch (error) {
      console.error('加载面试数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateInterviewQuestions = async (candidateData: Candidate, isRegenerate: boolean = false, jobData?: Job | null) => {
    const activeJob = jobData || candidateJob
    if (!activeJob || !profile?.company_id) {
      setErrorMsg('请先选择一个岗位')
      return
    }

    setGenerating(true)
    setErrorMsg(null)

    try {
      const response = await fetch('/api/generate-interview-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidateId,
          job_id: activeJob.id,
          job_description: activeJob.jd_text,
          force: isRegenerate
        })
      })

      const result = await response.json()

      if (result.success) {
        setQuestions(result.data)
        setErrorMsg(null)
      } else {
        const detail = result.detail ? ' | 详情: ' + JSON.stringify(result.detail).slice(0, 200) : ''
        setErrorMsg('生成失败: ' + result.error + detail)
      }

    } catch (error) {
      console.error('生成面试题库失败:', error)
      setErrorMsg('网络错误: ' + (error as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleRegenerate = async () => {
    if (candidate) {
      await generateInterviewQuestions(candidate, true)
    }
  }

  const getCardLeftBorder = (tab: TabType) => {
    switch (tab) {
      case 'fraud': return 'border-l-[3px] border-l-red-500'
      case 'tech': return 'border-l-[3px] border-l-blue-500'
      case 'soft': return 'border-l-[3px] border-l-yellow-500'
    }
  }

  if (loading || generating) {
    return (
      <div>
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4AB5A9] mx-auto mb-4"></div>
              <p className="text-gray-700 font-medium">
                {generating ? '正在生成面试题库...' : '加载中...'}
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

  const fraudQuestions = questions?.fraud_questions || []
  const techQuestions = questions?.tech_questions || []
  const softQuestions = questions?.soft_questions || []
  const totalCount = fraudQuestions.length + techQuestions.length + softQuestions.length

  const handleExportPDF = () => {
    showToastMessage('导出PDF功能开发中', 'info')
  }

  return (
    <div className="space-y-5">
      {/* 顶部标题区 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1C1E3A]">
            定制化面试提问引导单 ({candidate.name})
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            基于 AI 单体解析结果动态生成，包含分层打分标尺，统一企业面试评价标准。
          </p>
        </div>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#4AB5A9] text-white rounded-lg hover:bg-[#3d9a8e] hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          导出 PDF 面试单
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="text-red-500 text-sm font-bold">⚠️ 错误</div>
            <div className="flex-1">
              <p className="text-sm text-red-700 break-all">{errorMsg}</p>
              <p className="text-xs text-red-500 mt-2">请查看服务器控制台获取详细调试日志</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 栏 */}
      <div className="flex items-center gap-3">
        {tabConfig.map((tab) => {
          const count = tab.key === 'fraud' ? fraudQuestions.length : tab.key === 'tech' ? techQuestions.length : softQuestions.length
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? `bg-white shadow-sm ${tab.color} border border-gray-200`
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <span>{tab.label}({count})</span>
              {isActive && (
                <div className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full ${tab.bgColor}`}></div>
              )}
            </button>
          )
        })}
      </div>

      {/* 题目卡片区域 */}
      <div className="space-y-4">
        {/* 简历水分深挖 */}
        {activeTab === 'fraud' && (fraudQuestions.length > 0 ? (
          fraudQuestions.map((q: any, idx: number) => {
            const cardId = `fraud-${idx}`
            const isExpanded = expandedCards[cardId]
            return (
              <div key={cardId} className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${getCardLeftBorder('fraud')}`}>
                <div className="p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-base font-bold text-red-500 shrink-0">Q{idx + 1}</span>
                    <p className="text-base font-semibold text-[#1C1E3A] leading-relaxed">{q.question}</p>
                  </div>

                  {/* 锚定简历原文 */}
                  {q.anchor && (
                    <div className="mb-4 border-l-[3px] border-l-red-400 bg-gray-50 rounded-r-lg px-4 py-3">
                      <div className="text-xs text-red-500 font-bold mb-1">📌 锚点</div>
                      <p className="text-sm text-gray-600">{q.anchor}</p>
                    </div>
                  )}

                  {/* AI追问建议 */}
                  {q.follow_up && (
                    <div className="mb-4 border-l-[3px] border-l-blue-400 bg-blue-50 rounded-r-lg px-4 py-3">
                      <div className="text-xs text-blue-500 font-bold mb-1">💡 AI追问建议</div>
                      <p className="text-sm text-gray-600 italic">{q.follow_up}</p>
                    </div>
                  )}

                  {/* 折叠区 */}
                  <button
                    onClick={() => toggleCard(cardId)}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#4AB5A9] transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span>{isExpanded ? '收起 ▼' : '查看AI参考答案与评判标尺 ▶'}</span>
                  </button>
                  {isExpanded && (
                    <div className="mt-4 bg-gray-50 rounded-lg p-4 space-y-4">
                      {q.excellent_benchmark && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Star className="w-4 h-4 text-green-500 fill-green-500" />
                            <span className="text-sm font-medium text-green-600">高分表现</span>
                          </div>
                          <p className="text-sm text-gray-700">{q.excellent_benchmark}</p>
                        </div>
                      )}
                      {q.pitfall_warning && (
                        <div className="border-t border-gray-200 pt-4">
                          <div className="flex items-center gap-1.5 mb-1">
                            <AlertTriangle className="w-4 h-4 text-orange-500 fill-orange-500" />
                            <span className="text-sm font-medium text-orange-600">避坑预警</span>
                          </div>
                          <p className="text-sm text-gray-700">{q.pitfall_warning}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
            <p className="text-gray-500">暂无简历水分深挖题目</p>
          </div>
        ))}

        {/* 专业技术考察 */}
        {activeTab === 'tech' && (techQuestions.length > 0 ? (
          techQuestions.map((q: any, idx: number) => {
            const cardId = `tech-${idx}`
            const isExpanded = expandedCards[cardId]
            const badge = q.difficulty ? (difficultyBadge[q.difficulty] || difficultyBadge.junior) : difficultyBadge.junior
            return (
              <div key={cardId} className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${getCardLeftBorder('tech')}`}>
                <div className="p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-base font-bold text-blue-500 shrink-0">Q{idx + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-base font-semibold text-[#1C1E3A] leading-relaxed flex-1">{q.question}</p>
                        <span className={`px-2 py-0.5 text-xs rounded font-medium shrink-0 ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI追问建议 */}
                  {q.follow_up && (
                    <div className="mb-4 border-l-[3px] border-l-blue-400 bg-blue-50 rounded-r-lg px-4 py-3">
                      <div className="text-xs text-blue-500 font-bold mb-1">💡 AI追问建议</div>
                      <p className="text-sm text-gray-600 italic">{q.follow_up}</p>
                    </div>
                  )}

                  {/* 折叠区 */}
                  <button
                    onClick={() => toggleCard(cardId)}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#4AB5A9] transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span>{isExpanded ? '收起 ▼' : '查看AI参考答案与评判标尺 ▶'}</span>
                  </button>
                  {isExpanded && (
                    <div className="mt-4 bg-gray-50 rounded-lg p-4 space-y-4">
                      {q.full_score_benchmark && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Star className="w-4 h-4 text-green-500 fill-green-500" />
                            <span className="text-sm font-medium text-green-600">满分标杆</span>
                          </div>
                          <p className="text-sm text-gray-700">{q.full_score_benchmark}</p>
                        </div>
                      )}
                      {q.pass_level && (
                        <div className="border-t border-gray-200 pt-4">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center">
                              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                            </div>
                            <span className="text-sm font-medium text-gray-600">合格水平</span>
                          </div>
                          <p className="text-sm text-gray-700">{q.pass_level}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
            <p className="text-gray-500">暂无专业技术考察题目</p>
          </div>
        ))}

        {/* 综合素质评估 */}
        {activeTab === 'soft' && (softQuestions.length > 0 ? (
          softQuestions.map((q: any, idx: number) => {
            const cardId = `soft-${idx}`
            const isExpanded = expandedCards[cardId]
            return (
              <div key={cardId} className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${getCardLeftBorder('soft')}`}>
                <div className="p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-base font-bold text-yellow-500 shrink-0">Q{idx + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-base font-semibold text-[#1C1E3A] leading-relaxed flex-1">{q.question}</p>
                        {q.assess_dimension && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded font-medium shrink-0">
                            {q.assess_dimension}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* AI追问建议 */}
                  {q.follow_up && (
                    <div className="mb-4 border-l-[3px] border-l-blue-400 bg-blue-50 rounded-r-lg px-4 py-3">
                      <div className="text-xs text-blue-500 font-bold mb-1">💡 AI追问建议</div>
                      <p className="text-sm text-gray-600 italic">{q.follow_up}</p>
                    </div>
                  )}

                  {/* 折叠区 */}
                  <button
                    onClick={() => toggleCard(cardId)}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#4AB5A9] transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <span>{isExpanded ? '收起 ▼' : '查看AI参考答案与评判标尺 ▶'}</span>
                  </button>
                  {isExpanded && (
                    <div className="mt-4 bg-gray-50 rounded-lg p-4 space-y-4">
                      {q.excellent_benchmark && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Star className="w-4 h-4 text-green-500 fill-green-500" />
                            <span className="text-sm font-medium text-green-600">满分标杆</span>
                          </div>
                          <p className="text-sm text-gray-700">{q.excellent_benchmark}</p>
                        </div>
                      )}
                      {q.pitfall_warning && (
                        <div className="border-t border-gray-200 pt-4">
                          <div className="flex items-center gap-1.5 mb-1">
                            <AlertTriangle className="w-4 h-4 text-orange-500 fill-orange-500" />
                            <span className="text-sm font-medium text-orange-600">避坑预警</span>
                          </div>
                          <p className="text-sm text-gray-700">{q.pitfall_warning}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
            <p className="text-gray-500">暂无综合素质评估题目</p>
          </div>
        ))}
      </div>

      {/* 底部操作栏 */}
      <div className="bg-white rounded-2xl px-6 py-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            共{totalCount}题统计：水分深挖{fraudQuestions.length}题 <span className="text-gray-300">|</span> 技术考察{techQuestions.length}题 <span className="text-gray-300">|</span> 综合评估{softQuestions.length}题
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRegenerate}
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? '生成中...' : '重新生成'}
            </button>
          </div>
        </div>
      </div>

      {/* Toast 提示 */}
      {toast && (
        <div
          className={`fixed top-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-xl border transition-all duration-300 ease-out ${showToast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8 pointer-events-none'}`}
          style={{
            backgroundColor: toast.type === 'success' ? '#f0fdf4' : toast.type === 'error' ? '#fef2f2' : '#eff6ff',
            borderColor: toast.type === 'success' ? '#86efac' : toast.type === 'error' ? '#fca5a5' : '#93c5fd'
          }}
        >
          {toast.type === 'info' && <AlertCircle className="w-6 h-6 text-blue-500 shrink-0" />}
          {toast.type === 'success' && <AlertCircle className="w-6 h-6 text-green-500 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />}
          <span className="text-base text-gray-700 flex-1 break-all">{toast.message}</span>
          <button onClick={() => {
            setShowToast(false)
            setTimeout(() => setToast(null), 300)
          }} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}
