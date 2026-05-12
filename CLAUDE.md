# 4SC CrossFit 會員平台

Simon Chi（季祥）的 CrossFit 場館會員平台。

## 基本資訊

- **線上網址**: https://4sc-members.vercel.app
- **部署**: `vercel --prod`（在這個目錄執行）
- **後台**: https://4sc-members.vercel.app/admin.html（只有 simonchi0224@gmail.com 可登入）

## 技術架構

- 純靜態 HTML/JS，無 framework
- **Auth + DB**: Supabase（URL: https://ddttoxfhodhefaqgdnsj.supabase.co）
  - anon key 用舊 JWT 格式（在 config.js），不是 sb_publishable_ 格式
- **AI 反饋**: Vercel serverless `/api/ai-feedback.js` → OpenAI GPT-4o-mini
  - API key 存在 Vercel env var `OPENAI_API_KEY`，不在程式碼裡
- **課表**: `data/wod.json`（flat days array，49天）

## 重要 Supabase 設定

Tables: `members`, `personal_records`, `training_logs`

RLS policies on `members`:
- 學員只能讀/寫自己的資料
- Admin（simonchi0224@gmail.com）可以讀取並更新所有人

## 已知問題

- OpenAI API Key 目前失效 → Simon 需去 platform.openai.com 換新 key → 貼到 Vercel env var → 重新部署

## 常見坑

- Supabase anon key 必須用 JWT 格式（eyJ...），不能用新的 sb_publishable_ 格式（supabase-js@2 不支援）
- WOD tab 日期判斷要用本地時間（getFullYear/getMonth/getDate），不能用 UTC
- `members` table 需要 `GRANT SELECT, INSERT, UPDATE ON members TO authenticated;` 才能讓 RLS 生效
