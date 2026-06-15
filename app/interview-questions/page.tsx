'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Upload, FileText, Sparkles, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useJobs } from '@/hooks/use-jobs'

export default function InterviewQuestionsPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const { jobs, loading } = useJobs(profile?.company_id)
  const [selectedJobId, setSelectedJobId] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [progressStep, setProgressStep] = useState('等待生成')
  const [mounted, setMounted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const selectedJob = jobs.find(job => job.id === selectedJobId)

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

  const handleUploadClick = () => {
    if (!loading && jobs.length === 0) {
      showToastMessage('请先前往设置页面添加岗位', 'error')
      return
    }
    fileInputRef.current?.click()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!loading && jobs.length === 0) {
      showToastMessage('请先前往设置页面添加岗位', 'error')
      return
    }
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileSelect = (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      showToastMessage('文件大小不能超过 20MB', 'error')
      return
    }
    const validTypes = ['.pdf', '.docx', '.jpg', '.jpeg', '.png']
    const fileName = file.name.toLowerCase()
    const isValid = validTypes.some(ext => fileName.endsWith(ext))
    if (!isValid) {
      showToastMessage('仅支持 PDF、Word、图片格式', 'error')
      return
    }
    setUploadedFile(file)
  }

  const handleGenerateInterview = async () => {
    if (!selectedJobId) {
      showToastMessage('请先选择一个岗位', 'error')
      return
    }
    if (!uploadedFile) {
      showToastMessage('请先上传简历', 'error')
      return
    }

    setProcessing(true)
    setProgressStep('正在处理简历...')
    try {
      const formData = new FormData()
      formData.append('file', uploadedFile)
      formData.append('jobId', selectedJobId)
      formData.append('companyId', profile?.company_id || '')
      formData.append('jdText', selectedJob?.jd_text || '')

      const uploadRes = await fetch('/api/upload-candidate', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok || !uploadRes.body) {
        const errText = await uploadRes.text()
        throw new Error(errText || '上传失败')
      }

      const reader = uploadRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let success = false
      let candidate: any = null

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
              const stepId = data.stepId
              const stepMap: Record<number, string> = {
                1: '正在读取简历文件...',
                2: '正在解析简历内容...',
                3: 'AI 正在分析简历信息...',
                4: 'AI 正在对比岗位要求...',
                5: '正在保存匹配结果...'
              }
              if (data.status === 'start') {
                setProgressStep(stepMap[stepId] || '正在处理...')
              }
            } else if (data.type === 'done') {
              success = true
              candidate = data.data.candidate
            } else if (data.type === 'error') {
              throw new Error(data.message || '解析失败')
            }
          } catch (e) {
            console.error('解析 SSE 数据失败:', e)
          }
        }
      }

      if (!success || !candidate) {
        throw new Error('简历处理失败，未返回候选人数据')
      }

      setProgressStep('正在生成面试题库...')
      console.log('候选人创建成功:', candidate.id)

      const interviewRes = await fetch('/api/generate-interview-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidate.id,
          job_id: selectedJobId,
          job_description: selectedJob?.jd_text || '',
        })
      })

      const interviewData = await interviewRes.json()
      if (!interviewData.success) {
        throw new Error(interviewData.error || '生成面试题失败')
      }

      showToastMessage('面试题生成完成，正在跳转...', 'success')
      setTimeout(() => {
        router.push(`/candidates/${candidate.id}/interview`)
      }, 800)

    } catch (error: any) {
      console.error('面试辅助流程失败:', error)
      showToastMessage('失败: ' + (error.message || '未知错误'), 'error')
    } finally {
      setProcessing(false)
      setProgressStep('等待生成')
    }
  }

  useEffect(() => {
    if (!loading && jobs.length > 0 && !selectedJobId) {
      setSelectedJobId(jobs[0].id)
    }
  }, [jobs, loading, selectedJobId])

  const loadingOverlay = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="bg-white rounded-2xl p-6 shadow-2xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4AB5A9] mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">{progressStep}</p>
          <p className="text-sm text-gray-500 mt-1">请稍候，处理中勿操作</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {processing && mounted && (
        typeof document !== 'undefined'
          ? createPortal(loadingOverlay, document.body)
          : loadingOverlay
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1E3A]">面试辅助出题</h1>
          <p className="text-gray-500 mt-1">为你生成定制化面试题目及参考答案</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">上传简历 <span className="text-red-500">*</span></label>
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-[#4AB5A9] transition-colors cursor-pointer"
            onClick={handleUploadClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="w-12 h-12 mx-auto mb-3 bg-[#E8F5F3] rounded-xl flex items-center justify-center">
              {uploadedFile ? (
                <FileText className="w-6 h-6 text-[#4AB5A9]" />
              ) : (
                <Upload className="w-6 h-6 text-[#4AB5A9]" />
              )}
            </div>
            <p className="text-gray-700 font-medium">
              {uploadedFile ? (
                <span className="text-[#4AB5A9]">{uploadedFile.name}</span>
              ) : (
                '点击上传或拖拽文件到此处'
              )}
            </p>
            <p className="text-gray-400 text-sm mt-1">支持 PDF、Word、图片格式，文件大小不超过20MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              const files = e.target.files
              if (files && files.length > 0) {
                handleFileSelect(files[0])
              }
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">岗位 <span className="text-red-500">*</span></label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#4AB5A9] focus:border-transparent"
              disabled={loading || jobs.length === 0}
            >
              {jobs.length === 0 ? (
                <option value="">暂无岗位</option>
              ) : (
                <>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>

        <button
          onClick={handleGenerateInterview}
          disabled={!selectedJobId || processing || !uploadedFile}
          className="w-full py-4 bg-[#4AB5A9] text-white font-medium rounded-xl hover:bg-[#3d9a8e] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? (
            <>
              <span>正在生成，请稍候...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              开始面试辅助出题
            </>
          )}
        </button>
      </div>

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
    </div>
  )
}
