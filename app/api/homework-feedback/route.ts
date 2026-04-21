// app/api/homework-feedback/route.ts
// 宿題音声をWhisperで文字起こし→GeminiでAIフィードバック

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { audioUrl, homeworkTitle, homeworkDescription } = await req.json()

    // 1. 音声ファイルを取得
    const audioRes = await fetch(audioUrl)
    const audioBlob = await audioRes.blob()
    const audioBuffer = await audioBlob.arrayBuffer()

    // 2. Whisperで文字起こし
    const formData = new FormData()
    formData.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), 'audio.webm')
    formData.append('model', 'whisper-1')
    formData.append('language', 'en')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    })

    const whisperData = await whisperRes.json()
    const transcript = whisperData.text || ''

    if (!transcript) {
      return NextResponse.json({
        feedback: '音声を認識できませんでした。もう一度録音してみてください。',
        score: 0,
        transcript: '',
      })
    }

    // 3. Geminiでフィードバック生成
    const prompt = `
あなたは英語教育の専門家です。以下の宿題の音声提出を評価してください。

【宿題のタイトル】
${homeworkTitle}

【宿題の内容・指示】
${homeworkDescription}

【生徒の回答（文字起こし）】
${transcript}

以下の観点で100点満点で採点し、日本語でフィードバックをしてください：
- 内容の適切さ（宿題の指示に答えているか）
- 英語の正確さ（文法・語彙）
- 流暢さ・発音

JSONで返してください：
{
  "score": 数値(0-100),
  "feedback": "フィードバックの文章（200字以内・ポジティブな表現で・具体的な改善点も含む）",
  "strengths": "良かった点",
  "improvements": "改善点"
}
`

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
        }),
      }
    )

    const geminiData = await geminiRes.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

    // JSONパース
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

    return NextResponse.json({
      feedback: result.feedback || 'フィードバックを生成できませんでした。',
      score: result.score || 0,
      strengths: result.strengths || '',
      improvements: result.improvements || '',
      transcript,
    })

  } catch (error) {
    console.error('Homework feedback error:', error)
    return NextResponse.json({
      feedback: 'エラーが発生しました。もう一度お試しください。',
      score: 0,
      transcript: '',
    }, { status: 500 })
  }
}
