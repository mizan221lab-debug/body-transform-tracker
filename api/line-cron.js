// Called by Vercel Cron: POST /api/line-cron?job=morning|evening|weekly
const SUPABASE_URL = 'https://ijecyjtpwbnapnqxaazc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZWN5anRwd2JuYXBucXhhYXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NjA0NjgsImV4cCI6MjA4OTMzNjQ2OH0.KyyLfIb0kMNQxdISOEZ_6qA2uq5ueH8xD3tE59NqZ0A';
const LINE_TOKEN = 'MdifyfF47K3ijYAhGrSjUcxuPeI74OTGe8G+8S+tzglMnWBcCOjgqDpwe84F3kstullxvnroAlijVsRPjElK9vlJ+xsmIecPgH6yYORW0+k4FvFYLwdUdZFya/EhI5ZiM+Anh800102xIHtck9wA3wdB04t89/1O/w1cDnyilFU=';
const USER_ID = process.env.LINE_USER_ID || '';

const PLAN = [
  { day: 'จ',  type: 'LISS',      icon: '🚶', desc: 'เดินเร็ว 40 นาที', mins: 40 },
  { day: 'อ',  type: 'Recovery',  icon: '🧘', desc: 'ยืดเหยียด 25 นาที', mins: 25 },
  { day: 'พ',  type: 'Home WO',   icon: '🏠', desc: 'Home Workout 60 นาที', mins: 60 },
  { day: 'พฤ', type: 'LISS',      icon: '🚴', desc: 'เดินเร็ว 40 นาที', mins: 40 },
  { day: 'ศ',  type: 'Gym Coach', icon: '🏋️', desc: 'อก ไหล่ หลังแขน', mins: 67 },
  { day: 'ส',  type: 'Rest',      icon: '🌿', desc: 'พักผ่อน', mins: 0 },
  { day: 'อา', type: 'Gym Coach', icon: '🏋️', desc: 'ขา หลัง หน้าแขน', mins: 67 },
];
const SB_HDR = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
const sbGet = async (p) => (await fetch(`${SUPABASE_URL}/rest/v1/${p}`, { headers: SB_HDR })).json();
const todayBKK = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).toISOString().split('T')[0];
const dowBKK = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).getDay();

async function push(text) {
  if (!USER_ID) return;
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${LINE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: USER_ID, messages: [{ type: 'text', text }] })
  });
}

export default async function handler(req, res) {
  const job = (req.query?.job || 'morning').toLowerCase();
  const d = todayBKK();
  const planIdx = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }[dowBKK()];
  const p = PLAN[planIdx];

  if (job === 'morning') {
    await push(`☀️ อรุณสวัสดิ์!\n\n${p.icon} วันนี้ (${p.day}) — ${p.type}\n${p.desc}${p.mins ? '\n⏱ ' + p.mins + ' นาที' : ''}\n\n💪 ลุยเลย!`);
  } else if (job === 'evening') {
    const [w, wo, ci] = await Promise.all([
      sbGet(`weight_logs?select=weight_kg&date=eq.${d}`),
      sbGet(`workout_logs?select=completed&date=eq.${d}`),
      sbGet(`daily_checkins?select=*&date=eq.${d}`),
    ]);
    const missing = [];
    if (!w?.length) missing.push('น้ำหนัก');
    if (p.type !== 'Rest' && !wo?.[0]?.completed) missing.push('ออกกำลัง');
    if (!ci?.length) missing.push('check-in');
    if (missing.length) {
      await push(`🌙 อย่าลืมบันทึก: ${missing.join(', ')}\nพิมพ์ได้เลยใน LINE นี้`);
    }
  } else if (job === 'weekly') {
    const weekAgo = new Date(d); weekAgo.setDate(weekAgo.getDate() - 7);
    const ws = weekAgo.toISOString().split('T')[0];
    const [weights, workouts] = await Promise.all([
      sbGet(`weight_logs?date=gte.${ws}&order=date.asc`),
      sbGet(`workout_logs?date=gte.${ws}`),
    ]);
    const wStart = weights[0]?.weight_kg, wEnd = weights[weights.length - 1]?.weight_kg;
    const diff = wStart && wEnd ? (wEnd - wStart).toFixed(2) : '?';
    const comp = workouts.filter(w => w.completed).length;
    await push(`📊 สรุปสัปดาห์\n━━━━━━━━━━━━━━\n⚖️ ${wStart || '?'} → ${wEnd || '?'} kg (${diff})\n🏋️ ออกกำลัง ${comp}/6 ครั้ง\n\n💪 สัปดาห์ใหม่ เริ่มใหม่!`);
  }
  res.status(200).json({ ok: true, job });
}
