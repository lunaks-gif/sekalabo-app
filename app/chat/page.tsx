'use client'
// app/chat/page.tsx
// リアルタイムチャット画面

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Send, Mic, MicOff, ArrowLeft, Paperclip } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Message, Profile, ChatRoom } from '@/types'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [text, setText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    initChat()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const initChat = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    setProfile(profileData)

    // チャットルームを取得または作成
    let { data: roomData } = await supabase
      .from('chat_rooms')
      .select('*, student:student_id(full_name), teacher:teacher_id(full_name)')
      .or(`student_id.eq.${user.id},teacher_id.eq.${user.id}`)
      .single()

    if (!roomData) return
    setRoom(roomData)

    // メッセージ取得
    const { data: msgs } = await supabase
      .from('messages')
      .select('*, sender:sender_id(full_name, avatar_url)')
      .eq('room_id', roomData.id)
      .order('created_at', { ascending: true })
    setMessages(msgs || [])

    // 未読を既読に
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('room_id', roomData.id)
      .neq('sender_id', user.id)

    // リアルタイム購読
    const channel = supabase
      .channel(`room:${roomData.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomData.id}`,
      }, async (payload) => {
        const { data: newMsg } = await supabase
          .from('messages')
          .select('*, sender:sender_id(full_name, avatar_url)')
          .eq('id', payload.new.id)
          .single()
        if (newMsg) {
          setMessages(prev => [...prev, newMsg])
          // 自分以外のメッセージは既読に
          if (newMsg.sender_id !== user.id) {
            await supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', newMsg.id)
          }
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }

  const sendText = async () => {
    if (!text.trim() || !room || !profile || sending) return
    setSending(true)
    const content = text.trim()
    setText('')

    await supabase.from('messages').insert({
      room_id: room.id,
      sender_id: profile.id,
      content,
      type: 'text',
    })
    setSending(false)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        await uploadAudio()
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)
    } catch (e) {
      alert('マイクへのアクセスを許可してください')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)
  }

  const uploadAudio = async () => {
    if (!room || !profile) return
    setSending(true)

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const fileName = `${room.id}/${Date.now()}.webm`

    const { data } = await supabase.storage
      .from('audio')
      .upload(fileName, blob)

    if (data) {
      const { data: { publicUrl } } = supabase.storage
        .from('audio')
        .getPublicUrl(fileName)

      await supabase.from('messages').insert({
        room_id: room.id,
        sender_id: profile.id,
        content: '🎤 音声メッセージ',
        type: 'audio',
        file_url: publicUrl,
        duration: recordingTime,
      })
    }
    setSending(false)
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const otherPerson = profile?.role === 'student'
    ? (room?.teacher as any)?.full_name
    : (room?.student as any)?.full_name

  return (
    <div className="h-screen bg-[#F4F7F0] flex flex-col">

      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-white font-semibold text-sm">
          {otherPerson?.[0] || '?'}
        </div>
        <div>
          <p className="text-sm font-semibold text-secondary">{otherPerson || '講師'}</p>
          <p className="text-xs text-green-500">オンライン</p>
        </div>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === profile?.id
          const showDate = i === 0 || format(new Date(messages[i-1].created_at), 'yyyy-MM-dd') !== format(new Date(msg.created_at), 'yyyy-MM-dd')

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="text-center text-xs text-gray-400 my-2">
                  {format(new Date(msg.created_at), 'M月d日（E）', { locale: ja })}
                </div>
              )}
              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                {!isMe && (
                  <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-auto">
                    {(msg.sender as any)?.full_name?.[0] || '?'}
                  </div>
                )}
                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  {msg.type === 'audio' ? (
                    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl ${isMe ? 'bg-primary text-white rounded-br-sm' : 'bg-white text-secondary rounded-bl-sm shadow-sm'}`}>
                      <Mic size={14} className={isMe ? 'text-white/80' : 'text-primary'} />
                      <audio src={msg.file_url} controls className="h-6 w-32" />
                      <span className="text-xs opacity-70">{formatTime(msg.duration || 0)}</span>
                    </div>
                  ) : (
                    <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-primary text-white rounded-br-sm' : 'bg-white text-secondary rounded-bl-sm shadow-sm'}`}>
                      {msg.content}
                    </div>
                  )}
                  <span className="text-[10px] text-gray-400">
                    {format(new Date(msg.created_at), 'HH:mm')}
                    {isMe && msg.is_read && ' ✓✓'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* 入力エリア */}
      <div className="bg-white border-t border-gray-100 px-3 py-3 pb-safe">
        {isRecording ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 bg-red-50 rounded-2xl px-4 py-3">
              <div className="w-2 h-2 bg-red-500 rounded-full recording-pulse" />
              <span className="text-sm text-red-600 font-medium">録音中... {formatTime(recordingTime)}</span>
            </div>
            <button
              onClick={stopRecording}
              className="w-11 h-11 bg-red-500 rounded-full flex items-center justify-center shadow-md"
            >
              <MicOff size={18} className="text-white" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1 flex items-end gap-2 bg-gray-100 rounded-2xl px-4 py-2">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendText()
                  }
                }}
                placeholder="メッセージを入力..."
                rows={1}
                className="flex-1 bg-transparent text-sm resize-none outline-none max-h-24 text-secondary placeholder-gray-400"
              />
            </div>
            {text.trim() ? (
              <button
                onClick={sendText}
                disabled={sending}
                className="w-11 h-11 bg-primary rounded-full flex items-center justify-center shadow-md disabled:opacity-60 flex-shrink-0"
              >
                <Send size={16} className="text-white" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="w-11 h-11 bg-secondary rounded-full flex items-center justify-center shadow-md flex-shrink-0"
              >
                <Mic size={16} className="text-white" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
