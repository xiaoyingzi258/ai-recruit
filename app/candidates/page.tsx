'use client'

import { useState, useEffect, Fragment, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Upload, Users, Sparkles, Trash2, Eye, ChevronLeft, ChevronRight, RefreshCw, Loader2, CheckCircle, XCircle, AlertCircle, X, Archive } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useJobs } from '@/hooks/use-jobs'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

const skillColors = [
  'bg-blue-100 text-blue-600',
  'bg-green-100 text-green-600',
  'bg-purple-100 text-purple-600',
  'bg-orange-100 text-orange-600',
  'bg-pink-100 text-pink-600',
  'bg-cyan-100 text-cyan-600',
  'bg-indigo-100 text-indigo-600',
  'bg-yellow-100 text-yellow-600',
]

const getSkillColor = (index: number) => skillColors[index % skillColors.length]

const truncateText = (text: any, maxLen: number = 8) => {
  if (!text) return ''
  const textStr = String(text)
  if (textStr.length <= maxLen) return textStr
  return textStr.slice(0, maxLen) + '...'
}

const formatEducation = (education: any) => {
  if (!education) return '-'
  if (typeof education === 'string') return education
  if (Array.isArray(education) && education.length > 0) {
    const edu = education[0]
    const degree = edu.degree || edu.degree_name || ''
    const school = edu.school || edu.school_name || edu.university || ''
    if (degree && school) return `${degree} · ${school}`
    if (degree) return degree
    if (school) return school
  }
  if (typeof education === 'object') {
    const degree = education.degree || education.degree_name || ''
    const school = education.school || education.school_name || education.university || ''
    if (degree && school) return `${degree} · ${school}`
    if (degree) return degree
    if (school) return school
  }
  return '-'
}

type CandidateWithMatch = {
  id: string
  name: string
  experience_years?: number
  current_company?: string
  risk_tag?: string
  expected_min_salary?: number
  expected_max_salary?: number
  status: 'shortlisted' | 'removed'
  parsed_data?: any
  match_score?: number
}

type Job = {
  id: string
  title: string
  jd_text: string
}

export default function CandidatesPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const { jobs, loading: jobsLoading } = useJobs(profile?.company_id)
  const [selectedJobId, setSelectedJobId] = useState('')
  const selectedJob = jobs.find(job => job.id === selectedJobId)
  const [activeTab, setActiveTab] = useState<'high' | 'removed'>('high')
  const [searchName, setSearchName] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [uploading, setUploading] = useState(false)
  const [uploadStep, setUploadStep] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadSteps, setUploadSteps] = useState<{ id: number; title: string; description: string; status: 'pending' | 'active' | 'done' }[]>([])
  const [ellipsisCount, setEllipsisCount] = useState(0)
  const [candidates, setCandidates] = useState<CandidateWithMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [rematching, setRematching] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<number | null>(null)
  const ellipsisTimerRef = useRef<number | null>(null)

  const showToastMessage = (message: string, type: 'success' | 'error' | 'info') => {
    // 先清空之前的toast
    setToast(null)
    setShowToast(false)
    // 短暂延迟后显示新的toast
    setTimeout(() => {
      setToast({ message, type })
      setShowToast(true)
      // 3秒后自动关闭
      setTimeout(() => {
        setShowToast(false)
        setTimeout(() => setToast(null), 300)
      }, 3000)
    }, 50)
  }

  const handleUploadClick = () => {
    if (!selectedJobId) {
      showToastMessage('请先前往设置页面添加岗位', 'error')
      return
    }
    fileInputRef.current?.click()
  }

  // 默认的岗位描述（用于测试）
  const defaultJobDescription = `Java高级开发工程师
岗位职责：
1. 负责公司核心业务系统的设计与开发
2. 参与系统架构设计，优化系统性能
3. 负责代码质量保证与技术文档编写

任职要求：
1. 本科及以上学历，计算机相关专业
2. 3年以上Java开发经验
3. 精通Spring Boot、Spring Cloud等微服务框架
4. 熟悉MySQL、Redis等数据库
5. 有高并发系统开发经验者优先`

  // 加载数据
  useEffect(() => {
    if (!jobsLoading && jobs.length > 0 && !selectedJobId) {
      setSelectedJobId(jobs[0].id)
    }
  }, [jobs, jobsLoading, selectedJobId])

  useEffect(() => {
    loadData()
  }, [profile, selectedJobId])

  const loadData = async () => {
    try {
      setLoading(true)

      if (!profile?.company_id || !selectedJob) {
        setCandidates([])
        return
      }

      const res = await fetch(`/api/candidates?company_id=${profile.company_id}&job_id=${selectedJob.id}`)
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || '加载候选人失败')
      }
      const result = await res.json()
      if (!result.success) {
        throw new Error(result.error || '加载候选人失败')
      }
      const candidatesData = result.data || []

      if (!candidatesData || candidatesData.length === 0) {
        setCandidates([])
        return
      }

      const mapped: CandidateWithMatch[] = candidatesData.map((c: any) => ({
        id: c.id,
        name: c.name,
        experience_years: c.experience_years,
        current_company: c.current_company,
        risk_tag: c.risk_tag,
        expected_min_salary: c.expected_min_salary,
        expected_max_salary: c.expected_max_salary,
        status: c.status,
        parsed_data: c.parsed_data,
        match_score: c.match_score
      }))

      setCandidates(mapped)
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!file) return
    if (!selectedJob) {
      showToastMessage('请先前往设置页面添加岗位', 'error')
      return
    }
    if (!profile?.company_id) {
      showToastMessage('未获取到公司信息，请确保您已正确登录', 'error')
      return
    }
    if (!selectedJob.jd_text) {
      showToastMessage('岗位描述为空，请先编辑岗位', 'info')
      return
    }

    const initialSteps = [
      { id: 1, title: '提取并结构化简历文档', description: '正在解析 PDF 并清洗文本内容', status: 'pending' as const },
      { id: 2, title: 'AI 大模型深度解析履历', description: '调用大语言模型提取关键特征', status: 'pending' as const },
      { id: 3, title: '构建候选人高维特征向量', description: '生成 2048 维度的能力图谱', status: 'pending' as const },
      { id: 4, title: '三层打分引擎智能匹配中', description: '规则校验 + 向量对比 + LLM 深度推理', status: 'pending' as const },
      { id: 5, title: '生成人才画像并安全入库', description: '完成评估，正在保存最终报告', status: 'pending' as const },
    ]

    setUploading(true)
    setShowUploadModal(true)
    setUploadSteps(initialSteps.map(s => ({ ...s, status: 'pending' as const })))
    setUploadStep('')
    setEllipsisCount(0)

    const clearTimers = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (ellipsisTimerRef.current) {
        clearInterval(ellipsisTimerRef.current)
        ellipsisTimerRef.current = null
      }
    }

    const advanceStep = (stepId: number) => {
      setUploadSteps(prev => prev.map(s => {
        if (s.id === stepId) {
          return { ...s, status: 'active' as const }
        }
        if (s.id < stepId) {
          return { ...s, status: 'done' as const }
        }
        return s
      }))
    }

    advanceStep(1)

    let stepIndex = 1
    const scheduleNextStep = () => {
      if (stepIndex >= 4) return

      let delay = 0
      if (stepIndex === 1) delay = 1000
      else if (stepIndex === 2) delay = 4000
      else if (stepIndex === 3) delay = 3000

      stepIndex++
      timerRef.current = window.setTimeout(() => {
        advanceStep(stepIndex)

        if (stepIndex === 4) {
          ellipsisTimerRef.current = window.setInterval(() => {
            setEllipsisCount(prev => (prev + 1) % 4)
          }, 500)
        } else {
          scheduleNextStep()
        }
      }, delay)
    }

    scheduleNextStep()

    try {
      const fileName = file.name.toLowerCase()

      if (!fileName.endsWith('.docx') && !fileName.endsWith('.pdf')) {
        clearTimers()
        showToastMessage('只支持 .docx 和 .pdf 格式的简历', 'error')
        return
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('jobId', selectedJob.id)
      formData.append('companyId', profile.company_id)
      formData.append('jdText', selectedJob.jd_text)

      const uploadRes = await fetch('/api/upload-candidate', {
        method: 'POST',
        body: formData
      })

      if (!uploadRes.ok || !uploadRes.body) {
        const errText = await uploadRes.text()
        throw new Error(errText || '上传失败')
      }

      const reader = uploadRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let success = false
      let errorMsg = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const dataStr = line.slice(5).trim()
          if (!dataStr) continue

          try {
            const data = JSON.parse(dataStr)

            if (data.type === 'progress') {
              if (data.stepId === 5 && data.status === 'start') {
                clearTimers()
                setUploadSteps(prev => prev.map(s => {
                  if (s.id <= 4) {
                    return { ...s, status: 'done' as const }
                  }
                  if (s.id === 5) {
                    return { ...s, status: 'active' as const }
                  }
                  return s
                }))
              }
            } else if (data.type === 'done') {
              success = true
              setUploadSteps(prev => prev.map(s => ({ ...s, status: 'done' as const })))
            } else if (data.type === 'error') {
              errorMsg = data.message
            }
          } catch (e) {
            console.error('解析流式数据失败:', e)
          }
        }
      }

      if (success) {
        await new Promise(resolve => setTimeout(resolve, 500))
        showToastMessage('简历解析并匹配完成！', 'success')
        await loadData()
      } else {
        throw new Error(errorMsg || '处理失败')
      }

    } catch (error) {
      clearTimers()
      console.error('[候选人页面] 上传错误:', error)
      showToastMessage('解析失败，请重试', 'error')
      setUploadSteps(prev => prev.map(s => ({ ...s, status: 'pending' as const })))
    } finally {
      setTimeout(() => {
        clearTimers()
        setUploading(false)
        setUploadStep('')
        setShowUploadModal(false)
      }, 800)
    }
  }

  const handleBatchImport = () => {
    if (!selectedJob) {
      showToastMessage('请先前往设置页面添加岗位', 'error')
      return
    }
    showToastMessage('批量导入功能开发中', 'info')
  }

  const handleRematch = async (candidateId: string) => {
    if (!selectedJob) {
      showToastMessage('请先选择岗位', 'info')
      return
    }

    setRematching(candidateId)

    try {
      const jobDescription = selectedJob.jd_text || defaultJobDescription

      const response = await fetch('/api/rematch-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidateId,
          job_description: jobDescription
        })
      })

      const result = await response.json()

      if (!result.success) {
        showToastMessage('重新匹配失败: ' + result.error, 'error')
        return
      }

      showToastMessage('匹配结果已重新生成！', 'success')
      await loadData()

    } catch (error) {
      console.error(error)
      showToastMessage('重新匹配失败: ' + (error as Error).message, 'error')
    } finally {
      setRematching(null)
    }
  }

  const filteredCandidates = candidates.filter(candidate => {
    const matchesName = candidate.name.toLowerCase().includes(searchName.toLowerCase())
    const matchesStatus = statusFilter === 'all' || candidate.status === statusFilter
    const matchesTab = activeTab === 'high' ? candidate.status !== 'removed' : candidate.status === 'removed'
    return matchesName && matchesStatus && matchesTab
  })

  const getMatchScoreColor = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-600'
    if (score >= 80) return 'bg-green-100 text-green-600'
    if (score >= 60) return 'bg-blue-100 text-blue-600'
    return 'bg-gray-100 text-gray-600'
  }

  const getRiskTagColor = (tag?: string) => {
    if (!tag) return 'bg-gray-100 text-gray-600'
    const lowerTag = tag.toLowerCase()
    if (lowerTag.includes('完美') || lowerTag.includes('perfect')) return 'bg-green-100 text-green-600'
    if (lowerTag.includes('高') || lowerTag.includes('high')) return 'bg-red-100 text-red-600'
    return 'bg-yellow-100 text-yellow-600'
  }

  const itemsPerPage = 10
  const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const currentCandidates = filteredCandidates.slice(startIndex, startIndex + itemsPerPage)

  const removeCandidate = async (id: string) => {
    try {
      const res = await fetch('/api/candidates/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'removed' })
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || '操作失败')
      }
      const result = await res.json()
      if (!result.success) {
        throw new Error(result.error || '操作失败')
      }
      await loadData()
      showToastMessage('候选人已移除', 'success')
    } catch (error) {
      console.error(error)
      showToastMessage('操作失败', 'error')
    }
  }

  const restoreCandidate = async (id: string) => {
    try {
      const res = await fetch('/api/candidates/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'shortlisted' })
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || '操作失败')
      }
      const result = await res.json()
      if (!result.success) {
        throw new Error(result.error || '操作失败')
      }
      await loadData()
      showToastMessage('候选人已恢复', 'success')
    } catch (error) {
      console.error(error)
      showToastMessage('操作失败', 'error')
    }
  }

  const deleteCandidate = async (id: string) => {
    try {
      const res = await fetch('/api/candidates/' + id, { method: 'DELETE' })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || '删除失败')
      }
      const result = await res.json()
      if (!result.success) {
        throw new Error(result.error || '删除失败')
      }
      await loadData()
      showToastMessage('候选人已删除', 'success')
    } catch (error) {
      console.error(error)
      showToastMessage('删除失败', 'error')
    }
  }

  return (
    <div className="relative min-h-screen">
      {(uploading || rematching !== null) && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4AB5A9] mx-auto mb-4"></div>
              <p className="text-gray-700 font-medium">
                {uploading ? '正在处理简历...' : '正在重新匹配...'}
              </p>
              <p className="text-sm text-gray-500 mt-1">请稍候，处理中勿操作</p>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div 
            className="bg-white rounded-[16px] p-8 shadow-2xl relative overflow-hidden"
            style={{ 
              width: '600px',
              maxWidth: '90vw',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)' 
            }}
          >
            <div 
              className="absolute top-0 left-0 right-0 h-1"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, #14b8a6 50%, transparent 100%)',
                animation: 'scanLine 2s linear infinite'
              }}
            />
            <style>{`
              @keyframes scanLine {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
              @keyframes pulseRing {
                0% { transform: scale(1); opacity: 1; }
                100% { transform: scale(2); opacity: 0; }
              }
              .pulse-ring {
                animation: pulseRing 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
              }
            `}</style>

            <div className="text-center mb-6 pt-2">
              <h3 className="text-xl font-bold text-[#1C1E3A] mb-2">
                AI 智能引擎解析中
              </h3>
              <p className="text-sm text-gray-400">
                正在执行深度数据分析，请勿关闭窗口...
              </p>
            </div>

            <div className="w-full h-1.5 bg-[#F0F0EE] rounded-full mb-8 overflow-hidden">
              <div 
                className="h-full bg-[#14b8a6] rounded-full transition-all duration-500 ease-in-out"
                style={{ 
                  width: `${Math.max(uploadSteps.filter(s => s.status === 'done').length * 20, uploadSteps.find(s => s.status === 'active') ? uploadSteps.filter(s => s.status === 'done').length * 20 + 5 : 0)}%` 
                }}
              />
            </div>

            <div className="space-y-3">
              {uploadSteps.map((step) => (
                <div
                  key={step.id}
                  className={`relative p-4 rounded-xl transition-all duration-300 ${
                    step.status === 'pending'
                      ? 'bg-[#F0F0EE]'
                      : step.status === 'active'
                      ? 'bg-white border-2 border-[#14b8a6] shadow-[0_0_20px_rgba(20,184,166,0.3)] transform scale-[1.02]'
                      : 'bg-transparent py-2'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {step.status === 'active' && (
                        <div 
                          className="absolute inset-0 rounded-full bg-[#14b8a6] pulse-ring"
                        />
                      )}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold transition-all ${
                          step.status === 'done'
                            ? 'bg-[#14b8a6] text-white'
                            : step.status === 'active'
                            ? 'bg-[#14b8a6] text-white relative z-10'
                            : 'bg-white text-gray-400 border border-gray-300'
                        }`}
                      >
                        {step.status === 'done' ? (
                          '✓'
                        ) : step.status === 'active' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          step.id
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className={`font-medium text-sm transition-all ${
                        step.status === 'done'
                          ? 'text-gray-400'
                          : step.status === 'active'
                          ? 'text-[#1C1E3A]'
                          : 'text-gray-400'
                      }`}>
                        {step.title}
                        {step.id === 4 && step.status === 'active' && '.'.repeat(ellipsisCount)}
                      </div>
                      <div className={`text-xs mt-1 transition-all duration-300 ${
                        step.status === 'active'
                          ? 'opacity-100 max-h-6 text-gray-400'
                          : 'opacity-0 max-h-0 overflow-hidden'
                      }`}>
                        {step.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div 
          className={`fixed top-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-xl border transition-all duration-300 ease-out ${showToast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8 pointer-events-none'}`}
          style={{
            backgroundColor: toast.type === 'success' ? '#f0fdf4' : toast.type === 'error' ? '#fef2f2' : '#eff6ff',
            borderColor: toast.type === 'success' ? '#86efac' : toast.type === 'error' ? '#fca5a5' : '#93c5fd'
          }}
        >
          {toast.type === 'success' && <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />}
          {toast.type === 'error' && <XCircle className="w-6 h-6 text-red-500 shrink-0" />}
          {toast.type === 'info' && <AlertCircle className="w-6 h-6 text-blue-500 shrink-0" />}
          <span className="text-base text-gray-700 flex-1 break-all">{toast.message}</span>
          <button onClick={() => {
            setShowToast(false)
            setTimeout(() => setToast(null), 300)
          }} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-[#1C1E3A] mb-2 text-center">
              确认删除
            </h3>
            <p className="text-gray-500 text-center mb-6">
              此操作将永久删除该候选人及其匹配结果，删除后无法恢复。是否确认？
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  deleteCandidate(deleteConfirmId)
                  setDeleteConfirmId(null)
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1C1E3A]">匹配候选人</h1>
            <p className="text-gray-500 mt-1">上传简历，智能匹配岗位</p>
          </div>
          <div className="flex items-center gap-3">
            {jobsLoading ? null : jobs.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-700 font-medium">匹配岗位：</span>
                <select
                  value={selectedJobId}
                  onChange={(e) => {
                    setSelectedJobId(e.target.value)
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#4AB5A9]"
                >
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-600 font-medium">请前往设置页面添加岗位</span>
              </div>
            )}
            <button 
              onClick={handleBatchImport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Users className="w-4 h-4" />
              批量导入
            </button>
            <button
              onClick={handleUploadClick}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-[#4AB5A9] text-white rounded-lg hover:bg-[#3d9a8e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              上传简历
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  handleFileUpload(file)
                }
                e.target.value = ''
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4AB5A9] bg-gray-50"
                placeholder="按姓名搜索..."
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4AB5A9] bg-gray-50"
            >
              <option value="all">全部</option>
              <option value="shortlisted">已推荐</option>
              <option value="removed">已移除</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center border-b border-gray-100">
            <button
              onClick={() => setActiveTab('high')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'high'
                  ? 'text-[#4AB5A9] border-b-2 border-[#4AB5A9]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              高潜候选名单
            </button>
            <button
              onClick={() => setActiveTab('removed')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'removed'
                  ? 'text-[#4AB5A9] border-b-2 border-[#4AB5A9]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              已移除/备选库 ({candidates.filter(c => c.status === 'removed').length})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">姓名</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">学历/经验</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">核心技能</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">AI匹配分数</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">风险雷达</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        加载中...
                      </div>
                    </td>
                  </tr>
                ) : currentCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      暂无候选人数据
                    </td>
                  </tr>
                ) : (
                  currentCandidates.map((candidate, index) => (
                    <tr key={candidate.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{candidate.name}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatEducation(candidate.parsed_data?.education)} / {candidate.experience_years !== null && candidate.experience_years !== undefined ? candidate.experience_years + '年' : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {candidate.parsed_data?.skills?.slice(0, 4).map((skill: any, i: number) => {
                            const skillName = typeof skill === 'string' ? skill : skill.name || skill.skill || skill.title || ''
                            return (
                              <span
                                key={i}
                                className={`px-2 py-1 text-xs rounded-full ${getSkillColor(startIndex + index + i)}`}
                              >
                                {truncateText(skillName)}
                              </span>
                            )
                          }) || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {candidate.match_score !== undefined ? (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getMatchScoreColor(candidate.match_score)}`}>
                            {candidate.match_score}分
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {candidate.risk_tag ? (
                          <span className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${getRiskTagColor(candidate.risk_tag)}`}>
                            {candidate.risk_tag}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => router.push(`/candidates/${candidate.id}`)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>深度解析</TooltipContent>
                          </Tooltip>
                          
                          {activeTab === 'high' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => removeCandidate(candidate.id)}
                                  className="p-2 hover:bg-orange-50 rounded-lg transition-colors text-orange-600"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>移到备选库</TooltipContent>
                            </Tooltip>
                          )}

                          {activeTab === 'removed' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => restoreCandidate(candidate.id)}
                                  className="p-2 hover:bg-green-50 rounded-lg transition-colors text-green-600"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>恢复</TooltipContent>
                            </Tooltip>
                          )}

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleRematch(candidate.id)}
                                disabled={rematching === candidate.id}
                                className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-600 disabled:opacity-50"
                              >
                                {rematching === candidate.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Sparkles className="w-4 h-4" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>重新匹配</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setDeleteConfirmId(candidate.id)}
                                className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-800"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>彻底删除</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <div className="text-sm text-gray-500">
                显示 {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredCandidates.length)} 条，共 {filteredCandidates.length} 条
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <span className="text-sm text-gray-600">
                  第 {currentPage} / {totalPages} 页
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
