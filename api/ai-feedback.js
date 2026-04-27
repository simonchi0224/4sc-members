const OFF_TOPIC_PATTERN = /^(請問|請幫|幫我|你好|hi |hello|你是|你能|告訴我|能不能|可以幫|寫一|生成|解釋一下)/i;

// 筆記內容明顯與訓練無關的模式（不限開頭）
const NON_TRAINING_NOTES_PATTERN = /(好看|好吃|好喝|電影|電視|追劇|生日|過節|旅遊|購物|今天天氣|最近|朋友|小孩|兒子|女兒|老婆|老公|男友|女友|上班|工作|開會|睡覺|肚子餓|想吃)/;

const CANNED_REJECTION = '本系統只支援反饋你的訓練結果，請填寫今日使用重量、完成情況或身體感受，我會根據你的訓練記錄給予回饋。';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { wod_name, wod_type, wod_description, result, notes, gender, member_name } = req.body;

  if (!wod_name) return res.status(400).json({ error: '缺少必要資料' });
  if (!result && !notes) return res.status(400).json({ error: '請填寫訓練記錄或筆記後再取得 AI 回饋' });

  // 第一層：本地預檢，非訓練問題直接擋回不消耗 API
  const inputText = `${result || ''} ${notes || ''}`.trim();
  if (OFF_TOPIC_PATTERN.test(inputText)) {
    return res.json({ feedback: CANNED_REJECTION });
  }

  // 第二層：筆記內容明顯是生活閒聊則擋回（只有筆記、沒有動作記錄時）
  const hasMovementResult = result && result !== '完成時間：' && result.trim().length > 0;
  if (!hasMovementResult && notes && NON_TRAINING_NOTES_PATTERN.test(notes)) {
    return res.json({ feedback: CANNED_REJECTION });
  }

  const systemPrompt = `你是 4SC CrossFit 的 AI 教練助理。
你的唯一職責是根據學員填寫的訓練記錄給予回饋。

重要判斷規則：
- 只根據「學員記錄」和「學員筆記」欄位判斷，不要自行用訓練內容推測
- 如果學員筆記完全是與訓練無關的內容（日常生活、家庭、食物、娛樂等），即使有完成時間，也必須拒絕
- 拒絕時直接回覆：「本系統只支援反饋你的訓練結果，請填寫今日使用重量、完成情況或身體感受。」

若內容是合法的訓練記錄，請嚴格使用以下格式（繁體中文）：

🔥 **今日表現**
（1-2句鼓勵，認可學員今天的努力與具體成就）

📊 **弱項觀察**
（根據使用重量、降階選擇、完成情況，指出 1-2 個需加強的環節；資訊不足時根據動作類型推測）

💡 **下週加強建議**
（針對弱項給出 1-2 個具體動作 + 建議組數與強度）

每段限 2-3 句，簡潔有力。
術語規範：平板支撐（不說「板橋」）、深蹲、硬舉、挺舉、抓舉、跳箱、壁球、引體向上、雙槓撐體。全程使用台灣健身界通用詞彙。`;

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
    if (data.error) {
      return res.status(500).json({ error: `OpenAI 錯誤：${data.error.message}` });
    }
    const feedback = data.choices?.[0]?.message?.content || '';
    res.json({ feedback });
  } catch (e) {
    res.status(500).json({ error: 'AI 服務暫時無法使用，請稍後再試' });
  }
}
