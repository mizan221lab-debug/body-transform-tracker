export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, userId, message } = req.body;
  if (!token || !userId || !message) {
    return res.status(400).json({ error: 'token, userId and message are required' });
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: message }]
      }),
    });

    if (response.ok) {
      return res.status(200).json({ status: 200, message: 'ok' });
    } else {
      const data = await response.json();
      return res.status(response.status).json(data);
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
