export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { style, height, weight, squat1rm, deadlift1rm, bench1rm, experience, days_per_week, session_minutes } = req.body;
  if (!style || !height || !weight) return res.status(400).json({ error: '請填寫必要欄位' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI 服務未設定，請聯繫教練' });

  const styleMap = { crossfit: 'CrossFit（功能性體能）', bodybuilding: '健美（肌肥大）', powerlifting: '健力（最大肌力）' };
  const expMap = { beginner: '初學者（< 1年）', intermediate: '中級（1-3年）', advanced: '進階（3年以上）' };

  const has1rm = squat1rm || deadlift1rm || bench1rm;
  const oneRmText = has1rm
    ? `已知最大重量：深蹲 ${squat1rm||'未填'}kg、硬舉 ${deadlift1rm||'未填'}kg、臥推 ${bench1rm||'未填'}kg`
    : '尚未測過最大重量';

  const days = parseInt(days_per_week) || 3;
  const mins = parseInt(session_minutes) || 60;
  const week2Start = days + 1;

  const prompt = `你是一位專業的肌力與體能訓練教練，幫學員設計個人化訓練課表。

【學員資料】
- 訓練風格：${styleMap[style] || style}
- 身高：${height} cm，體重：${weight} kg
- 訓練經驗：${expMap[experience] || experience}
- ${oneRmText}
- 每週訓練天數：${days} 天（最多5天）
- 每次訓練時間：${mins} 分鐘

【時間分配原則】
- 30分鐘：單一主題，最多6個動作，省略獨立熱身緩和
- 60分鐘：熱身10分 + 主訓練40分（力量或WOD）+ 緩和10分
- 90分鐘：熱身10分 + 力量主項30分 + WOD或代謝20分 + 緩和10分
- 120分鐘：熱身10分 + 技術20分 + 力量30分 + WOD/代謝30分 + 緩和10分

【課表設計規則】
- 以兩週為一個週期，只輸出訓練日（不含休息日），休息日安排寫在 rest_note 欄位
- CrossFit 風格：包含 WOD（For Time / AMRAP / EMOM 格式）和每日力量訓練
- 健美風格：推拉腿分化，8-15下高次數
- 健力風格：深蹲臥推硬舉為核心，3-5下低次數
- 重量用百分比標示（@60%等）；沒有最大重量用「體重的X%」或「中等重量」
- 第二週訓練日難度比第一週提升（重量+5% 或組數+1）
- 不要使用任何表情符號（emoji）
- 每個 section 最多 4 個動作，每天最多 3 個 section
- note 欄位非必要時留空字串 ""

【輸出格式】
只輸出合法 JSON，不要任何 markdown、不要 code fence、不要解釋文字，直接從 { 開始到 } 結束。

第一週訓練日編號 1 到 ${days}，第二週訓練日編號 ${week2Start} 到 ${days * 2}。

{
  "analysis": "教練分析，3-4句，說明推薦的訓練結構與原因",
  "split_name": "課表分化名稱（例：推拉腿三分化 / 全身性 / CrossFit WOD）",
  "rest_note": "休息日建議，一句話（例：訓練日之間穿插休息，建議連續訓練不超過2天）",
  "weeks": [
    {
      "week": 1,
      "days": [
        {
          "day_number": 1,
          "day_label": "推力日",
          "focus": "上肢推力",
          "workout_type": "Strength + Accessory",
          "sections": [
            {
              "label": "力量主項",
              "movements": [
                { "name": "臥推 Bench Press", "volume": "5組 × 5下", "intensity": "@80%", "note": "" },
                { "name": "啞鈴肩推 DB Press", "volume": "4組 × 8下", "intensity": "@65%", "note": "" }
              ]
            },
            {
              "label": "輔助訓練",
              "movements": [
                { "name": "繩索夾胸 Cable Fly", "volume": "3組 × 12下", "intensity": "中等重量", "note": "" }
              ]
            }
          ],
          "notes": ""
        }
      ]
    },
    {
      "week": 2,
      "days": [
        {
          "day_number": ${week2Start},
          "day_label": "推力日",
          "focus": "上肢推力（進階）",
          "workout_type": "Strength + Accessory",
          "sections": [],
          "notes": ""
        }
      ]
    }
  ]
}

每週 days 陣列只包含訓練日，共 ${days} 天。不要輸出休息日。
使用繁體中文，動作名稱必須用台灣 CrossFit 社群慣用術語，附英文縮寫。
常用對照（務必依此用法）：
- 深蹲 Back Squat、前蹲舉 Front Squat、過頭蹲 Overhead Squat
- 硬舉 Deadlift（不說「硬拉」）、羅馬尼亞硬舉 RDL、相撲硬舉 Sumo DL
- 肩推 Shoulder Press、推舉 Push Press、挺舉 Push Jerk / Split Jerk
- 上搏 Clean、抓舉 Snatch、上膊 Power Clean、懸掛式上搏 Hang Clean
- 臥推 Bench Press、啞鈴臥推 DB Bench、窄握臥推 Close-grip Bench
- 引體向上 Pull-up、跳躍引體向上 Jumping Pull-up、環上引體 Ring Pull-up
- 肌肉上槓 Muscle-up、雙槓撐體 Dip、倒立推 HSPU
- 壺鈴擺盪 KB Swing、壺鈴上搏 KB Clean、土耳其起立 Turkish Get-up
- 農夫走路 Farmer's Carry、負重行走 Weighted Walk
- 箱跳 Box Jump、跨步蹲 Lunge、保加利亞分腿蹲 Bulgarian Split Squat
- 划船 Row（機器：划船機 Rowing Erg）、跳繩 Jump Rope、雙迴旋 Double Under
- 捲腹 Sit-up、棒式 Plank、死蟲式 Dead Bug、超人式 Superman
- 波比 Burpee、拖雪橇 Sled Push/Pull、攀繩 Rope Climb`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || `API Error ${response.status}`);

    const text = data.content?.[0]?.text || '';
    let plan;
    try {
      plan = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI 回傳格式錯誤，請重試');
      plan = JSON.parse(match[0]);
    }
    res.json({ plan });
  } catch (e) {
    res.status(500).json({ error: e.message || 'AI 服務暫時無法使用，請稍後再試' });
  }
}
