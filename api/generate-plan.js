export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { style, height, weight, squat1rm, deadlift1rm, bench1rm, experience } = req.body;
  if (!style || !height || !weight) return res.status(400).json({ error: '請填寫必要欄位' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI 服務未設定，請聯繫教練' });

  const styleMap = { crossfit: 'CrossFit（功能性體能）', bodybuilding: '健美（肌肥大）', powerlifting: '健力（最大肌力）' };
  const expMap = { beginner: '初學者（< 1年）', intermediate: '中級（1-3年）', advanced: '進階（3年以上）' };

  const has1rm = squat1rm || deadlift1rm || bench1rm;
  const oneRmText = has1rm
    ? `已知最大重量：深蹲 ${squat1rm||'未填'}kg、硬舉 ${deadlift1rm||'未填'}kg、臥推 ${bench1rm||'未填'}kg`
    : '尚未測過最大重量';

  const prompt = `你是一位專業的肌力與體能訓練教練，幫學員設計個人化訓練課表。請勿使用任何表情符號（emoji）。

【學員資料】
- 訓練風格：${styleMap[style] || style}
- 身高：${height} cm，體重：${weight} kg
- 訓練經驗：${expMap[experience] || experience}
- ${oneRmText}

【輸出格式要求】
1. 先輸出一段「教練分析」（3-4句），根據學員數據說明：推薦每週訓練幾天、選擇此頻率的原因、最適合的訓練結構。
2. 接著輸出「第一週」和「第二週」的完整課表。
3. 每天格式如下：
   - 標題：週X｜訓練主題（例：推力日、下肢肌力、WOD等）
   - 動作清單：每個動作一行，格式為「動作名稱：X組 × X下 @X%」
   - 如果是休息日或動態恢復日，直接寫「休息日」或「動態恢復」
4. 重量統一用百分比標示（@60%、@75%等），對應學員的最大重量或體重。如果沒有最大重量，用「體重的X%」或「中等重量」描述。
5. CrossFit 風格：包含 WOD（For Time / AMRAP / EMOM 格式）+ 每日力量訓練。
   健美風格：推拉腿分化，8-15下高次數組數。
   健力風格：深蹲臥推硬舉為核心，3-5下低次數重訓。
6. 第二週難度比第一週稍微提升（重量+5% 或組數+1）。
7. 最後加一行提醒：「📸 請截圖或下載課表，離開頁面後資料將消失。」

使用繁體中文，台灣健身常用術語。動作名稱用中文，必要時附英文。`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || `API Error ${response.status}`);

    const plan = data.content?.[0]?.text || '';
    res.json({ plan });
  } catch (e) {
    res.status(500).json({ error: e.message || 'AI 服務暫時無法使用，請稍後再試' });
  }
}
