import { createClient } from '@supabase/supabase-js';

const DAILY_LIMIT = 5;

// 非訓練相關的問題模式
const OFF_TOPIC_PATTERN = /^(請問|請幫|幫我|你好|hi|hello|你是|你能|告訴我|能不能|可以幫|寫一|生成|解釋一下|什麼是(?!.*(\d|kg|磅|組|次|公尺|卡|分鐘|秒|動作|重量|訓練)))/i;
const CANNED_REJECTION = '本系統只支援反饋你的訓練結果，請填寫今日使用重量、完成情況或身體感受，我會根據你的訓練記錄給予回饋。';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { member_id, wod_name, wod_type, wod_description, result, notes, gender, member_name } = req.body;

  if (!member_id || !wod_name) return res.status(400).json({ error: '缺少必要資料' });
  if (!result && !notes) return res.status(400).json({ error: '請填寫訓練記錄或筆記後再取得 AI 回饋' });

  // 第一層：本地格式預檢，非訓練問題直接擋回，不消耗 API
  const inputText = `${result || ''} ${notes || ''}`.trim();
  if (OFF_TOPIC_PATTERN.test(inputText)) {
    return res.json({ feedback: CANNED_REJECTION });
  }

  // 第二層：每日使用次數限制
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const today = new Date().toISOString().split('T')[0];
  const { count } = await sb.from('training_logs')
    .select('*', { count: 'exact', head: true })
    .eq('member_id', member_id)
    .eq('date', today)
    .not('ai_feedback', 'is', null);

  if ((count || 0) >= DAILY_LIMIT) {
    return res.status(429).json({ error: `今日 AI 回饋已達上限（${DAILY_LIMIT} 次），明天再來！` });
  }

  // 第三層：GPT system prompt 只允許訓練回饋，非訓練問題由 GPT 婉拒
  const systemPrompt = `你是 4SC CrossFit 的 AI 教練助理。
你的唯一職責是根據學員填寫的訓練記錄給予回饋。
若學員輸入的內容不是訓練記錄（例如：問你閒聊、問非訓練問題、測試你），請直接回覆：「本系統只支援反饋你的訓練結果，請填寫今日使用重量、完成情況或身體感受。」，不做其他回應。

若內容是合法的訓練記錄，請嚴格使用以下格式回覆（繁體中文）：

🔥 **今日表現**
（1-2句鼓勵，認可學員今天的努力與具體成就）

📊 **弱項觀察**
（根據使用重量、降階選擇、完成情況，指出 1-2 個需加強的環節；資訊不足時根據動作類型推測）

💡 **下週加強建議**
（針對弱項給出 1-2 個具體動作 + 建議組數與強度）

每段限 2-3 句，簡潔有力，不加多餘說明。`;

  const userMsg = `學員：${member_name || '學員'}（${gender === 'male' ? '男' : '女'}）
今日 WOD：${wod_name}（${wod_type}）
訓練內容：${wod_description}
學員記錄：\n${result || '（未填）'}
學員筆記：${notes || '（未填）'}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg }
        ]
      })
    });

    const data = await response.json();
    const feedback = data.choices?.[0]?.message?.content || '';
    res.json({ feedback });
  } catch (e) {
    res.status(500).json({ error: 'AI 服務暫時無法使用，請稍後再試' });
  }
}
