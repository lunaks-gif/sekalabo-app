'use client'
// app/admin/page.tsx
// 管理者ダッシュボード

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Users, BookOpen, TrendingUp, DollarSign, ChevronRight, Plus, LogOut } from 'lucide-react'
import type { Profile, Student, Homework } from '@/types'

interface Stats {
  totalStudents: number
  activeStudents: number
  pendingHomework: number
  monthlyRevenue: number
}

const PLAN_PRICE = {
  kids_semi: 10000,
  kids_solo: 15000,
  adult_solo: 25000,
  ca_toeic: 25000,
  business: 25000,
}

export default function AdminPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<Stats>({ totalStudents: 0, activeStudents: 0, pendingHomework: 0, monthlyRevenue: 0 })
  const [students, setStudents] = useState<any[]>([])
  const [tab, setTab] = useState<'overview' | 'students' | 'homework'>('overview')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { data: profileData } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    if (!profileData || profileData.role !== 'admin') { router.push('/auth'); return }
    setProfile(profileData)

    // 生徒一覧
    const { data: studentsData } = await supabase
      .from('students')
      .select('*, profile:profile_id(*), teacher:teacher_id(full_name)')
      .order('started_at', { ascending: false })
    setStudents(studentsData || [])

    // 未提出宿題数
    const { count: hwCount } = await supabase
      .from('homework')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    const total = studentsData?.length || 0
    const revenue = studentsData?.reduce((sum: number, s: any) => {
      return sum + (PLAN_PRICE[s.plan as keyof typeof PLAN_PRICE] || 0)
    }, 0) || 0

    setStats({
      totalStudents: total,
      activeStudents: total,
      pendingHomework: hwCount || 0,
      monthlyRevenue: revenue,
    })
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (loading) return (
    <div className="min-h-screen bg-[#F4F7F0] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F7F0] pb-8">
      {/* ヘッダー */}
      <div className="bg-secondary text-white px-6 pt-12 pb-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">管理者画面</p>
            <h1 className="text-xl font-bold tracking-wider">SEKALABO</h1>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition">
            <LogOut size={14} /> ログアウト
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-2">
        {/* KPIカード */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: '在籍生徒数', value: `${stats.totalStudents}名`, icon: Users, color: 'bg-blue-50 text-blue-600' },
            { label: '月間売上（概算）', value: `¥${stats.monthlyRevenue.toLocaleString()}`, icon: DollarSign, color: 'bg-green-50 text-green-600' },
            { label: '未提出宿題', value: `${stats.pendingHomework}件`, icon: BookOpen, color: 'bg-amber-50 text-amber-600' },
            { label: 'アクティブ講師', value: '4名', icon: TrendingUp, color: 'bg-purple-50 text-purple-600' },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${item.color}`}>
                <item.icon size={18} />
              </div>
              <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
              <p className="text-lg font-bold text-secondary">{item.value}</p>
            </div>
          ))}
        </div>

        {/* タブ */}
        <div className="flex gap-2 mb-4">
          {[
            { id: 'overview', label: '概要' },
            { id: 'students', label: '生徒管理' },
            { id: 'homework', label: '宿題管理' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${tab === t.id ? 'bg-secondary text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 生徒管理 */}
        {tab === 'students' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-secondary">生徒一覧（{students.length}名）</p>
              <button onClick={() => router.push('/admin/students/new')}
                className="flex items-center gap-1 text-xs bg-primary text-white px-3 py-1.5 rounded-xl">
                <Plus size={12} /> 追加
              </button>
            </div>
            {students.map(s => (
              <button key={s.id} onClick={() => router.push(`/admin/students/${s.id}`)}
                className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 hover:border-primary transition">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">
                  {s.profile?.full_name?.[0]}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-secondary">{s.profile?.full_name}</p>
                  <p className="text-xs text-gray-400">
                    {s.level} ・ {s.teacher?.full_name || '講師未設定'}
                  </p>
                </div>
                <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                  {s.plan}
                </span>
                <ChevronRight size={14} className="text-gray-300" />
              </button>
            ))}
          </div>
        )}

        {/* 概要 */}
        {tab === 'overview' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-secondary mb-3">売上内訳</h2>
              <div className="space-y-2">
                {Object.entries(
                  students.reduce((acc: any, s: any) => {
                    acc[s.plan] = (acc[s.plan] || 0) + 1
                    return acc
                  }, {})
                ).map(([plan, count]: [string, any]) => (
                  <div key={plan} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{plan}</span>
                    <span className="font-medium text-secondary">
                      {count}名 × ¥{(PLAN_PRICE[plan as keyof typeof PLAN_PRICE] || 0).toLocaleString()} = ¥{((PLAN_PRICE[plan as keyof typeof PLAN_PRICE] || 0) * count).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-semibold">
                  <span className="text-secondary">月間合計</span>
                  <span className="text-primary">¥{stats.monthlyRevenue.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-secondary mb-3">クイックリンク</h2>
              <div className="space-y-2">
                {[
                  { label: '生徒を追加する', path: '/admin/students/new' },
                  { label: '宿題を作成する', path: '/admin/homework/new' },
                  { label: '講師を管理する', path: '/admin/teachers' },
                  { label: '月次レポートを生成', path: '/admin/reports' },
                ].map(item => (
                  <button key={item.label} onClick={() => router.push(item.path)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition text-sm text-secondary">
                    {item.label}
                    <ChevronRight size={14} className="text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
