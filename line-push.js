export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const CHANNEL_ACCESS_TOKEN = 'MdifyfF47K3ijYAhGrSjUcxuPeI74OTGe8G+8S+tzglMnWBcCOjgqDpwe84F3kstullxvnroAlijVsRPjElK9vlJ+xsmIecPgH6yYORW0+k4FvFYLwdUdZFya/EhI5ZiM+Anh800102xIHtck9wA3wdB04t89/1O/w1cDnyilFU=';
  const USER_ID = 'U04074f63f0c9d1bd0ce20f67c59e23fe';

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: USER_ID,
        messages: [{ type: 'text', text: message }]
      }),
    });

    const data = await response.json();
    if (response.ok) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(response.status).json({ error: data.message || 'LINE API error', detail: data });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
