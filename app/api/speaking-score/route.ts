// app/api/speaking-score/route.ts
// 音声→文字起こし→Geminiで採点

import { NextRequest, NextResponse } from 'next/server'

const RUBRIC: Record<string, any> = {
  A1: {
    axes: ['fluency', 'vocabulary', 'grammar', 'communication'],
    maxPerAxis: 4,
    total: 16,
    passScore: 10,
    nextLevel: 'A2',
  },
  A2: {
    axes: ['fluency', 'vocabulary', 'grammar', 'communication'],
    maxPerAxis: 4,
    total: 16,
    passScore: 11,
    nextLevel: 'B1',
  },
  B1: {
    axes: ['fluency', 'vocabulary', 'grammar', 'logic'],
    maxPerAxis: 5,
    total: 20,
    passScore: 14,
    nextLevel: 'B2',
  },
  B2: {
    axes: ['fluency', 'vocabulary', 'logic', 'communication'],
    maxPerAxis: 5,
    total: 20,
    passScore: 16,
    nextLevel: 'Graduate',
  },
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const level = formData.get('level') as string
    const tasksJson = formData.get('tasks') as string
    const tasks = JSON.parse(tasksJson || '[]')

    // 全タスクの音声を文字起こし
    const transcripts: string[] = []

    for (let i = 0; i < tasks.length; i++) {
      const audioBlob = formData.get(`audio_${i}`) as Blob | null
      if (!audioBlob) continue

      const audioFormData = new FormData()
      audioFormData.append('file', audioBlob, 'audio.webm')
      audioFormData.append('model', 'whisper-1')
      audioFormData.append('language', 'en')

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        body: audioFormData,
      })

      const whisperData = await whisperRes.json()
      transcripts.push(whisperData.text || '[No speech detected]')
    }

    const fullTranscript = tasks.map((task: string, i: number) =>
      `[Task ${i+1}: ${task}]\n${transcripts[i] || '[No response]'}`
    ).join('\n\n')

    const rubric = RUBRIC[level]

    // Geminiで採点
    const prompt = `
You are an expert English language examiner for CEFR level ${level} students.

Evaluate the following speaking test responses:

${fullTranscript}

Score each axis out of ${rubric.maxPerAxis} points:
${rubric.axes.map((axis: string) => `- ${axis}`).join('\n')}

Total: ${rubric.total} points

Return ONLY valid JSON:
{
  "scores": {
    ${rubric.axes.map((axis: string) => `"${axis}": <number 0-${rubric.maxPerAxis}>`).join(',\n    ')}
  },
  "total": <sum of all scores>,
  "feedback": "<encouraging feedback in Japanese, 150 chars max, mention specific strengths and one improvement>",
  "strengths": "<what they did well in English>",
  "improvements": "<one specific thing to practice>"
}
`

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
        }),
      }
    )

    const geminiData = await geminiRes.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    const scored = jsonMatch ? JSON.parse(jsonMatch[0]) : {
      scores: { fluency: 0, vocabulary: 0, grammar: 0, communication: 0 },
      total: 0,
      feedback: '採点に失敗しました。もう一度お試しください。',
    }

    const nextLevelEligible = (scored.total || 0) >= rubric.passScore

    return NextResponse.json({
      scores: scored.scores,
      total: scored.total,
      feedback: scored.feedback,
      strengths: scored.strengths,
      improvements: scored.improvements,
      transcript: fullTranscript,
      nextLevelEligible,
      passScore: rubric.passScore,
      nextLevel: nextLevelEligible ? rubric.nextLevel : null,
    })

  } catch (error) {
    console.error('Speaking score error:', error)
    return NextResponse.json({
      error: true,
      feedback: 'エラーが発生しました。もう一度お試しください。',
    }, { status: 500 })
  }
}
