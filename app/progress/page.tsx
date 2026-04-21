'use client'
// app/progress/page.tsx
// 成長曲線・成長記録画面

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, TrendingUp, Mic, BookOpen, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function ProgressPage() {
  const [profile, setProfile] = useState<any>(null)
  const [tests, setTests] = useState<any[]>([])
  const [studyLogs, setStudyLogs] = useState<any[]>([])
  const [tab, setTab] = useState<'scores' | 'radar' | 'study'>('scores')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { data: profileData } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    setProfile(profileData)

    const { data: testsData } = await supabase
      .from('speaking_tests')
      .select('*')
      .eq('student_id', user.id)
      .order('created_at', { ascending: true })
    setTests(testsData || [])

    const { data: logsData } = await supabase
      .from('study_logs')
      .select('*')
      .eq('student_id', user.id)
      .order('date', { ascending: false })
      .limit(30)
    setStudyLogs(logsData || [])

    setLoading(false)
  }

  const chartData = tests.map(t => ({
    date: format(new Date(t.created_at), 'M/d'),
    スコア: Math.round((t.total_score / t.max_score) * 100),
    level: t.level,
  }))

  const latestTest = tests[tests.length - 1]
  const radarData = latestTest ? [
    { subject: '流暢さ', value: latestTest.score_fluency, max: latestTest.max_score === 20 ? 5 : 4 },
    { subject: '語彙', value: latestTest.score_vocabulary, max: latestTest.max_score === 20 ? 5 : 4 },
    { subject: '文法', value: latestTest.score_grammar, max: latestTest.max_score === 20 ? 5 : 4 },
    { subject: 'コミュニケーション', value: latestTest.score_communication, max: latestTest.max_score === 20 ? 5 : 4 },
  ] : []

  const totalStudyMinutes = studyLogs.reduce((sum, l) => sum + l.duration_minutes, 0)
  const avgStudyMinutes = studyLogs.length > 0 ? Math.round(totalStudyMinutes / studyLogs.length) : 0

  if (loading) return (
    <div className="min-h-screen bg-[#F4F7F0] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F7F0] pb-24">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <h1 className="text-base font-semibold text-secondary">成長記録</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* サマリーカード */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
            <Mic size={16} className="text-purple-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-secondary">{tests.length}</p>
            <p className="text-xs text-gray-400">テスト回数</p>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
            <TrendingUp size={16} className="text-green-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-secondary">
              {latestTest ? `${Math.round((latestTest.total_score / latestTest.max_score) * 100)}%` : '—'}
            </p>
            <p className="text-xs text-gray-400">最新スコア</p>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
            <Clock size={16} className="text-amber-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-secondary">{totalStudyMinutes}</p>
            <p className="text-xs text-gray-400">総学習分数</p>
          </div>
        </div>

        {/* タブ */}
        <div className="flex gap-2">
          {[
            { id: 'scores', label: 'スコア推移' },
            { id: 'radar', label: '能力分析' },
            { id: 'study', label: '自主学習' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex-1 py-1.5 rounded-full text-xs font-medium transition ${tab === t.id ? 'bg-secondary text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* スコア推移グラフ */}
        {tab === 'scores' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-secondary mb-4">スコア推移（%）</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: any) => [`${value}%`, 'スコア']}
                    labelStyle={{ fontSize: 12 }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="スコア"
                    stroke="#5BBD72"
                    strokeWidth={2.5}
                    dot={{ fill: '#5BBD72', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-300">
                <p className="text-sm">まだテストデータがありません</p>
              </div>
            )}

            {/* テスト履歴 */}
            {tests.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-gray-400 mb-2">テスト履歴</p>
                {[...tests].reverse().slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      t.level === 'A1' ? 'bg-green-100 text-green-700' :
                      t.level === 'A2' ? 'bg-blue-100 text-blue-700' :
                      t.level === 'B1' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>{t.level}</span>
                    <span className="text-xs text-gray-400 flex-1">
                      {format(new Date(t.created_at), 'M月d日', { locale: ja })}
                    </span>
                    <span className="text-sm font-semibold text-secondary">
                      {t.total_score}/{t.max_score}点
                    </span>
                    {t.next_level_eligible && (
                      <span className="text-xs text-green-600">昇格可能</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* レーダーチャート */}
        {tab === 'radar' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-secondary mb-4">能力分析（最新テスト）</h2>
            {radarData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <Radar
                      dataKey="value"
                      stroke="#5BBD72"
                      fill="#5BBD72"
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-2">
                  {radarData.map(d => (
                    <div key={d.subject} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-28">{d.subject}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(d.value / d.max) * 100}%` }} />
                      </div>
                      <span className="text-xs font-medium text-secondary w-10 text-right">{d.value}/{d.max}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-300">
                <p className="text-sm">まだテストデータがありません</p>
              </div>
            )}
          </div>
        )}

        {/* 自主学習ログ */}
        {tab === 'study' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between text-sm mb-3">
                <span className="text-gray-500">月間学習時間</span>
                <span className="font-semibold text-secondary">{totalStudyMinutes}分</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">1日平均</span>
                <span className="font-semibold text-secondary">{avgStudyMinutes}分</span>
              </div>
            </div>
            {studyLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-300">
                <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">学習ログがありません</p>
                <button onClick={() => router.push('/study-log')}
                  className="mt-3 text-xs text-primary font-medium">
                  記録を追加する →
                </button>
              </div>
            ) : studyLogs.map(log => (
              <div key={log.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                  {log.duration_minutes}
                  <span className="text-xs font-normal">分</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-secondary truncate">{log.activity}</p>
                  <p className="text-xs text-gray-400">{format(new Date(log.date), 'M月d日（E）', { locale: ja })}</p>
                </div>
                {log.notes && <p className="text-xs text-gray-400 max-w-24 truncate">{log.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
