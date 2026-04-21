// app/api/webhook/route.ts
// LINE Webhook：新規問い合わせ・体験申込みの自動対応

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

function verifySignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('sha256', process.env.LINE_CHANNEL_SECRET!)
    .update(body)
    .digest('base64')
  return hash === signature
}

async function reply(replyToken: string, messages: any[]) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-line-signature') || ''

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const body = JSON.parse(rawBody)

  for (const event of body.events || []) {
    if (event.type !== 'message' || event.message.type !== 'text') continue

    const { replyToken, source, message } = event
    const userId = source.userId
    const text = message.text.trim()

    // フォロー時の初回メッセージ
    if (event.type === 'follow') {
      await reply(replyToken, [{
        type: 'text',
        text: `🌱 SEKALABOへようこそ！

「世界を学び、人生を変える。」

全講師バイリンガル・資格保有のオンライン英会話スクールです。

━━━━━━━━━━
📌 メニュー
━━━━━━━━━━
「体験」→ 無料体験を申し込む
「料金」→ プランと料金を見る
「講師」→ 講師紹介を見る
「質問」→ よくある質問

まずは無料体験から始めてみませんか？`
      }])
      continue
    }

    // 体験申込み
    if (text.includes('体験') || text.includes('申込') || text.includes('申し込み')) {
      await reply(replyToken, [
        {
          type: 'text',
          text: `✨ 無料体験レッスンにご興味いただきありがとうございます！

以下の情報を教えてください：

1️⃣ お名前
2️⃣ ご希望のコース
   ・キッズ英会話（小学生）
   ・大人英会話（中学生以上）
   ・CA・TOEIC対策
3️⃣ ご希望の曜日・時間帯

折り返し担当者からご連絡いたします 😊`
        }
      ])
      continue
    }

    // 料金案内
    if (text.includes('料金') || text.includes('値段') || text.includes('価格') || text.includes('いくら')) {
      await reply(replyToken, [
        {
          type: 'text',
          text: `💰 SEKALABOの料金プラン

━━━━━━━━━━
👶 キッズ英会話
月4回・60分
セミグループ：¥10,000/月
マンツーマン：¥15,000/月

━━━━━━━━━━
👩 大人・中学生以上
月4時間・マンツーマン
¥25,000/月

━━━━━━━━━━
✈️ CA・TOEIC対策
¥25,000/講座

━━━━━━━━━━
✦ 全講師バイリンガル資格保有
✦ 年3回の面談付き
✦ 留学・ワーホリ提携あり

「体験」と送ると無料体験を申し込めます！`
        }
      ])
      continue
    }

    // 講師紹介
    if (text.includes('講師') || text.includes('先生')) {
      await reply(replyToken, [
        {
          type: 'text',
          text: `👩‍🏫 SEKALABOの講師について

━━━━━━━━━━
✦ 全員バイリンガル（日英両対応）
✦ 英語教育の資格保有
✦ 日本人講師・外国人講師在籍

━━━━━━━━━━
代表の嘉瀬は：
・高校中退→高卒認定→大学英文科卒
・世界一周バックパック経験
・通訳・翻訳の実績あり
・英語で人生が変わった当事者

生徒に寄り添い、英語で世界への扉を開くサポートをします 🌍

「体験」と送ると無料体験を申し込めます！`
        }
      ])
      continue
    }

    // デフォルト返信
    await reply(replyToken, [
      {
        type: 'text',
        text: `メッセージありがとうございます！

📌 以下のキーワードで案内できます：
「体験」「料金」「講師」「質問」

お急ぎの場合は担当者が直接ご返信いたします 😊`
      }
    ])
  }

  return NextResponse.json({ status: 'ok' })
}
