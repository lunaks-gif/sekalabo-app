// types/index.ts
// SEKALABOアプリ全体の型定義

export type UserRole = 'student' | 'teacher' | 'admin'

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2'

export type Plan = 'kids_semi' | 'kids_solo' | 'adult_solo' | 'ca_toeic' | 'business'

// ユーザー
export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url?: string
  created_at: string
}

// 生徒プロフィール
export interface Student {
  id: string
  profile_id: string
  teacher_id: string
  level: CEFRLevel
  plan: Plan
  goal: string
  started_at: string
  profile?: Profile
  teacher?: Profile
}

// 講師プロフィール
export interface Teacher {
  id: string
  profile_id: string
  bio: string
  languages: string[]
  profile?: Profile
  students?: Student[]
}

// チャットルーム
export interface ChatRoom {
  id: string
  student_id: string
  teacher_id: string
  created_at: string
  student?: Profile
  teacher?: Profile
  last_message?: Message
  unread_count?: number
}

// メッセージ
export interface Message {
  id: string
  room_id: string
  sender_id: string
  content: string
  type: 'text' | 'audio' | 'file'
  file_url?: string
  file_name?: string
  duration?: number
  is_read: boolean
  created_at: string
  sender?: Profile
}

// 宿題
export interface Homework {
  id: string
  student_id: string
  teacher_id: string
  title: string
  description: string
  due_date: string
  status: 'pending' | 'submitted' | 'graded'
  created_at: string
  submission?: HomeworkSubmission
}

// 宿題提出
export interface HomeworkSubmission {
  id: string
  homework_id: string
  student_id: string
  audio_url?: string
  text_content?: string
  ai_feedback?: string
  ai_score?: number
  teacher_feedback?: string
  teacher_score?: number
  submitted_at: string
}

// スピーキングテスト
export interface SpeakingTest {
  id: string
  student_id: string
  teacher_id?: string
  level: CEFRLevel
  audio_url: string
  transcript?: string
  scores: SpeakingScores
  total_score: number
  max_score: number
  feedback: string
  next_level_eligible: boolean
  created_at: string
}

// 採点スコア
export interface SpeakingScores {
  fluency: number
  vocabulary: number
  grammar: number
  communication: number
}

// 自主学習ログ
export interface StudyLog {
  id: string
  student_id: string
  date: string
  duration_minutes: number
  activity: string
  notes?: string
  created_at: string
}

// 通知
export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  type: 'homework_reminder' | 'message' | 'test_result' | 'announcement'
  is_read: boolean
  created_at: string
}
