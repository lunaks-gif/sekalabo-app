'use client'
// app/dashboard/page.tsx
// 生徒ホーム画面

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Bell, BookOpen, Mic, MessageCircle, TrendingUp, Calendar, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Profile, Student, Homework, Message } from '@/types'
import { format, formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'

const LEVEL_COLORS = {
  A1: 'bg-green-100 text-green-700',
  A2: 'bg-blue-100 text-blue-700',
  B1: 'bg-amber-100 text-amber-700',
  B2: 'bg-red-100 text-red-700',
}

const PLAN_LABELS = {
  kids_semi: 'キッズ セミグループ',
  kids_solo: 'キッズ マンツーマン',
  adult_solo: '大人 マンツーマン',
  ca_toeic: 'CA・TOEIC対策',
  business: 'ビジネス英語',
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [student, setStudent] = useState<Student | null>(null)
  const [pendingHomework, setPendingHomework] = useState<Homework[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    // プロフィール取得
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profileData) { router.push('/auth'); return }
    setProfile(profileData)

    // 管理者は管理画面へ
    if (profileData.role === 'admin') { router.push('/admin'); return }

    // 生徒情報取得
    const { data: studentData } = await supabase
      .from('students')
      .select('*, teacher:teacher_id(full_name, avatar_url)')
      .eq('profile_id', user.id)
      .single()
    setStudent(studentData)

    // 未提出の宿題
    const { data: hwData } = await supabase
      .from('homework')
      .select('*')
      .eq('student_id', user.id)
      .eq('status', 'pending')
      .order('due_date', { ascending: true })
      .limit(3)
    setPendingHomework(hwData || [])

    // 未読メッセージ数
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
      .neq('sender_id', user.id)
    setUnreadCount(count || 0)

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F7F0] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4F7F0] pb-24">

      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className="text-xs text-gray-400">おかえりなさい</p>
            <h1 className="text-lg font-semibold text-secondary">
              {profile?.full_name}さん
            </h1>
          </div>
          <button
            onClick={() => router.push('/notifications')}
            className="relative p-2 rounded-xl hover:bg-gray-50 transition"
          >
            <Bell size={20} className="text-gray-500" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {/* レベル・プランカード */}
        {student && (
          <div className="bg-secondary rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${LEVEL_COLORS[student.level]} `}>
                CEFR {student.level}
              </span>
              <span className="text-xs text-gray-400">
                {PLAN_LABELS[student.plan]}
              </span>
            </div>
            <p className="text-sm text-gray-300 mb-1">目標</p>
            <p className="text-sm font-medium">{student.goal || '目標を設定しましょう'}</p>
            {student.teacher && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold">
                  {(student.teacher as any).full_name?.[0]}
                </div>
                <span className="text-xs text-gray-300">
                  担当：{(student.teacher as any).full_name}
                </span>
              </div>
            )}
          </div>
        )}

        {/* クイックアクション */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push('/chat')}
            className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm border border-gray-100 hover:border-primary transition"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <MessageCircle size={20} className="text-blue-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-secondary">チャット</p>
              {unreadCount > 0 && (
                <p className="text-xs text-red-500">{unreadCount}件未読</p>
              )}
            </div>
          </button>

          <button
            onClick={() => router.push('/homework')}
            className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm border border-gray-100 hover:border-primary transition"
          >
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <BookOpen size={20} className="text-amber-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-secondary">宿題</p>
              {pendingHomework.length > 0 && (
                <p className="text-xs text-amber-500">{pendingHomework.length}件未提出</p>
              )}
            </div>
          </button>

          <button
            onClick={() => router.push('/test')}
            className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm border border-gray-100 hover:border-primary transition"
          >
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <Mic size={20} className="text-purple-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-secondary">テスト</p>
              <p className="text-xs text-gray-400">AI採点</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/progress')}
            className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm border border-gray-100 hover:border-primary transition"
          >
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} className="text-green-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-secondary">成長記録</p>
              <p className="text-xs text-gray-400">グラフで確認</p>
            </div>
          </button>
        </div>

        {/* 未提出の宿題 */}
        {pendingHomework.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-secondary">未提出の宿題</h2>
              <button
                onClick={() => router.push('/homework')}
                className="text-xs text-primary font-medium flex items-center gap-0.5"
              >
                すべて見る <ChevronRight size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {pendingHomework.map(hw => {
                const dueDate = new Date(hw.due_date)
                const isOverdue = dueDate < new Date()
                return (
                  <button
                    key={hw.id}
                    onClick={() => router.push(`/homework/${hw.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition text-left"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOverdue ? 'bg-red-400' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary truncate">{hw.title}</p>
                      <p className={`text-xs ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                        締切：{format(dueDate, 'M月d日', { locale: ja })}
                        {isOverdue ? '（期限超過）' : ''}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 自主学習ログボタン */}
        <button
          onClick={() => router.push('/study-log')}
          className="w-full bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-3 hover:bg-primary/20 transition"
        >
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
            <Calendar size={20} className="text-primary-dark" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-primary-dark">今日の自主学習を記録する</p>
            <p className="text-xs text-primary/70">積み重ねが成長曲線に反映されます</p>
          </div>
          <ChevronRight size={16} className="text-primary ml-auto" />
        </button>

      </div>

      {/* ボトムナビ */}
      <BottomNav current="home" />
    </div>
  )
}

function BottomNav({ current }: { current: string }) {
  const router = useRouter()
  const items = [
    { id: 'home', label: 'ホーム', icon: '🏠', path: '/dashboard' },
    { id: 'chat', label: 'チャット', icon: '💬', path: '/chat' },
    { id: 'homework', label: '宿題', icon: '📝', path: '/homework' },
    { id: 'test', label: 'テスト', icon: '🎤', path: '/test' },
    { id: 'progress', label: '成長', icon: '📈', path: '/progress' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 pb-safe z-20">
      <div className="flex max-w-lg mx-auto">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => router.push(item.path)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition ${
              current === item.id ? 'text-primary' : 'text-gray-400'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
