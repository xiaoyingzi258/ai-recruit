// ===== 数据库表行类型 =====

export type Company = {
  id: string
  name: string
  created_at: string
}

export type User = {
  id: string
  company_id: string | null
  name: string
  role: 'hr' | 'manager' | 'admin'
  email: string
  password_hash: string
  department: string | null
  position: string | null
  created_at: string
}

export type Job = {
  id: string
  company_id: string
  title: string
  jd_text: string
  status: 'open' | 'closed'
  created_by: string
  created_at: string
  updated_at: string
  min_experience: number
  min_education: string | null
  min_salary: number
  max_salary: number
  location: string | null
  core_skills: any[] | null
  parsed_data: any | null
}

export type Candidate = {
  id: string
  company_id: string
  job_id: string | null
  name: string
  raw_text: string
  parsed_data: CandidateParsedData | null
  status: 'pending' | 'shortlisted' | 'removed'
  source: 'upload' | 'manual'
  experience_years: number | null
  age: number | null
  current_company: string | null
  risk_tag: string | null
  avatar: string | null
  expected_min_salary: number | null
  expected_max_salary: number | null
  education: string | null
  created_at: string
}

export type MatchResult = {
  id: string
  candidate_id: string
  job_id: string
  total_score: number
  hard_condition: MatchHardCondition
  tech_skill: MatchTechSkill
  project_exp: MatchProjectExp
  risk_penalty: MatchRiskPenalty
  risk_block: string | null
  match_advantages: string[]
  created_at: string
}

export type AnalysisResult = {
  id: string
  candidate_id: string
  job_id: string
  summary: AnalysisSummary
  risk_warnings: AnalysisRiskWarnings
  tech_translation: AnalysisTechTranslation
  skill_match: AnalysisSkillMatch
  created_at: string
  updated_at: string
}

export type InterviewQuestion = {
  id: string
  candidate_id: string
  job_id: string
  fraud_questions: any[]
  tech_questions: any[]
  soft_questions: any[]
  created_at: string
}

export type Role = {
  id: string
  company_id: string
  name: string
  description: string | null
  is_system: boolean
  data_scope: 'company' | 'department' | 'assigned' | null
  created_at: string
}

export type RolePermission = {
  id: string
  role_id: string
  permission_key: string
  created_at: string
}

export type UserRole = {
  id: string
  user_id: string
  role_id: string
  created_at: string
}

// ===== 业务类型定义 =====

export type CandidateParsedData = {
  name?: string
  email?: string
  phone?: string
  location?: string
  age?: number
  experience_years?: number
  degree_level?: string
  current_salary?: string
  expected_min_salary?: number
  expected_max_salary?: number
  job_target?: string
  campus_experience?: {
    description?: string
    organization?: string
    position?: string
    time?: string
  }[]
  personal_info?: {
    name: string
    email?: string
    phone?: string
    location?: string
    age?: number
    gender?: string
  }
  education: {
    degree?: string
    major?: string
    school?: string
    graduation_year?: number
    time?: string
    gpa?: string
  }[]
  work_experience: {
    company?: string
    position?: string
    start_date?: string
    end_date?: string
    time?: string
    description?: string
    achievements?: string[]
  }[]
  skills: ({
    name: string
    level?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
    experience_years?: number
  } | string)[]
  projects?: {
    name?: string
    role?: string
    description?: string
    technologies?: string[]
    start_date?: string
    end_date?: string
  }[]
  certifications?: {
    name?: string
    issuer?: string
    issue_date?: string
    expiry_date?: string
  }[]
  languages?: {
    language: string
    proficiency?: 'basic' | 'conversational' | 'fluent' | 'native'
  }[]
  [key: string]: any
}

export type MatchHardCondition = {
  passed: boolean
  conditions: {
    name: string
    requirement: string
    candidate_value: string
    matched: boolean
    score: number
    max_score: number
  }[]
  total_score: number
  max_score: number
}

export type MatchTechSkill = {
  matched_skills: {
    name: string
    required_level: string
    candidate_level: string
    score: number
    max_score: number
  }[]
  missing_skills: string[]
  extra_skills: string[]
  total_score: number
  max_score: number
}

export type MatchProjectExp = {
  relevant_projects: {
    project_name: string
    role: string
    duration_months: number
    technologies: string[]
    score: number
    max_score: number
  }[]
  total_score: number
  max_score: number
}

export type MatchRiskPenalty = {
  penalties: {
    type: string
    reason: string
    penalty_score: number
    severity: 'low' | 'medium' | 'high'
  }[]
  total_penalty: number
}

export type AnalysisSummary = {
  core_value: string
  top_achievement: string
  match_advantages: string[]
}

export type AnalysisRiskItem = {
  type: string
  severity: string
  detail: string
}

export type AnalysisRiskWarnings = {
  severe_risks: AnalysisRiskItem[]
  minor_risks: AnalysisRiskItem[]
}

export type AnalysisTechTranslationItem = {
  original: string
  level: string
  plain_explanation: string
  level_assessment: string
}

export type AnalysisTechTranslation = AnalysisTechTranslationItem[]

export type AnalysisSkillMatchItem = {
  skill_name: string
  job_requirement: string
  match_level: number
  match_comment: string
}

export type AnalysisSkillMatch = AnalysisSkillMatchItem[]
