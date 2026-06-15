"use client"

import { TrendingUp, Users, Zap, Clock, ArrowUpRight, Filter, BarChart3, PieChart, Sparkles } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

export default function DashboardPage() {
  const { profile } = useAuth()
  
  console.log("[Dashboard] profile 数据:", profile)
  
  const roleLabel = profile?.role === "admin" ? "管理员" : profile?.role === "manager" ? "经理" : "招聘专员"
  
  const stats = [
    { 
      icon: Users, 
      label: "本周新增简历总数", 
      value: "1,245", 
      change: "↑ 12.5%", 
      trend: "up",
      color: "text-[#4AB5A9]",
      bgColor: "bg-[#E8F5F3]"
    },
    { 
      icon: TrendingUp, 
      label: "高匹配度人才（80分+）", 
      value: "262", 
      change: "优质供给占 21%", 
      trend: "good",
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    { 
      icon: Zap, 
      label: "AI 自动化筛选人数", 
      value: "584", 
      change: "状态实时流转", 
      trend: "auto",
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    { 
      icon: Clock, 
      label: "平均筛人效率提升", 
      value: "5.2x", 
      change: "对比人工初筛耗时", 
      trend: "up",
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
  ]

  const channelData = [
    { name: "BOSS 直聘", count: 520, percentage: "41.8%", matchRate: "68%" },
    { name: "猎聘", count: 315, percentage: "25.3%", matchRate: "72%" },
    { name: "前程无忧", count: 245, percentage: "19.7%", matchRate: "65%" },
    { name: "智联招聘", count: 165, percentage: "13.2%", matchRate: "58%" },
  ]

  const funnelData = [
    { label: "简历投递", value: 1245, color: "#4AB5A9" },
    { label: "AI 初筛", value: 584, color: "#3d9a8e" },
    { label: "人工复筛", value: 262, color: "#2d7a6e" },
    { label: "面试邀约", value: 145, color: "#1d5a4e" },
    { label: "Offer", value: 42, color: "#0d3a2e" },
  ]

  const lineChartData = Array.from({ length: 30 }, (_, i) => ({
    date: `12/${i + 1}`,
    value: Math.floor(Math.random() * 60) + 20,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1E3A]">Hi, {profile?.name || "Welcome"} 👋</h1>
          <p className="text-gray-500 mt-1">当前登录：{roleLabel} · 今天也是元气满满的一天</p>
          {/* 调试信息 */}
          {/* <pre className="text-xs text-gray-400 mt-2 bg-gray-100 p-2 rounded">{JSON.stringify(profile, null, 2)}</pre> */}
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors">
            导出报表
          </button>
          <button className="px-4 py-2 bg-[#4AB5A9] text-white rounded-lg hover:bg-[#3d9a8e] transition-colors flex items-center gap-2">
            <Filter className="w-4 h-4" />
            筛选数据
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-3xl font-bold text-[#1C1E3A] mt-2">{stat.value}</p>
                  <p className={`text-sm mt-3 flex items-center gap-1 ${stat.trend === 'up' ? 'text-green-600' : stat.trend === 'good' ? 'text-blue-600' : 'text-gray-500'}`}>
                    {stat.trend === 'up' && <ArrowUpRight className="w-4 h-4" />}
                    {stat.change}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-[#1C1E3A]">近30天简历流入量趋势</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <BarChart3 className="w-4 h-4" />
              <span>按日统计</span>
            </div>
          </div>
          <div className="h-64 bg-gradient-to-b from-gray-50 to-white rounded-xl p-4">
            <div className="flex items-end justify-between h-full gap-1">
              {lineChartData.map((item, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className="w-full bg-gradient-to-t from-[#4AB5A9] to-[#4AB5A9]/60 rounded-t-lg transition-all hover:from-[#3d9a8e] hover:to-[#3d9a8e]/60"
                    style={{ height: `${item.value}%` }}
                  ></div>
                  {i % 5 === 0 && <span className="text-xs text-gray-400">{item.date}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-[#1C1E3A]">简历 → 面试 → Offer 转化漏斗</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <PieChart className="w-4 h-4" />
              <span>全链路</span>
            </div>
          </div>
          <div className="h-64 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              {funnelData.map((item, i) => {
                const width = (item.value / funnelData[0].value) * 100
                return (
                  <div key={i} className="flex items-center gap-4 w-full">
                    <div className="w-24 text-sm text-gray-600 text-right">{item.label}</div>
                    <div className="flex-1">
                      <div 
                        className="h-12 rounded-lg flex items-center justify-center text-white font-medium shadow-sm"
                        style={{ 
                          width: `${width}%`,
                          backgroundColor: item.color
                        }}
                      >
                        {item.value}
                      </div>
                    </div>
                    <div className="w-16 text-sm text-gray-500 text-left">
                      {i > 0 ? `${Math.round((item.value / funnelData[i-1].value) * 100)}%` : '-'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-[#1C1E3A]">各招聘渠道简历数量对比</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">渠道名称</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">简历数</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">占比</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">匹配率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {channelData.map((channel, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#4AB5A9] to-[#3d9a8e] rounded-lg flex items-center justify-center text-white font-semibold">
                        {channel.name[0]}
                      </div>
                      <span className="font-medium text-[#1C1E3A]">{channel.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[#1C1E3A] font-semibold">{channel.count}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#4AB5A9] to-[#3d9a8e] rounded-full"
                          style={{ width: channel.percentage }}
                        ></div>
                      </div>
                      <span className="text-gray-600 text-sm">{channel.percentage}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      parseFloat(channel.matchRate) >= 70 
                        ? 'bg-green-100 text-green-700' 
                        : parseFloat(channel.matchRate) >= 60 
                          ? 'bg-yellow-100 text-yellow-700' 
                          : 'bg-gray-100 text-gray-700'
                    }`}>
                      {channel.matchRate}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div> */}
    </div>
  )
}
