'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Sparkles, AlertCircle, CheckCircle, Zap, TrendingUp, RefreshCw, GraduationCap, Clock, Building2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useJob } from '@/contexts/job-context'
import type { AnalysisSummary, AnalysisRiskWarnings, AnalysisTechTranslation, AnalysisSkillMatch } from '@/types/database'

type Candidate = {
  id: string
  name: string
  work_years?: string | number
  current_company?: string
  parsed_data?: any
  job_id: string | null
}

type Job = {
  id: string
  title: string
  jd_text: string
}

const levelColorMap: Record<string, string> = {
  '初级': 'bg-gray-100 text-gray-700',
  '中级': 'bg-blue-100 text-blue-700',
  '高级': 'bg-orange-100 text-orange-700',
  '专家': 'bg-purple-100 text-purple-700',
}

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

export default function AnalysisPage() {
  const router = useRouter()
  const params = useParams()
  const { profile } = useAuth()
  const { selectedJob } = useJob()
  const candidateId = params.id as string

  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [summary, setSummary] = useState<AnalysisSummary | null>(null)
  const [riskWarnings, setRiskWarnings] = useState<AnalysisRiskWarnings | null>(null)
  const [techTranslation, setTechTranslation] = useState<AnalysisTechTranslation>([])
  const [skillMatch, setSkillMatch] = useState<AnalysisSkillMatch>([])
  const [hasExistingAnalysis, setHasExistingAnalysis] = useState(false)

  useEffect(() => {
    if (candidateId && profile) {
      loadData()
    }
  }, [candidateId, profile])

  const loadData = async () => {
    try {
      setLoading(true)

      const candidateRes = await fetch('/api/candidates/' + candidateId)
      if (!candidateRes.ok) {
        const errText = await candidateRes.text()
        throw new Error(errText || '加载候选人失败')
      }
      const candidateResult = await candidateRes.json()
      if (!candidateResult.success || !candidateResult.data) {
        setLoading(false)
        return
      }
      const candidateData = candidateResult.data
      setCandidate(candidateData)

      const analysisRes = await fetch('/api/candidates/' + candidateId + '/analysis')
      if (analysisRes.ok) {
        const analysisResult = await analysisRes.json()
        if (analysisResult.success && analysisResult.data) {
          const existingAnalysis = analysisResult.data
          setHasExistingAnalysis(true)
          setSummary(existingAnalysis.summary)
          setRiskWarnings(existingAnalysis.risk_warnings)
          setTechTranslation(existingAnalysis.tech_translation || [])
          setSkillMatch(existingAnalysis.skill_match || [])
        }
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartAnalysis = async () => {
    const activeJob = selectedJob
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
          job_description: activeJob.jd_text,
        }),
      })

      const result = await response.json()

      if (result.success) {
        const data = result.data
        setHasExistingAnalysis(true)
        setSummary(data.summary)
        setRiskWarnings(data.risk_warnings)
        setTechTranslation(data.tech_translation || [])
        setSkillMatch(data.skill_match || [])
      } else {
        alert('深度解析失败: ' + (result.error || '未知错误'))
      }
    } catch (error) {
      console.error('深度解析失败:', error)
      alert('深度解析失败: ' + (error as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleRegenerate = async () => {
    const activeJob = selectedJob
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
          job_description: activeJob.jd_text,
          force: true,
        }),
      })

      const result = await response.json()

      if (result.success) {
        const data = result.data
        setSummary(data.summary)
        setRiskWarnings(data.risk_warnings)
        setTechTranslation(data.tech_translation || [])
        setSkillMatch(data.skill_match || [])
      } else {
        alert('重新生成失败: ' + (result.error || '未知错误'))
      }
    } catch (error) {
      console.error('重新生成失败:', error)
      alert('重新生成失败: ' + (error as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  const getLevelClass = (level: string) => {
    for (const [key, cls] of Object.entries(levelColorMap)) {
      if (level.includes(key)) return cls
    }
    return 'bg-gray-100 text-gray-700'
  }

  if (loading) {
    return (
      <div>
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4AB5A9] mx-auto mb-4"></div>
              <p className="text-gray-700 font-medium">加载中...</p>
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

  return (
    <div className="space-y-6">
      {analyzing && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4AB5A9] mx-auto mb-4"></div>
              <p className="text-gray-700 font-medium">正在进行深度解析...</p>
              <p className="text-sm text-gray-500 mt-1">请稍候，处理中勿操作</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push(`/candidates/${candidateId}`)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#1C1E3A] to-[#374151] rounded-xl flex items-center justify-center text-white text-2xl font-bold">
              {candidate.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-[#1C1E3A]">{candidate.name}</h1>
                <span className="px-2 py-0.5 bg-[#E8F5F3] text-[#4AB5A9] text-xs rounded">深度解析</span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                {education && (
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4" />
                    <span>{education.degree || ''} {education.major || ''}</span>
                  </div>
                )}
                {candidate.work_years != null && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>{typeof candidate.work_years === 'number' ? (candidate.work_years === 0 ? '应届' : `${candidate.work_years}年经验`) : candidate.work_years}</span>
                  </div>
                )}
                {candidate.current_company && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />
                    <span>当前公司：{candidate.current_company}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            {selectedJob && (
              <div className="text-sm text-gray-500 mb-1">匹配岗位：{selectedJob.title}</div>
            )}
          </div>
        </div>
      </div>

      {analyzing && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4AB5A9] mx-auto mb-4"></div>
            <p className="text-gray-600">AI 正在深度解析候选人...</p>
            <p className="text-gray-400 text-sm mt-2">这可能需要几秒钟</p>
          </div>
        </div>
      )}

      {!analyzing && !hasExistingAnalysis && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 bg-[#E8F5F3] rounded-full flex items-center justify-center mb-6">
            <Sparkles className="w-10 h-10 text-[#4AB5A9]" />
          </div>
          <h2 className="text-xl font-semibold text-[#1C1E3A] mb-2">开始深度解析</h2>
          <p className="text-gray-500 text-sm mb-8 text-center max-w-md">
            利用AI大模型对候选人简历进行深度分析，包括智能摘要、风险预警、技术翻译和技能匹配
          </p>
          <button
            onClick={handleStartAnalysis}
            className="px-8 py-3 bg-[#4AB5A9] text-white font-medium rounded-xl hover:bg-[#3d9a8e] transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            开始深度解析
          </button>
        </div>
      )}

      {!analyzing && hasExistingAnalysis && (
        <>
          <div className="flex items-center justify-end">
            <button
              onClick={handleRegenerate}
              disabled={analyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#4AB5A9] border border-[#4AB5A9] rounded-lg hover:bg-[#E8F5F3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-4 h-4" />
              重新解析
            </button>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-7 h-7 rounded-lg bg-[#E8F5F3] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#4AB5A9]" />
              </div>
              <h2 className="text-lg font-semibold text-[#1C1E3A]">AI智能解析摘要</h2>
            </div>

            {summary ? (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-[#E8F5F3] to-white rounded-xl p-5 border border-[#4AB5A9]/20">
                  <p className="text-sm text-gray-500 font-medium mb-2">核心业务价值</p>
                  <p className="text-xl font-bold text-[#1C1E3A]">{summary.core_value || '-'}</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-5">
                  <p className="text-sm text-gray-500 font-medium mb-2">最高成就体现</p>
                  <p className="text-base text-gray-700 leading-relaxed">{summary.top_achievement || '-'}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 font-medium mb-3">岗位匹配优势</p>
                  {summary.match_advantages && summary.match_advantages.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {summary.match_advantages.map((adv, idx) => (
                        <span
                          key={idx}
                          className="px-4 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-full border border-green-100"
                        >
                          {adv}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">暂无匹配优势数据</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-8 text-center">
                <p className="text-gray-400">暂无解析摘要数据</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
              <h2 className="text-lg font-semibold text-[#1C1E3A]">风险与水分预警</h2>
            </div>

            {(() => {
              const getSeverityConfig = (severity: string) => {
                const s = (severity || '').toLowerCase()
                if (s === 'high') {
                  return {
                    containerBg: 'bg-red-50',
                    containerBorder: 'border-red-100',
                    iconBg: 'bg-red-100',
                    iconColor: 'text-red-500',
                    titleColor: 'text-red-700',
                    badgeBg: 'bg-red-100',
                    badgeColor: 'text-red-600',
                    label: 'High'
                  }
                }
                if (s === 'medium') {
                  return {
                    containerBg: 'bg-orange-50',
                    containerBorder: 'border-orange-100',
                    iconBg: 'bg-orange-100',
                    iconColor: 'text-orange-500',
                    titleColor: 'text-orange-700',
                    badgeBg: 'bg-orange-100',
                    badgeColor: 'text-orange-600',
                    label: 'Medium'
                  }
                }
                if (s === 'low') {
                  return {
                    containerBg: 'bg-yellow-50',
                    containerBorder: 'border-yellow-100',
                    iconBg: 'bg-yellow-100',
                    iconColor: 'text-yellow-600',
                    titleColor: 'text-yellow-800',
                    badgeBg: 'bg-yellow-100',
                    badgeColor: 'text-yellow-600',
                    label: 'Low'
                  }
                }
                return {
                  containerBg: 'bg-blue-50',
                  containerBorder: 'border-blue-100',
                  iconBg: 'bg-blue-100',
                  iconColor: 'text-blue-500',
                  titleColor: 'text-blue-700',
                  badgeBg: 'bg-blue-100',
                  badgeColor: 'text-blue-600',
                  label: severity || 'Info'
                }
              }

              const severeRisks = riskWarnings?.severe_risks && Array.isArray(riskWarnings.severe_risks) ? riskWarnings.severe_risks : []
              const minorRisks = riskWarnings?.minor_risks && Array.isArray(riskWarnings.minor_risks) ? riskWarnings.minor_risks : []

              const renderRiskCard = (risk: any, keyPrefix: string, idx: number) => {
                const config = getSeverityConfig(risk.severity)
                return (
                  <div key={`${keyPrefix}-${idx}`} className={`p-4 rounded-xl ${config.containerBg} border ${config.containerBorder}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full ${config.iconBg} flex items-center justify-center shrink-0`}>
                        <AlertCircle className={`w-4 h-4 ${config.iconColor}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-medium text-sm ${config.titleColor}`}>{risk.type}</span>
                          <span className={`px-2 py-0.5 ${config.badgeBg} ${config.badgeColor} text-xs rounded font-medium`}>
                            {config.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{risk.detail}</p>
                      </div>
                    </div>
                  </div>
                )
              }

              const hasAnyRisks = severeRisks.length > 0 || minorRisks.length > 0

              if (!hasAnyRisks) {
                return (
                  <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-green-700">无风险</p>
                        <p className="text-sm text-gray-500 mt-0.5">AI交叉验证未发现风险问题</p>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div className="space-y-5">
                  {severeRisks.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-3">严重风险</p>
                      <div className="space-y-3">
                        {severeRisks.map((risk, idx) => renderRiskCard(risk, 'severe', idx))}
                      </div>
                    </div>
                  )}
                  {minorRisks.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-3">次要风险</p>
                      <div className="space-y-3">
                        {minorRisks.map((risk, idx) => renderRiskCard(risk, 'minor', idx))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <Zap className="w-4 h-4 text-blue-500" />
              </div>
              <h2 className="text-lg font-semibold text-[#1C1E3A]">HR专业技术翻译</h2>
            </div>

            {techTranslation && techTranslation.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">技术术语</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">段位评估</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">通俗解释</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">段位说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {techTranslation.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-[#1C1E3A]">{item.original}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${getLevelClass(item.level)}`}>
                            {item.level}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{item.plain_explanation}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">{item.level_assessment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-8 text-center">
                <p className="text-gray-400">暂无技术翻译数据</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-orange-500" />
              </div>
              <h2 className="text-lg font-semibold text-[#1C1E3A]">技能匹配度对照</h2>
            </div>

            {skillMatch && skillMatch.length > 0 ? (
              <div className="space-y-5">
                {skillMatch.map((skill, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#1C1E3A] text-sm">{skill.skill_name}</span>
                      </div>
                      <span className="text-sm font-bold text-[#4AB5A9]">{skill.match_level}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                      <div
                        className="h-2.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${skill.match_level}%`,
                          backgroundColor:
                            skill.match_level >= 80 ? '#4AB5A9' :
                            skill.match_level >= 60 ? '#F59E0B' :
                            '#EF4444',
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#4AB5A9]">岗位要求：{skill.job_requirement}</span>
                    </div>
                    <p className={`text-sm mt-2 leading-relaxed ${(skill.match_level || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{skill.match_comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-8 text-center">
                <p className="text-gray-400">暂无技能匹配数据</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
