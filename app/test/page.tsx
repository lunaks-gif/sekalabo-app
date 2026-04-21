'use client'
// app/test/page.tsx
// スピーキングテスト画面（AI自動採点）

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Mic, MicOff, ChevronRight, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { CEFRLevel, Profile, SpeakingScores } from '@/types'

const LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2']

const TASKS: Record<CEFRLevel, { title: string; instruction: string; time: number }[]> = {
  A1: [
    { title: '自己紹介', instruction: 'Please introduce yourself. Tell me your name, where you are from, and one hobby.', time: 60 },
    { title: 'Q&Aウォームアップ', instruction: 'Answer these questions:\n1. What time do you wake up?\n2. Do you like coffee or tea?\n3. What is your job?', time: 90 },
    { title: '写真描写', instruction: 'Describe what you see in this scene: a cafe with people sitting and drinking coffee.', time: 90 },
    { title: 'ロールプレイ', instruction: 'You are in a convenience store. Ask how much something costs and if they have a bag.', time: 90 },
  ],
  A2: [
    { title: 'フリートーク', instruction: 'Tell me about your weekend. What did you do? Did you enjoy it?', time: 90 },
    { title: '写真説明', instruction: 'Describe the situation: a woman is working at her desk with a laptop and coffee.', time: 90 },
    { title: '意見を言う', instruction: 'Do you prefer working at home or at an office? Give at least two reasons.', time: 120 },
    { title: 'ロールプレイ', instruction: 'You ordered pasta at a restaurant but they brought pizza. Talk to the waiter.', time: 90 },
  ],
  B1: [
    { title: 'フリートーク', instruction: 'Tell me about something interesting you read or watched recently.', time: 90 },
    { title: '1分間スピーチ', instruction: 'Talk about a place you want to visit and explain why you want to go there.', time: 90 },
    { title: '意見交換', instruction: 'Do you think social media has more positive or negative effects on society? Give reasons.', time: 150 },
    { title: '問題解決', instruction: 'Your colleague made an error in an important report. How would you handle this situation?', time: 120 },
  ],
  B2: [
    { title: 'フリートーク', instruction: 'Tell me about a challenge you have overcome and what you learned from it.', time: 90 },
    { title: 'ディベート', instruction: 'AI will replace most jobs in the next 20 years. Do you agree or disagree? Defend your position.', time: 180 },
    { title: '実践タスク', instruction: 'Imagine you are presenting a new business idea to investors. Pitch your idea in 2 minutes.', time: 120 },
    { title: 'フィードバック', instruction: 'In English, summarize the key points of this test and tell me what you think your strengths and weaknesses are.', time: 90 },
  ],
}

type TestState = 'select-level' | 'intro' | 'task' | 'result'

export default function TestPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [level, setLevel] = useState<CEFRLevel | null>(null)
  const [state, setState] = useState<TestState>('select-level')
  const [taskIndex, setTaskIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [taskAudios, setTaskAudios] = useState<Blob[]>([])
  const [scoring, setScoring] = useState(false)
  const [result, setResult] = useState<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth')
      supabase.from('profiles').select('*').eq('id', user!.id).single()
        .then(({ data }) => setProfile(data))
    })
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setTaskAudios(prev => [...prev, blob])
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

  const nextTask = async () => {
    if (!level) return
    const tasks = TASKS[level]
    if (taskIndex < tasks.length - 1) {
      setTaskIndex(i => i + 1)
    } else {
      await submitTest()
    }
  }

  const submitTest = async () => {
    if (!level || !profile) return
    setScoring(true)
    setState('result')

    try {
      const formData = new FormData()
      taskAudios.forEach((blob, i) => {
        formData.append(`audio_${i}`, blob, `task_${i}.webm`)
      })
      formData.append('level', level)
      formData.append('tasks', JSON.stringify(TASKS[level].map(t => t.title)))

      const res = await fetch('/api/speaking-score', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      setResult(data)

      // 結果を保存
      const fileName = `tests/${profile.id}/${Date.now()}_${level}.webm`
      if (taskAudios[0]) {
        await supabase.storage.from('audio').upload(fileName, taskAudios[0])
        const { data: { publicUrl } } = supabase.storage.from('audio').getPublicUrl(fileName)

        await supabase.from('speaking_tests').insert({
          student_id: profile.id,
          level,
          audio_url: publicUrl,
          transcript: data.transcript,
          score_fluency: data.scores?.fluency || 0,
          score_vocabulary: data.scores?.vocabulary || 0,
          score_grammar: data.scores?.grammar || 0,
          score_communication: data.scores?.communication || 0,
          total_score: data.total || 0,
          max_score: ['B1', 'B2'].includes(level) ? 20 : 16,
          feedback: data.feedback,
          next_level_eligible: data.nextLevelEligible,
        })
      }
    } catch (e) {
      setResult({ error: true, feedback: 'エラーが発生しました。もう一度お試しください。' })
    }
    setScoring(false)
  }

  const formatTime = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`
  const maxScore = level && ['B1','B2'].includes(level) ? 20 : 16

  return (
    <div className="min-h-screen bg-[#F4F7F0] pb-8">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => { if (state === 'select-level') router.back(); else setState('select-level'); setTaskIndex(0); setTaskAudios([]) }}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <h1 className="text-base font-semibold text-secondary">スピーキングテスト</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* レベル選択 */}
        {state === 'select-level' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Mic size={28} className="text-purple-600" />
              </div>
              <p className="text-sm text-gray-500">テストを受けるレベルを選んでください</p>
            </div>
            {LEVELS.map(l => (
              <button key={l} onClick={() => { setLevel(l); setState('intro') }}
                className="w-full bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-primary transition flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                  l === 'A1' ? 'bg-green-100 text-green-700' :
                  l === 'A2' ? 'bg-blue-100 text-blue-700' :
                  l === 'B1' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>{l}</div>
                <div className="text-left flex-1">
                  <p className="text-sm font-semibold text-secondary">CEFR {l}</p>
                  <p className="text-xs text-gray-400">
                    {l === 'A1' ? '初心者・英語ほぼゼロから' :
                     l === 'A2' ? '単語は知ってるが話せない' :
                     l === 'B1' ? '話せるが流暢さが足りない' :
                     '実践で通用するレベルへ'}
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            ))}
          </div>
        )}

        {/* テスト説明 */}
        {state === 'intro' && level && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-base font-semibold text-secondary mb-3">テストについて</h2>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex gap-3"><span className="text-primary font-bold">01</span><p>4つのタスクに音声で回答します</p></div>
                <div className="flex gap-3"><span className="text-primary font-bold">02</span><p>各タスクで録音ボタンを押して話してください</p></div>
                <div className="flex gap-3"><span className="text-primary font-bold">03</span><p>終了後にAIが自動採点します（約1分）</p></div>
                <div className="flex gap-3"><span className="text-primary font-bold">04</span><p>結果は成長記録に自動保存されます</p></div>
              </div>
              <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500">所要時間：約{level === 'B2' ? '20' : level === 'B1' ? '18' : '15'}分</p>
                <p className="text-xs text-gray-500">満点：{['B1','B2'].includes(level) ? '20' : '16'}点</p>
              </div>
            </div>
            <button onClick={() => setState('task')}
              className="w-full bg-primary text-white font-medium py-3.5 rounded-2xl text-sm hover:bg-primary-dark transition">
              テストを開始する
            </button>
          </div>
        )}

        {/* タスク録音 */}
        {state === 'task' && level && (
          <div className="space-y-4">
            {/* 進捗 */}
            <div className="flex gap-1.5 mb-2">
              {TASKS[level].map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i < taskIndex ? 'bg-primary' : i === taskIndex ? 'bg-primary/50' : 'bg-gray-200'}`} />
              ))}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  Task {taskIndex + 1}/{TASKS[level].length}
                </span>
              </div>
              <h2 className="text-base font-semibold text-secondary mb-3">
                {TASKS[level][taskIndex].title}
              </h2>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {TASKS[level][taskIndex].instruction}
                </p>
              </div>
            </div>

            {/* 録音コントロール */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              {taskAudios.length > taskIndex ? (
                <div className="space-y-3">
                  <p className="text-xs text-center text-gray-400 mb-2">録音完了</p>
                  <audio
                    src={URL.createObjectURL(taskAudios[taskIndex])}
                    controls className="w-full"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setTaskAudios(prev => prev.slice(0, taskIndex))
                      }}
                      className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition">
                      <RotateCcw size={12} /> 撮り直す
                    </button>
                    <button onClick={nextTask}
                      className="flex-1 bg-primary text-white text-sm font-medium py-2 rounded-xl hover:bg-primary-dark transition">
                      {taskIndex < TASKS[level].length - 1 ? '次のタスクへ →' : '採点する'}
                    </button>
                  </div>
                </div>
              ) : isRecording ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center recording-pulse shadow-lg">
                    <Mic size={28} className="text-white" />
                  </div>
                  <p className="text-2xl font-mono text-red-500">{formatTime(recordingTime)}</p>
                  <p className="text-xs text-gray-400">話し終えたら停止してください</p>
                  <button onClick={stopRecording}
                    className="flex items-center gap-2 bg-red-50 text-red-600 text-sm font-medium px-6 py-2.5 rounded-xl border border-red-200 hover:bg-red-100 transition">
                    <MicOff size={16} /> 録音を停止
                  </button>
                </div>
              ) : (
                <button onClick={startRecording}
                  className="w-full flex flex-col items-center gap-3 py-8 border-2 border-dashed border-gray-200 rounded-2xl hover:border-primary hover:bg-green-50/50 transition">
                  <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                    <Mic size={24} className="text-primary" />
                  </div>
                  <p className="text-sm font-medium text-secondary">タップして録音開始</p>
                  <p className="text-xs text-gray-400">目安時間：{formatTime(TASKS[level][taskIndex].time)}</p>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 結果 */}
        {state === 'result' && (
          <div className="space-y-4">
            {scoring ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-secondary">AIが採点中です...</p>
                <p className="text-xs text-gray-400">約30〜60秒かかります</p>
              </div>
            ) : result ? (
              <>
                {/* スコアサマリー */}
                <div className={`rounded-2xl p-5 text-center ${result.error ? 'bg-red-50 border border-red-200' : 'bg-secondary text-white'}`}>
                  {result.error ? (
                    <p className="text-sm text-red-600">{result.feedback}</p>
                  ) : (
                    <>
                      <p className="text-xs opacity-60 mb-1">合計スコア</p>
                      <p className="text-5xl font-bold mb-1">
                        {result.total}<span className="text-2xl opacity-60">/{maxScore}</span>
                      </p>
                      <p className="text-sm opacity-70">
                        {result.nextLevelEligible ? '🎉 次のレベルに進級できます！' : 'もう少し練習しましょう'}
                      </p>
                    </>
                  )}
                </div>

                {/* 詳細スコア */}
                {result.scores && (
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-secondary mb-3">詳細スコア</h3>
                    {[
                      { key: 'fluency', label: '流暢さ' },
                      { key: 'vocabulary', label: '語彙・表現' },
                      { key: 'grammar', label: '文法' },
                      { key: 'communication', label: 'コミュニケーション力' },
                    ].map(item => {
                      const score = result.scores[item.key] || 0
                      const max = ['B1','B2'].includes(level || '') ? 5 : 4
                      return (
                        <div key={item.key} className="mb-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">{item.label}</span>
                            <span className="font-medium text-secondary">{score}/{max}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${(score / max) * 100}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* フィードバック */}
                {result.feedback && (
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-semibold text-secondary mb-2">💬 フィードバック</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{result.feedback}</p>
                  </div>
                )}

                <button onClick={() => { setState('select-level'); setTaskIndex(0); setTaskAudios([]); setResult(null) }}
                  className="w-full bg-primary text-white font-medium py-3.5 rounded-2xl text-sm hover:bg-primary-dark transition">
                  もう一度受ける
                </button>
                <button onClick={() => router.push('/progress')}
                  className="w-full text-sm text-gray-500 py-2">
                  成長記録で確認する
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
