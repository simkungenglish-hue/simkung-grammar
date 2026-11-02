/* 심쿵영어 문법 학습 - 원장님: 채점 알림 (띵 소리 · 컴퓨터 알림창 · 폰 푸시) */
'use strict';
const ALERT_KEY = { sound: 'alertSound', desk: 'alertDesk' };
function alertOn(k) { try { return localStorage.getItem(ALERT_KEY[k]) !== '0'; } catch (e) { return true; } }
function alertSet(k, v) { try { localStorage.setItem(ALERT_KEY[k], v ? '1' : '0'); } catch (e) { /* 저장 못 해도 괜찮아요 */ } }

/* 소리: 처음 화면을 한 번 누르면 브라우저가 소리를 허락해요 */
let _ac = null;
function alertAudio() { try { if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)(); if (_ac.state === 'suspended') _ac.resume(); } catch (e) { /* 소리 불가 */ } return _ac; }
addEventListener('pointerdown', () => alertAudio(), { once: true });
addEventListener('keydown', () => alertAudio(), { once: true });
function chime() {
  const ac = alertAudio(); if (!ac || ac.state !== 'running') return false;
  [[880, 0], [1318.5, 0.16]].forEach(([f, t0]) => {
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
    o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.start(t); o.stop(t + 1);
  });
  return true;
}

async function alertShow(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const opt = { body, tag: tag || 'review', renotify: true, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './' } };
    if (reg) await reg.showNotification(title, opt); else new Notification(title, opt);
  } catch (e) { /* 알림창 실패는 무시 */ }
}

let _lastDing = 0;
/* 실시간으로 새 답안이 들어올 때 teacher.js 가 불러요 */
function alertOnReview(row) {
  if (!row || row.status !== 'needs_review') return;
  if (T.autoFinal && !row.appeal_at) return;       // AI가 바로 채점하는 중이면 새 답안 소리는 생략(이의제기만 알려요)
  if (Date.now() - _lastDing < 4000) return;
  _lastDing = Date.now();
  const stu = (T.students || []).find(s => s.id === row.student_id);
  if (alertOn('sound')) chime();
  if (alertOn('desk')) alertShow('채점할 답안이 들어왔어요', (stu ? stu.name : '학생') + ' · 서술형 답안', 'review');
}

/* ---- 폰·컴퓨터 푸시 (앱이 닫혀 있어도 와요) ---- */
const b64uToBytes = s => { const p = '='.repeat((4 - s.length % 4) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
async function pushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration(); if (!reg) return 'off';
  const sub = await reg.pushManager.getSubscription(); if (!sub) return 'off';
  const { data } = await S.sb.from('push_subs').select('endpoint').eq('endpoint', sub.endpoint).maybeSingle();
  return data ? 'on' : 'off';
}
async function pushEnable() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('알림 허용을 눌러 주셔야 해요');
  const { data: key, error: ke } = await S.sb.rpc('push_public_key');
  if (ke || !key) throw new Error('서버 알림 열쇠를 아직 못 받았어요');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(key) });
  const j = sub.toJSON();
  const { error } = await S.sb.from('push_subs').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, ua: navigator.userAgent.slice(0, 200) }, { onConflict: 'endpoint' });
  if (error) throw error;
}
async function pushDisable() {
  const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription();
  if (sub) { await S.sb.from('push_subs').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
}

function alertCardHtml() {
  return `<div class="card" id="alertcard"><h2>채점 알림 🔔</h2>
    <p class="muted">학생이 서술형 답안을 내면 "띵" 소리와 알림창으로 알려 드려요.</p>
    <label class="row" style="gap:6px;align-items:center"><input type="checkbox" id="alsound"> 이 화면이 열려 있을 때 "띵" 소리 내기</label>
    <label class="row" style="gap:6px;align-items:center;margin-top:6px"><input type="checkbox" id="aldesk"> 컴퓨터 알림창도 띄우기</label>
    <h3 style="margin-top:14px">앱이 닫혀 있어도 받기 (이 기기)</h3>
    <p class="tiny" id="alpmsg">확인하는 중…</p>
    <div class="row"><button class="btn" id="alpon">이 기기에서 알림 켜기</button><button class="btn ghost" id="alpoff">이 기기 알림 끄기</button><button class="btn ghost" id="alptest">테스트 알림 보내기</button></div>
    <p class="tiny">아이폰은 사파리에서 「공유 → 홈 화면에 추가」로 앱을 설치한 뒤, 그 앱을 열어서 켜야 해요. 컴퓨터와 폰 각각에서 한 번씩 켜 주세요.</p></div>`;
}
async function alertCardInit() {
  const $$ = id => document.getElementById(id); if (!$$('alertcard')) return;
  $$('alsound').checked = alertOn('sound'); $$('aldesk').checked = alertOn('desk');
  $$('alsound').onchange = () => { alertSet('sound', $$('alsound').checked); if ($$('alsound').checked) { alertAudio(); chime(); } };
  $$('aldesk').onchange = async () => {
    alertSet('desk', $$('aldesk').checked);
    if ($$('aldesk').checked && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
  };
  const msgs = { on: '✅ 이 기기는 알림이 켜져 있어요.', off: '이 기기는 아직 꺼져 있어요. 아래 「켜기」를 눌러 주세요.', denied: '브라우저에서 알림이 차단돼 있어요. 주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꿔 주세요.', unsupported: '이 브라우저는 앱 닫힘 알림을 지원하지 않아요. (아이폰은 홈 화면에 설치한 앱에서만 돼요)' };
  async function refresh() {
    let st = 'off'; try { st = await pushState(); } catch (e) { /* 확인 실패 */ }
    $$('alpmsg').textContent = msgs[st] || ''; $$('alpon').style.display = st === 'on' ? 'none' : ''; $$('alpoff').style.display = st === 'on' ? '' : 'none';
    $$('alpon').disabled = st === 'unsupported' || st === 'denied'; $$('alptest').style.display = st === 'on' ? '' : 'none';
  }
  $$('alpon').onclick = async () => { try { await pushEnable(); toast('이 기기에서 알림을 켰어요'); } catch (e) { toast(errText(e), 4500); } refresh(); };
  $$('alpoff').onclick = async () => { try { await pushDisable(); toast('이 기기 알림을 껐어요'); } catch (e) { toast(errText(e)); } refresh(); };
  $$('alptest').onclick = async () => { alertAudio(); chime(); const { error } = await S.sb.rpc('push_test'); toast(error ? errText(error) : '테스트 알림을 보냈어요. 잠시 후 알림이 오는지 봐 주세요', 4000); };
  refresh();
}
