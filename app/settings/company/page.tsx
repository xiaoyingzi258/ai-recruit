"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Upload, Check, Shield, User, Building2, Briefcase, Users, FileText } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

const tabs = [
  { key: "jobs", label: "岗位管理", disabled: false },
  { key: "roles", label: "角色权限", disabled: false },
  { key: "company", label: "企业信息", disabled: false },
]

const industryOptions = [
  "互联网/人工智能",
  "软件/IT服务",
  "金融/银行",
  "教育/培训",
  "制造业",
  "医疗/健康",
  "其他",
]

const scaleOptions = [
  "1-50人",
  "50-150人",
  "150-500人",
  "500-1000人",
  "1000人以上",
]

export default function CompanyPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [companyLogo, setCompanyLogo] = useState<string>("")
  const [companyName, setCompanyName] = useState<string>("")
  const [tenantId, setTenantId] = useState<string>("")
  const [industry, setIndustry] = useState<string>(industryOptions[0])
  const [scale, setScale] = useState<string>(scaleOptions[1])
  const [description, setDescription] = useState<string>("")
  const [socialCreditCode, setSocialCreditCode] = useState<string>("")
  const [legalRepresentative, setLegalRepresentative] = useState<string>("")
  const [isVerified, setIsVerified] = useState<boolean>(true)
  const [aiUsage, setAiUsage] = useState<{ analysis: { used: number; total: number }; interview: { used: number; total: number }; members: { used: number; total: number } }>({
    analysis: { used: 850, total: 1000 },
    interview: { used: 480, total: 500 },
    members: { used: 17, total: 20 },
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile) {
      setCompanyName(profile.company_name || "")
      setTenantId(`CF-${String(profile.company_id || "").slice(0, 8).toUpperCase()}-SaaS-001`)
      if (profile.logo) setCompanyLogo(profile.logo)
      if (profile.industry) setIndustry(profile.industry)
      if (profile.scale) setScale(profile.scale)
      if (profile.description) setDescription(profile.description)
      if (profile.social_credit_code) setSocialCreditCode(profile.social_credit_code)
      if (profile.legal_representative) setLegalRepresentative(profile.legal_representative)
      if (typeof profile.is_verified === "boolean") setIsVerified(profile.is_verified)
      if (profile.ai_usage) setAiUsage(profile.ai_usage)
    }
  }, [profile])

  const handleLogoClick = () => {
    fileInputRef.current?.click()
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("图片大小不能超过 2MB")
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setCompanyLogo(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          logo: companyLogo,
          industry,
          scale,
          description,
          social_credit_code: socialCreditCode,
          legal_representative: legalRepresentative,
        }),
      })
      const data = await res.json()
      if (data.success) {
        alert("保存成功")
      } else {
        alert(data.error || "保存失败")
      }
    } catch (error) {
      console.error("保存企业信息失败:", error)
    } finally {
      setSaving(false)
    }
  }

  const analysisPercent = Math.min(100, (aiUsage.analysis.used / aiUsage.analysis.total) * 100)
  const interviewPercent = Math.min(100, (aiUsage.interview.used / aiUsage.interview.total) * 100)
  const memberPercent = Math.min(100, (aiUsage.members.used / aiUsage.members.total) * 100)
  const isInterviewLow = interviewPercent >= 90

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center gap-1 border-b-0">
            {tabs.map((tab) => (
              <div
                key={tab.key}
                onClick={() => {
                  if (!tab.disabled) {
                    if (tab.key === "roles") router.push("/settings/roles")
                    if (tab.key === "jobs") router.push("/settings/jobs")
                    if (tab.key === "company") router.push("/settings/company")
                  }
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  tab.disabled
                    ? "text-gray-400 cursor-not-allowed"
                    : tab.key === "company"
                    ? "bg-[#E8F5F3] text-[#4AB5A9] cursor-pointer"
                    : "text-gray-500 hover:text-gray-700 cursor-pointer"
                }`}
              >
                {tab.label}
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-5">
              {/* 企业实名认证状态 */}
              <div className="bg-[#EDF7F4] rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#4AB5A9] flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#4AB5A9]">已通过企业实名认证</p>
                    <p className="text-xs text-gray-500 mt-0.5">认证企业可解锁批量简历导入及 AI 视频面试功能。</p>
                  </div>
                </div>
                <button className="px-3 py-1.5 text-xs font-medium text-white bg-[#4AB5A9] rounded-md hover:bg-[#3d9a8e] transition-colors whitespace-nowrap">
                  查看认证资质
                </button>
              </div>

              {/* 企业基础档案 */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-baseline gap-3 mb-5">
                  <h2 className="text-sm font-semibold text-[#1C1E3A]">企业基础档案</h2>
                  <span className="text-xs text-gray-400">在此维护您公司的对外展示信息</span>
                </div>

                {/* Logo 上传 */}
                <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-100">
                  <div
                    onClick={handleLogoClick}
                    className="w-14 h-14 bg-[#F7F8FA] border border-gray-200 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-[#4AB5A9]/50 transition-colors overflow-hidden"
                  >
                    {companyLogo ? (
                      <img src={companyLogo} alt="企业Logo" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-[#4AB5A9]">
                        {(companyName || "企业").charAt(0)}
                      </span>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <div className="flex flex-col">
                    <button
                      onClick={handleLogoClick}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors w-fit"
                    >
                      更换企业 Logo
                    </button>
                    <span className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                      建议尺寸 200×200px，支持 PNG/JPG 格式，小于 2MB
                    </span>
                  </div>
                </div>

                {/* 表单输入 */}
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">企业全称</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-400 cursor-not-allowed"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">租户 ID (Tenant ID)</label>
                    <input
                      type="text"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-400 cursor-not-allowed"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">所属行业</label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md text-[#1C1E3A] bg-white focus:outline-none focus:ring-2 focus:ring-[#4AB5A9]/20 focus:border-[#4AB5A9] transition-colors appearance-none cursor-pointer"
                    >
                      {industryOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">企业规模</label>
                    <select
                      value={scale}
                      onChange={(e) => setScale(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md text-[#1C1E3A] bg-white focus:outline-none focus:ring-2 focus:ring-[#4AB5A9]/20 focus:border-[#4AB5A9] transition-colors appearance-none cursor-pointer"
                    >
                      {scaleOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 简介 */}
                <div className="mt-5">
                  <label className="block text-xs text-gray-500 mb-1.5">企业一句话简介</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md text-[#1C1E3A] bg-white focus:outline-none focus:ring-2 focus:ring-[#4AB5A9]/20 focus:border-[#4AB5A9] transition-colors resize-none"
                    placeholder="请输入企业简介"
                  />
                </div>

                {/* 法定主体信息 */}
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-[#1C1E3A] mb-4">法定主体信息</h3>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">统一社会信用代码</label>
                      <input
                        type="text"
                        value={socialCreditCode}
                        onChange={(e) => setSocialCreditCode(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-400 cursor-not-allowed"
                        disabled
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">法定代表人</label>
                      <input
                        type="text"
                        value={legalRepresentative}
                        onChange={(e) => setLegalRepresentative(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-400 cursor-not-allowed"
                        disabled
                      />
                    </div>
                  </div>
                </div>

                {/* 保存按钮 */}
                <div className="mt-6 pt-5 flex justify-end border-t border-gray-100">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#4AB5A9] rounded-md hover:bg-[#3d9a8e] transition-colors shadow-sm disabled:opacity-50"
                  >
                    {saving ? "保存中..." : "保存修改"}
                  </button>
                </div>
              </div>
            </div>

            {/* 右侧 AI 服务用量卡片 */}
            <div className="col-span-1">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-[#2D2E3A] px-5 pt-4 pb-4">
                  <div className="flex items-start">
                    <span className="text-base font-bold text-[#FFE3A3]">PRO 专业版</span>
                  </div>
                </div>
                <div className="px-5 pb-5 pt-5">
                  <h3 className="text-lg font-bold text-[#1C1E3A] mb-5">AI 算力与服务用量</h3>

                  {/* AI 简历深度解析 */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#1C1E3A]">AI 简历深度解析</span>
                      <span className="text-sm font-semibold text-[#1C1E3A]">
                        <span className="text-[#4AB5A9]">{aiUsage.analysis.used}</span>
                        <span className="text-gray-400 font-normal"> / {aiUsage.analysis.total} 份</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#4AB5A9] rounded-full transition-all"
                        style={{ width: `${analysisPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* 定制化面试试题生成 */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#1C1E3A]">定制化面试试题生成</span>
                      <span className="text-sm font-semibold text-[#1C1E3A]">
                        <span className="text-[#F97316]">{aiUsage.interview.used}</span>
                        <span className="text-gray-400 font-normal"> / {aiUsage.interview.total} 次</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#F97316] rounded-full transition-all"
                        style={{ width: `${interviewPercent}%` }}
                      />
                    </div>
                    {isInterviewLow && (
                      <p className="text-xs text-[#F97316] mt-2">
                        额度即将耗尽，请及时充值以免影响业务流转。
                      </p>
                    )}
                  </div>

                  {/* 企业关联子账号 */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#1C1E3A]">企业关联子账号</span>
                      <span className="text-sm font-semibold text-[#1C1E3A]">
                        <span className="text-[#1C1E3A]">{aiUsage.members.used}</span>
                        <span className="text-gray-400 font-normal"> / {aiUsage.members.total} 人</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-300 rounded-full transition-all"
                        style={{ width: `${memberPercent}%` }}
                      />
                    </div>
                  </div>

                  <button className="w-full text-sm text-[#4AB5A9] font-medium hover:underline mt-2">
                    购买更多 AI 算力叠加包 →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
