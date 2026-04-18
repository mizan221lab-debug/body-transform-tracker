const SUPABASE_URL = 'https://ijecyjtpwbnapnqxaazc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZWN5anRwd2JuYXBucXhhYXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NjA0NjgsImV4cCI6MjA4OTMzNjQ2OH0.KyyLfIb0kMNQxdISOEZ_6qA2uq5ueH8xD3tE59NqZ0A';
const LINE_TOKEN = 'MdifyfF47K3ijYAhGrSjUcxuPeI74OTGe8G+8S+tzglMnWBcCOjgqDpwe84F3kstullxvnroAlijVsRPjElK9vlJ+xsmIecPgH6yYORW0+k4FvFYLwdUdZFya/EhI5ZiM+Anh800102xIHtck9wA3wdB04t89/1O/w1cDnyilFU=';

const START_WEIGHT = 87.3;
const GOAL_WEIGHT = 79.0;

// 3-phase plan spec (month-level)
const MONTHLY_PLAN = [
  { month: 1, name: 'Adaptation', range: '84–85 kg', focus: 'สร้างนิสัย: Protein 140g, LISS 3x, เดิน 8000 steps' },
  { month: 2, name: 'Build',      range: '82–83 kg', focus: 'เพิ่มปริมาณ: Home WO, Gym 2x, คาร์ดิโอ 4x' },
  { month: 3, name: 'Cut',        range: '79–80 kg', focus: 'รีด: Deficit 500 kcal, HIIT 2x, strict diet' },
];

const WEEKLY_PLAN = [
  { day: 'จ',  type: 'LISS',      icon: '🚶', desc: 'เดินเร็ว 40 นาที · 116–136 bpm', mins: 40 },
  { day: 'อ',  type: 'Recovery',  icon: '🧘', desc: 'ยืดเหยียด 20–30 นาที', mins: 25 },
  { day: 'พ',  type: 'Home WO',   icon: '🏠', desc: 'Home Workout 60 นาที', mins: 60 },
  { day: 'พฤ', type: 'LISS',      icon: '🚴', desc: 'เดินเร็ว 40 นาที', mins: 40 },
  { day: 'ศ',  type: 'Gym Coach', icon: '🏋️', desc: 'อก ไหล่ หลังแขน 60–75 นาที', mins: 67 },
  { day: 'ส',  type: 'Rest',      icon: '🌿', desc: 'พักผ่อน', mins: 0 },
  { day: 'อา', type: 'Gym Coach', icon: '🏋️', desc: 'ขา หลัง หน้าแขน 60–75 นาที', mins: 67 },
];

const todayBKK = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).toISOString().split('T')[0];
const getDOW = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).getDay();
const planIdx = dow => ({ 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 })[dow];
const addDays = (dateStr, n) => { const d = new Date(dateStr); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; };

async function sbFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(method === 'POST' || method === 'PATCH' ? { 'Prefer': 'return=representation,resolution=merge-duplicates' } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  if (!r.ok) { const t = await r.text(); throw new Error(t); }
  return r.status === 204 ? null : r.json();
}

async function reply(replyToken, text) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${LINE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
}

// ── Plan queries ──
function planFor(dateStr) {
  const dow = new Date(dateStr).getDay();
  return WEEKLY_PLAN[planIdx(dow)];
}

function weeklyPlanText(label = 'สัปดาห์นี้') {
  let msg = `📅 แผน${label}\n━━━━━━━━━━━━━━\n`;
  msg += WEEKLY_PLAN.map(p => `${p.icon} ${p.day} — ${p.type} (${p.mins ? p.mins + ' นาที' : 'พัก'})\n   ${p.desc}`).join('\n\n');
  msg += `\n━━━━━━━━━━━━━━\n🎯 เป้า: ${GOAL_WEIGHT} kg`;
  return msg;
}

function monthPlanText(n) {
  const p = MONTHLY_PLAN[n - 1];
  if (!p) return '❌ ระบุ เดือน 1, 2, หรือ 3';
  return `📆 เดือน ${p.month} — ${p.name}\n━━━━━━━━━━━━━━\n🎯 ช่วงน้ำหนัก: ${p.range}\n📋 โฟกัส: ${p.focus}`;
}

// ── Report builders ──
async function weeklyReport() {
  const today = todayBKK();
  const weekAgo = addDays(today, -7);
  const [weights, workouts, checkins] = await Promise.all([
    sbFetch(`weight_logs?date=gte.${weekAgo}&date=lte.${today}&order=date.asc`),
    sbFetch(`workout_logs?date=gte.${weekAgo}&date=lte.${today}&order=date.asc`),
    sbFetch(`daily_checkins?date=gte.${weekAgo}&date=lte.${today}&order=date.asc`),
  ]);
  const wStart = weights[0]?.weight_kg, wEnd = weights[weights.length - 1]?.weight_kg;
  const wDiff = wStart && wEnd ? +(wEnd - wStart).toFixed(2) : null;
  const compCount = workouts.filter(w => w.completed).length;
  const expected = WEEKLY_PLAN.filter(p => p.type !== 'Rest').length;
  const proteinOk = checkins.filter(c => c.protein_ok).length;
  const sleepOk = checkins.filter(c => c.sleep_ok).length;
  return `📊 สรุปสัปดาห์ที่ผ่านมา\n━━━━━━━━━━━━━━\n⚖️ น้ำหนัก: ${wStart || '-'} → ${wEnd || '-'} kg${wDiff !== null ? ' (' + (wDiff > 0 ? '+' : '') + wDiff + ')' : ''}\n🏋️ ออกกำลัง: ${compCount}/${expected} ครั้ง\n🥩 Protein ครบ: ${proteinOk}/${checkins.length} วัน\n😴 นอนดี: ${sleepOk}/${checkins.length} วัน\n📝 Check-in: ${checkins.length}/7 วัน`;
}

async function monthReport() {
  const today = todayBKK();
  const d = new Date(today);
  const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const [weights, workouts, checkins] = await Promise.all([
    sbFetch(`weight_logs?date=gte.${start}&date=lte.${today}&order=date.asc`),
    sbFetch(`workout_logs?date=gte.${start}&date=lte.${today}`),
    sbFetch(`daily_checkins?date=gte.${start}&date=lte.${today}`),
  ]);
  const wStart = weights[0]?.weight_kg, wEnd = weights[weights.length - 1]?.weight_kg;
  const wDiff = wStart && wEnd ? +(wEnd - wStart).toFixed(2) : null;
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const compliance = Math.round((workouts.filter(w => w.completed).length / (days * 6 / 7)) * 100);
  return `📊 สรุปเดือน (${start} → ${today})\n━━━━━━━━━━━━━━\n⚖️ น้ำหนัก: ${wStart || '-'} → ${wEnd || '-'} kg${wDiff !== null ? ' (' + (wDiff > 0 ? '+' : '') + wDiff + ')' : ''}\n🏋️ Workout compliance: ${compliance}%\n📝 Check-in: ${checkins.length} วัน\n📈 บันทึกน้ำหนัก: ${weights.length} ครั้ง`;
}

async function compareReport() {
  const weights = await sbFetch(`weight_logs?select=date,weight_kg&order=date.asc`);
  if (!weights.length) return '❌ ยังไม่มีข้อมูลน้ำหนัก';
  const first = weights[0], last = weights[weights.length - 1];
  const lost = +(START_WEIGHT - last.weight_kg).toFixed(1);
  const toGo = +(last.weight_kg - GOAL_WEIGHT).toFixed(1);
  const pct = Math.min(100, Math.max(0, +((lost / (START_WEIGHT - GOAL_WEIGHT)) * 100).toFixed(1)));
  return `📈 เทียบน้ำหนัก\n━━━━━━━━━━━━━━\n🏁 เริ่มต้น: ${START_WEIGHT} kg\n📍 ปัจจุบัน: ${last.weight_kg} kg (${last.date})\n🎯 เป้าหมาย: ${GOAL_WEIGHT} kg\n━━━━━━━━━━━━━━\n📉 ลดไปแล้ว: ${lost} kg\n🎯 เหลืออีก: ${Math.max(0, toGo)} kg\n📊 ความคืบหน้า: ${pct}%\n📅 บันทึกครั้งแรก: ${first.date}`;
}

async function handleMessage(text, replyToken) {
  const t = text.trim();
  const today = todayBKK();
  const plan = planFor(today);

  // ── แผน ──
  if (/^(แผนวันนี้|โปรแกรม|วันนี้|program|today)$/i.test(t)) {
    return reply(replyToken, `${plan.icon} แผนวันนี้ (${plan.day}) — ${plan.type}\n${plan.desc}${plan.mins ? '\n⏱ ' + plan.mins + ' นาที' : ''}\n\n🎯 เป้า: ${GOAL_WEIGHT} kg\n🏁 เริ่ม: ${START_WEIGHT} kg`);
  }
  if (/^(แผนพรุ่งนี้|tomorrow)$/i.test(t)) {
    const tmr = addDays(today, 1);
    const p = planFor(tmr);
    return reply(replyToken, `${p.icon} พรุ่งนี้ (${p.day}) — ${p.type}\n${p.desc}${p.mins ? '\n⏱ ' + p.mins + ' นาที' : ''}`);
  }
  if (/^(แผนสัปดาห์|week)$/i.test(t)) return reply(replyToken, weeklyPlanText());
  const monthRx = t.match(/^เดือน\s+([1-3])$/);
  if (monthRx) return reply(replyToken, monthPlanText(+monthRx[1]));

  // ── บันทึก ──
  const weightRx = t.match(/^น้ำหนัก\s+([\d.]+)(?:\s+([\d.]+))?$/);
  if (weightRx) {
    const kg = parseFloat(weightRx[1]);
    const bf = weightRx[2] ? parseFloat(weightRx[2]) : null;
    if (isNaN(kg) || kg < 30 || kg > 200) return reply(replyToken, '❌ น้ำหนักไม่ถูกต้อง (30–200 kg)');
    const body = { date: today, weight_kg: kg };
    if (bf !== null) body.body_fat_pct = bf;
    await sbFetch('weight_logs?on_conflict=date', 'POST', body);
    const lost = +(START_WEIGHT - kg).toFixed(1);
    const toGo = +(kg - GOAL_WEIGHT).toFixed(1);
    let msg = `✅ บันทึกแล้ว\n⚖️ ${kg} kg${bf !== null ? ` · BF ${bf}%` : ''}\n📉 ลดไป ${lost} kg\n🎯 อีก ${Math.max(0, toGo)} kg`;
    if (toGo <= 0) msg += '\n\n🎉 ถึงเป้าหมายแล้ว!';
    return reply(replyToken, msg);
  }

  const doneRx = t.match(/^เสร็จ(?:\s+(\d+))?$/);
  if (doneRx) {
    if (plan.type === 'Rest') return reply(replyToken, '🌿 วันนี้วันพักผ่อน ไม่ต้องออก 😊');
    const mins = doneRx[1] ? parseInt(doneRx[1]) : plan.mins;
    await sbFetch('workout_logs?on_conflict=date', 'POST', {
      date: today, workout_type: plan.type, duration_min: mins, completed: true,
    });
    return reply(replyToken, `✅ บันทึกแล้ว!\n${plan.icon} ${plan.type} — ${mins} นาที\n💪 เก่งมาก!`);
  }

  if (/^(ข้าม|skip)$/i.test(t)) {
    await sbFetch('workout_logs?on_conflict=date', 'POST', {
      date: today, workout_type: plan.type, duration_min: 0, completed: false, notes: 'skipped via LINE',
    });
    return reply(replyToken, `📝 บันทึกว่าข้ามแล้ว\nพักก่อน พรุ่งนี้กลับมาใหม่ 💪`);
  }

  // ── Check-in ──
  const kinRx = t.match(/^กิน\s+(ok|ครบ|ไม่ครบ|no)$/i);
  if (kinRx) {
    const ok = /^(ok|ครบ)$/i.test(kinRx[1]);
    await sbFetch('daily_checkins?on_conflict=date', 'POST', { date: today, protein_ok: ok });
    return reply(replyToken, ok ? '🥩 กิน Protein ครบแล้ว ✅' : '📝 บันทึกว่ากิน Protein ไม่ครบ');
  }
  const nonRx = t.match(/^นอน\s+(ok|พอ|ไม่พอ|no)$/i);
  if (nonRx) {
    const ok = /^(ok|พอ)$/i.test(nonRx[1]);
    await sbFetch('daily_checkins?on_conflict=date', 'POST', { date: today, sleep_ok: ok });
    return reply(replyToken, ok ? '😴 นอนดีแล้ว ✅' : '📝 บันทึกว่านอนไม่พอ');
  }
  const moodRx = t.match(/^มู้ด\s+([1-5])$/);
  if (moodRx) {
    const m = parseInt(moodRx[1]);
    await sbFetch('daily_checkins?on_conflict=date', 'POST', { date: today, mood: m });
    const emoji = ['😞', '😕', '😐', '🙂', '😄'][m - 1];
    return reply(replyToken, `${emoji} บันทึกมู้ด ${m}/5 แล้ว`);
  }

  // ── สรุป ──
  if (/^(สรุปวัน|เช็คอิน|checkin|check.?in)$/i.test(t)) {
    const [w, wo, ci] = await Promise.all([
      sbFetch(`weight_logs?select=weight_kg,body_fat_pct&date=eq.${today}`),
      sbFetch(`workout_logs?select=completed,workout_type,duration_min&date=eq.${today}`),
      sbFetch(`daily_checkins?select=*&date=eq.${today}`),
    ]);
    const c = ci?.[0];
    return reply(replyToken,
      `📋 สรุปวันนี้ (${today})\n━━━━━━━━━━━━━━\n` +
      `⚖️ น้ำหนัก: ${w?.[0] ? w[0].weight_kg + ' kg' + (w[0].body_fat_pct ? ` (BF ${w[0].body_fat_pct}%)` : '') + ' ✅' : '❌ ยังไม่บันทึก'}\n` +
      `🏋️ ออกกำลัง: ${wo?.[0]?.completed ? wo[0].workout_type + ' ' + wo[0].duration_min + 'น. ✅' : plan.type === 'Rest' ? '🌿 พัก' : '❌'}\n` +
      `🥩 Protein: ${c?.protein_ok === true ? '✅' : c?.protein_ok === false ? '❌' : '—'}\n` +
      `😴 Sleep: ${c?.sleep_ok === true ? '✅' : c?.sleep_ok === false ? '❌' : '—'}\n` +
      `😊 Mood: ${c?.mood ? c.mood + '/5' : '—'}`);
  }
  if (/^(สรุปสัปดาห์|สถิติสัปดาห์)$/i.test(t)) return reply(replyToken, await weeklyReport());
  if (/^(สรุปเดือน|สถิติเดือน|สถิติ|stats)$/i.test(t)) return reply(replyToken, await monthReport());
  if (/^(เทียบ|compare|progress)$/i.test(t)) return reply(replyToken, await compareReport());

  // ── help ──
  return reply(replyToken,
    `🏋️ Body Transform Bot\n━━━━━━━━━━━━━━\n` +
    `📅 แผน:\n• แผนวันนี้ | แผนพรุ่งนี้ | แผนสัปดาห์\n• เดือน 1 / 2 / 3\n\n` +
    `📝 บันทึก:\n• น้ำหนัก 85.5 (หรือ 85.5 22.5)\n• เสร็จ (หรือ เสร็จ 45)\n• ข้าม\n• กิน ok | กิน ไม่ครบ\n• นอน ok | นอน ไม่พอ\n• มู้ด 1-5\n\n` +
    `📊 รายงาน:\n• สรุปวัน | สรุปสัปดาห์ | สรุปเดือน\n• เทียบ`
  );
}

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ ok: true, service: 'body-transform-line-webhook' });
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body;
  if (!body?.events?.length) return res.status(200).end();

  for (const event of body.events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;
    try { await handleMessage(event.message.text, event.replyToken); }
    catch (e) { console.error('Webhook error:', e.message); }
  }
  return res.status(200).json({ ok: true });
}
