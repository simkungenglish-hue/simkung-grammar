/* 심쿵영어 어휘 게임 - READ & BEAT (리딩 리듬게임)
   게임 화면은 readbeat/ 폴더(공개 파일), 교재 본문은 Supabase(로그인한 사람만)에서 받아 와서 게임에 넘겨줘요. */
'use strict';

const RB = { open: false, run: null, back: null };

async function rbOpen(role) {
  if (RB.open) return;
  const { data, error } = await S.sb.from('readbeat_levels').select('id,name,ord,units').order('ord');
  if (error || !data || !data.length) return toast(error ? 'READ & BEAT를 쓰려면 DB 업데이트(16단계)가 필요해요' : 'READ & BEAT 곡이 아직 들어 있지 않아요', 4000);
  RB.open = true; RB.run = null;
  const ov = document.createElement('div');
  ov.id = 'rbov'; ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000';
  const fr = document.createElement('iframe');
  fr.src = 'readbeat/index.html?v=1'; fr.allow = 'autoplay; fullscreen'; fr.title = 'READ & BEAT';
  fr.style.cssText = 'width:100%;height:100%;border:0;display:block';
  ov.appendChild(fr);
  if (matchMedia('(orientation: portrait)').matches) {
    const tip = document.createElement('div');
    tip.textContent = '📱 폰을 옆으로 눕히면 더 크게 보여요';
    tip.style.cssText = 'position:absolute;left:0;right:0;bottom:12px;text-align:center;color:#ffd23f;font:700 15px sans-serif;pointer-events:none';
    ov.appendChild(tip); setTimeout(() => tip.remove(), 5000);
  }
  document.body.appendChild(ov);
  const close = () => { window.removeEventListener('message', onMsg); ov.remove(); RB.open = false; if (typeof gRefreshPanel === 'function') gRefreshPanel(); };
  const onMsg = async e => {
    if (e.origin !== location.origin || e.source !== fr.contentWindow || !e.data || e.data.src !== 'readbeat') return;
    const m = e.data;
    if (m.type === 'rb-ready') fr.contentWindow.postMessage({ src: 'app', type: 'rb-init', readit: data, role: role === 'teacher' ? 'teacher' : 'student' }, location.origin);
    else if (m.type === 'rb-score') {
      if (role === 'teacher') return;                       // 수업용 시연은 기록하지 않아요
      if (!RB.run) RB.run = uuid();
      try { await S.sb.rpc('readbeat_submit', { p_run: RB.run, p_level: String(m.level), p_unit: +m.unit || 0, p_score: +m.score || 0, p_combo: +m.combo || 0, p_stage: +m.stage || 1 }); } catch (x) { /* 기록 실패는 조용히 */ }
      RB.run = null;
    } else if (m.type === 'rb-quit') close();
  };
  window.addEventListener('message', onMsg);
  try { if (ov.requestFullscreen) ov.requestFullscreen().catch(() => {}); } catch (e) { /* 괜찮아요 */ }
}
