'use client'
// app/study-log/page.tsx
// 自主学習記録画面

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

const ACTIVITIES = [
  'Duolingo・アプリ学習', 'シャドーイング', 'YouTubeで英語動画',
  '英語ポッドキャスト', '英単語暗記', 'オンライン英会話（自習）',
  '英語の本・記事を読む', '英作文練習', 'TOEIC問題集', 'その他',
]

export default function StudyLogPage() {
  const [duration, setDuration] = useState(30)
  const [activity, setActivity] = useState('')
  const [customActivity, setCustomActivity] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSave = async () => {
    const activityName = activity === 'その他' ? customActivity : activity
    if (!activityName || saving) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    await supabase.from('study_logs').insert({
      student_id: user.id,
      date: new Date().toISOString().split('T')[0],
      duration_minutes: duration,
      activity: activityName,
      notes: notes || null,
    })

    setSaved(true)
    setSaving(false)
  }

  if (saved) return (
    <div className="min-h-screen bg-[#F4F7F0] flex flex-col items-center justify-center gap-4 px-4">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
        <CheckCircle size={32} className="text-green-500" />
      </div>
      <p className="text-base font-semibold text-secondary">記録しました！</p>
      <p className="text-sm text-gray-400">{duration}分の学習を記録しました</p>
      <button onClick={() => router.push('/dashboard')}
        className="mt-2 bg-primary text-white px-8 py-3 rounded-2xl text-sm font-medium">
        ホームに戻る
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F7F0]">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <h1 className="text-base font-semibold text-secondary">自主学習を記録する</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* 学習時間 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-secondary mb-4">学習時間</p>
          <div className="text-center mb-4">
            <span className="text-5xl font-bold text-secondary">{duration}</span>
            <span className="text-lg text-gray-400 ml-1">分</span>
          </div>
          <input type="range" min="5" max="180" step="5" value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            className="w-full accent-primary" />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>5分</span><span>180分</span>
          </div>
          <div className="flex gap-2 mt-3">
            {[15, 30, 45, 60, 90].map(m => (
              <button key={m} onClick={() => setDuration(m)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition ${duration === m ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {m}分
              </button>
            ))}
          </div>
        </div>

        {/* 学習内容 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-secondary mb-3">何を勉強しましたか？</p>
          <div className="flex flex-wrap gap-2">
            {ACTIVITIES.map(a => (
              <button key={a} onClick={() => setActivity(a)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${activity === a ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {a}
              </button>
            ))}
          </div>
          {activity === 'その他' && (
            <input value={customActivity} onChange={e => setCustomActivity(e.target.value)}
              placeholder="学習内容を入力..."
              className="mt-3 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          )}
        </div>

        {/* メモ */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-secondary mb-2">メモ（任意）</p>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="今日学んだこと、気づいたことなど..."
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
        </div>

        <button onClick={handleSave}
          disabled={!activity || (activity === 'その他' && !customActivity) || saving}
          className="w-full bg-primary text-white font-medium py-3.5 rounded-2xl text-sm hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? '記録中...' : '記録する'}
        </button>
      </div>
    </div>
  )
}
