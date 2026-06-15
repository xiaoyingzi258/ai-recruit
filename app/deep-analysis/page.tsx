'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Upload, FileText, Sparkles, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useJobs } from '@/hooks/use-jobs'

export default function DeepAnalysisPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const { jobs, loading } = useJobs(profile?.company_id)
  const [selectedJobId, setSelectedJobId] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [processing, setProcessing] = useState(false)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf') && !file.name.toLowerCase().endsWith('.docx')) {
        showToastMessage('仅支持 PDF 和 Word 格式文件', 'error')
        return
      }
      if (file.size > 20 * 1024 * 1024) {
        showToastMessage('文件大小不能超过 20MB', 'error')
        return
      }
      setUploadedFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (!loading && jobs.length === 0) {
      showToastMessage('请先前往设置页面添加岗位', 'error')
      return
    }
    const file = e.dataTransfer.files?.[0]
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf') && !file.name.toLowerCase().endsWith('.docx')) {
        showToastMessage('仅支持 PDF 和 Word 格式文件', 'error')
        return
      }
      if (file.size > 20 * 1024 * 1024) {
        showToastMessage('文件大小不能超过 20MB', 'error')
        return
      }
      setUploadedFile(file)
    }
  }

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation()
    setUploadedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  const handleGenerateAnalysis = async () => {
    if (!uploadedFile) {
      showToastMessage('请先上传简历文件', 'error')
      return
    }
    if (!selectedJobId) {
      showToastMessage('请先选择岗位', 'error')
      return
    }

    setProcessing(true)
    setProgressStep('正在上传简历...')

    try {
      const formData = new FormData()
      formData.append('file', uploadedFile)
      formData.append('jobId', selectedJobId)
      formData.append('companyId', profile?.company_id || '')
      formData.append('jdText', selectedJob?.jd_text || '')

      setProgressStep('正在解析简历文件...')

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

      setProgressStep('正在进行深度解析...')
      console.log('候选人创建成功:', candidate.id)

      const analyzeRes = await fetch('/api/analyze-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidate.id,
          job_id: selectedJobId,
          job_description: selectedJob?.jd_text || '',
          force: true
        })
      })

      const analyzeData = await analyzeRes.json()
      if (!analyzeData.success) {
        throw new Error(analyzeData.error || '深度解析失败')
      }

      showToastMessage('深度解析完成，正在跳转...', 'success')
      setTimeout(() => {
        router.push(`/candidates/${candidate.id}?source=deep-analysis`)
      }, 800)

    } catch (error: any) {
      console.error('深度解析流程失败:', error)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1E3A]">深度解析</h1>
          <p className="text-gray-500 mt-1">将简历内容转化为结构化分析，生成深度解析结果</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">上传简历</label>
          {!uploadedFile ? (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                dragActive
                  ? 'border-[#4AB5A9] bg-[#E8F5F3]/50'
                  : 'border-gray-200 hover:border-[#4AB5A9] hover:bg-gray-50'
              }`}
              onClick={handleUploadClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="w-12 h-12 mx-auto mb-3 bg-[#E8F5F3] rounded-xl flex items-center justify-center">
                <Upload className="w-6 h-6 text-[#4AB5A9]" />
              </div>
              <p className="text-gray-700 font-medium">点击上传或拖拽文件到此处</p>
              <p className="text-gray-400 text-sm mt-1">支持 PDF、Word 格式，文件大小不超过 20MB</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#E8F5F3] rounded-xl flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-[#4AB5A9]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#1C1E3A] truncate">{uploadedFile.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(uploadedFile.size)}</p>
                </div>
                <button
                  onClick={removeFile}
                  disabled={processing}
                  className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors shrink-0 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">岗位 <span className="text-red-500">*</span></label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#4AB5A9] focus:border-transparent"
            disabled={loading || jobs.length === 0 || processing}
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

        <button
          onClick={handleGenerateAnalysis}
          disabled={!selectedJobId || processing || !uploadedFile}
          className="w-full py-4 bg-[#4AB5A9] text-white font-medium rounded-xl hover:bg-[#3d9a8e] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? (
            <>
              <span>正在解析，请稍候...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              生成深度解析
            </>
          )}
        </button>
      </div>

      {toast && (
        <div
          className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-xl border transition-all duration-300 ease-out ${showToast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8 pointer-events-none'}`}
          style={{
            position: 'fixed',
            top: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
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

      {processing && mounted && (
        typeof document !== 'undefined'
          ? createPortal(loadingOverlay, document.body)
          : loadingOverlay
      )}
    </div>
  )
}
