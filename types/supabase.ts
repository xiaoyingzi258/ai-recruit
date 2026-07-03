export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: WithRelationships<{
      companies: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          company_id: string | null
          name: string
          role: 'hr' | 'manager' | 'admin'
          email: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          name: string
          role: 'hr' | 'manager' | 'admin'
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          name?: string
          role?: 'hr' | 'manager' | 'admin'
          email?: string
          created_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          company_id: string
          title: string
          jd_text: string
          status: 'open' | 'closed'
          created_by: string
          created_at: string
          updated_at: string
          min_experience?: number
          min_education?: string
          min_salary?: number
          max_salary?: number
          location?: string
          core_skills?: any[]
          parsed_data?: any
        }
        Insert: {
          id?: string
          company_id: string
          title: string
          jd_text: string
          status?: 'open' | 'closed'
          created_by: string
          created_at?: string
          updated_at?: string
          min_experience?: number
          min_education?: string
          min_salary?: number
          max_salary?: number
          location?: string
          core_skills?: any[]
          parsed_data?: any
        }
        Update: {
          id?: string
          company_id?: string
          title?: string
          jd_text?: string
          status?: 'open' | 'closed'
          created_by?: string
          created_at?: string
          updated_at?: string
          min_experience?: number
          min_education?: string
          min_salary?: number
          max_salary?: number
          location?: string
          core_skills?: any[]
          parsed_data?: any
        }
      }
      candidates: {
        Row: {
          id: string
          company_id: string
          job_id: string | null
          name: string
          raw_text: string
          parsed_data: CandidateParsedData
          status: 'pending' | 'shortlisted' | 'removed'
          source: 'upload' | 'manual'
          experience_years?: number
          age?: number
          current_company?: string
          risk_tag?: string
          expected_min_salary?: number
          expected_max_salary?: number
          education?: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          job_id?: string | null
          name: string
          raw_text: string
          parsed_data?: CandidateParsedData
          status?: 'pending' | 'shortlisted' | 'removed'
          source: 'upload' | 'manual'
          experience_years?: number
          age?: number
          current_company?: string
          risk_tag?: string
          expected_min_salary?: number
          expected_max_salary?: number
          education?: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          job_id?: string | null
          name?: string
          raw_text?: string
          parsed_data?: CandidateParsedData
          status?: 'pending' | 'shortlisted' | 'removed'
          source?: 'upload' | 'manual'
          experience_years?: number
          age?: number
          current_company?: string
          risk_tag?: string
          expected_min_salary?: number
          expected_max_salary?: number
          education?: string
          created_at?: string
        }
      }
      match_results: {
        Row: {
          id: string
          candidate_id: string
          job_id: string
          total_score: number
          hard_condition: MatchHardCondition
          tech_skill: MatchTechSkill
          project_exp: MatchProjectExp
          risk_penalty: MatchRiskPenalty
          risk_block: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          candidate_id: string
          job_id: string
          total_score: number
          hard_condition: MatchHardCondition
          tech_skill: MatchTechSkill
          project_exp: MatchProjectExp
          risk_penalty: MatchRiskPenalty
          risk_block?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          candidate_id?: string
          job_id?: string
          total_score?: number
          hard_condition?: MatchHardCondition
          tech_skill?: MatchTechSkill
          project_exp?: MatchProjectExp
          risk_penalty?: MatchRiskPenalty
          risk_block?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      analysis_results: {
        Row: {
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
        Insert: {
          id?: string
          candidate_id: string
          job_id: string
          summary: AnalysisSummary
          risk_warnings: AnalysisRiskWarnings
          tech_translation: AnalysisTechTranslation
          skill_match?: AnalysisSkillMatch
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          candidate_id?: string
          job_id?: string
          summary?: AnalysisSummary
          risk_warnings?: AnalysisRiskWarnings
          tech_translation?: AnalysisTechTranslation
          skill_match?: AnalysisSkillMatch
          created_at?: string
          updated_at?: string
        }
      }
      interview_questions: {
        Row: {
          id: string
          candidate_id: string
          job_id: string
          fraud_questions: InterviewFraudQuestions
          tech_questions: InterviewTechQuestions
          soft_questions: InterviewSoftQuestions
          created_at: string
        }
        Insert: {
          id?: string
          candidate_id: string
          job_id: string
          fraud_questions: InterviewFraudQuestions
          tech_questions: InterviewTechQuestions
          soft_questions: InterviewSoftQuestions
          created_at?: string
        }
        Update: {
          id?: string
          candidate_id?: string
          job_id?: string
          fraud_questions?: InterviewFraudQuestions
          tech_questions?: InterviewTechQuestions
          soft_questions?: InterviewSoftQuestions
          created_at?: string
        }
      }
    }>
    Views: {}
    Functions: {}
    Enums: {}
  }
}

/** 为每张表自动附加 Supabase GenericTable 要求的 Relationships 字段 */
type WithRelationships<T> = {
  [K in keyof T]: T[K] & { Relationships: [] }
}

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

export type InterviewFraudQuestion = {
  id: string
  question: string
  type: 'verification' | 'consistency' | 'knowledge' | 'behavioral'
  expected_answer?: string
  weight: number
}

export type InterviewFraudQuestions = {
  questions: InterviewFraudQuestion[]
  total_weight: number
}

export type InterviewTechQuestion = {
  id: string
  question: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  expected_skills: string[]
  weight: number
  sample_answer?: string
}

export type InterviewTechQuestions = {
  questions: InterviewTechQuestion[]
  total_weight: number
}

export type InterviewSoftQuestion = {
  id: string
  question: string
  type: 'behavioral' | 'situational' | 'cultural' | 'motivational'
  weight: number
  expected_traits: string[]
}

export type InterviewSoftQuestions = {
  questions: InterviewSoftQuestion[]
  total_weight: number
}
