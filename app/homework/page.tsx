'use client'
// app/homework/page.tsx
// 宿題一覧・音声提出画面

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Mic, MicOff, Upload, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Homework, Profile } from '@/types'
import { format, isPast } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function HomeworkPage() {
  const [homeworks, setHomeworks] = useState<Homework[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [selected, setSelected] = useState<Homework | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [aiFeedback, setAiFeedback] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadHomework()
  }, [])

  const loadHomework = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileData } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    setProfile(profileData)

    const { data } = await supabase
      .from('homework')
      .select('*, submission:homework_submissions(*)')
      .eq('student_id', user.id)
      .order('due_date', { ascending: true })
    setHomeworks(data || [])
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      setAudioBlob(null)
      setAudioUrl(null)

      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioBlob(blob)
        setAudioUrl(url)
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch {
      alert('マイクへのアクセスを許可してください')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)
  }

  const submitHomework = async () => {
    if (!audioBlob || !selected || !profile || submitting) return
    setSubmitting(true)

    // 音声をアップロード
    const fileName = `homework/${selected.id}/${Date.now()}.webm`
    const { data: uploadData } = await supabase.storage
      .from('audio')
      .upload(fileName, audioBlob)

    if (!uploadData) { setSubmitting(false); return }

    const { data: { publicUrl } } = supabase.storage
      .from('audio').getPublicUrl(fileName)

    // AIフィードバック取得
    const aiRes = await fetch('/api/homework-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioUrl: publicUrl,
        homeworkTitle: selected.title,
        homeworkDescription: selected.description,
      }),
    })
    const aiData = await aiRes.json()
    setAiFeedback(aiData.feedback || '')

    // 提出記録を保存
    await supabase.from('homework_submissions').upsert({
      homework_id: selected.id,
      student_id: profile.id,
      audio_url: publicUrl,
      ai_feedback: aiData.feedback,
      ai_score: aiData.score,
    })

    await supabase.from('homework')
      .update({ status: 'submitted' })
      .eq('id', selected.id)

    setSubmitted(true)
    setSubmitting(false)
    loadHomework()
  }

  const formatTime = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`

  const getStatusIcon = (hw: Homework) => {
    if (hw.status === 'graded') return <CheckCircle size={16} className="text-green-500" />
    if (hw.status === 'submitted') return <CheckCircle size={16} className="text-blue-400" />
    if (isPast(new Date(hw.due_date))) return <AlertCircle size={16} className="text-red-400" />
    return <Clock size={16} className="text-amber-400" />
  }

  const getStatusLabel = (hw: Homework) => {
    if (hw.status === 'graded') return { text: '採点済み', color: 'text-green-600 bg-green-50' }
    if (hw.status === 'submitted') return { text: '提出済み', color: 'text-blue-600 bg-blue-50' }
    if (isPast(new Date(hw.due_date))) return { text: '期限超過', color: 'text-red-600 bg-red-50' }
    return { text: '未提出', color: 'text-amber-600 bg-amber-50' }
  }

  if (selected) {
    return (
      <div className="min-h-screen bg-[#F4F7F0]">
        <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-3 flex items-center gap-3">
          <button onClick={() => { setSelected(null); setSubmitted(false); setAudioBlob(null); setAudioUrl(null); setAiFeedback('') }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <h1 className="text-base font-semibold text-secondary">宿題を提出する</h1>
        </div>

        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="text-base font-semibold text-secondary mb-1">{selected.title}</h2>
            <p className="text-sm text-gray-500 mb-3">{selected.description}</p>
            <p className="text-xs text-gray-400">
              締切：{format(new Date(selected.due_date), 'M月d日（E）HH:mm', { locale: ja })}
            </p>
          </div>

          {submitted ? (
            <div className="bg-green-50 rounded-2xl p-5 border border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={20} className="text-green-500" />
                <p className="text-sm font-semibold text-green-700">提出完了！</p>
              </div>
              {aiFeedback && (
                <>
                  <p className="text-xs font-medium text-green-700 mb-2">🤖 AIフィードバック</p>
                  <p className="text-sm text-green-800 leading-relaxed">{aiFeedback}</p>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              <p className="text-sm font-medium text-secondary">音声で提出する</p>

              {isRecording ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center recording-pulse">
                    <Mic size={28} className="text-white" />
                  </div>
                  <p className="text-lg font-mono text-red-500">{formatTime(recordingTime)}</p>
                  <button onClick={stopRecording}
                    className="flex items-center gap-2 bg-red-50 text-red-600 text-sm font-medium px-5 py-2.5 rounded-xl border border-red-200">
                    <MicOff size={16} /> 録音を停止
                  </button>
                </div>
              ) : audioUrl ? (
                <div className="space-y-3">
                  <audio src={audioUrl} controls className="w-full" />
                  <div className="flex gap-2">
                    <button onClick={startRecording}
                      className="flex-1 text-sm text-gray-500 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50 transition">
                      撮り直す
                    </button>
                    <button onClick={submitHomework} disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-2 bg-primary text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-60">
                      <Upload size={16} />
                      {submitting ? '送信中...' : '提出する'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={startRecording}
                  className="w-full flex flex-col items-center gap-3 py-8 border-2 border-dashed border-gray-200 rounded-2xl hover:border-primary hover:bg-green-50/50 transition">
                  <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                    <Mic size={24} className="text-primary" />
                  </div>
                  <p className="text-sm font-medium text-secondary">タップして録音開始</p>
                  <p className="text-xs text-gray-400">マイクへのアクセスを許可してください</p>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4F7F0] pb-24">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <h1 className="text-base font-semibold text-secondary">宿題</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {homeworks.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <BookOpen size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">宿題はありません</p>
          </div>
        ) : (
          homeworks.map(hw => {
            const status = getStatusLabel(hw)
            return (
              <button
                key={hw.id}
                onClick={() => { if (hw.status === 'pending') setSelected(hw) }}
                className={`w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left transition ${hw.status === 'pending' ? 'hover:border-primary' : 'opacity-80'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-secondary flex-1">{hw.title}</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color} whitespace-nowrap`}>
                    {status.text}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-2 line-clamp-2">{hw.description}</p>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  {getStatusIcon(hw)}
                  締切：{format(new Date(hw.due_date), 'M月d日（E）', { locale: ja })}
                </div>
                {hw.status === 'graded' && (hw as any).submission?.teacher_feedback && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 line-clamp-1">
                      💬 {(hw as any).submission.teacher_feedback}
                    </p>
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function BookOpen({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  )
}
