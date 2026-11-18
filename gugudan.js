/* 영어구구단 (1~32단 암기 + 녹음 제출)
   - 학생: 단마다 듣고 → 가리고 외우고 → 녹음해서 제출
   - 원장님: 단 배정, 녹음 듣기, 통과 / 다시 녹음
   새 테이블(gg_assign, gg_submit)과 비공개 녹음 보관함(gugudan)만 써요. 기존 기록은 건드리지 않아요. */
'use strict';

/* ---------- 구구단 표 ---------- */
const GG_DANS = (function () {
  const S = ['I', 'You', 'We', 'They', 'She', 'He', 'It'], BE = ['am', 'are', 'are', 'are', 'is', 'is', 'is'];
  const lo = s => s === 'I' ? 'I' : s.toLowerCase(), cap = s => s[0].toUpperCase() + s.slice(1);
  const t3 = i => i >= 4, DO = i => t3(i) ? 'Does' : 'Do', dont = i => t3(i) ? "doesn't" : "don't";
  const mk = f => S.map((s, i) => f(s, i));
  const v = (base, third) => mk((s, i) => `${s} ${t3(i) ? third : base}`);
  const q = verb => mk((s, i) => `${DO(i)} ${lo(s)} ${verb}?`);
  const neg = verb => mk((s, i) => `${s} ${dont(i)}${verb ? ' ' + verb : ''}`);
  const L = [
    ['~는 ~이다/있다', mk((s, i) => `${s} ${BE[i]}`)],
    ['~는 ~이니?/있니?', mk((s, i) => `${cap(BE[i])} ${lo(s)}?`)],
    ['~는 ~아니다', mk((s, i) => `${s} ${BE[i]} not`)],
    ['~는 ~상태니?', mk((s, i) => `${cap(BE[i])} ${lo(s)} good?`)],
    ['~는 동사할거니?', mk((s, i) => `${cap(BE[i])} ${lo(s)} going to ... ?`)],
    ['~는 ~ 할거야', mk((s, i) => i === 6 ? 'It will be done.' : `${s} will do that.`)],
    ['~는 한다', mk((s, i) => `${s} ${t3(i) ? 'does' : 'do'}.`)],
    ['~는 동사하니?', mk((s, i) => `${DO(i)} ${lo(s)} ... ?`)],
    ['~는 안 한다', neg('')],
    ['5w1h 의문사', ['Who (누구)', 'What (무엇)', 'When (언제)', 'Where (어디서)', 'Why (왜)', 'How (어떻게)', 'Which (어떤)']],
    ['~는 누구야?', mk((s, i) => `Who ${BE[i]} ${lo(s)}?`)],
    ['무엇을 동사하니?', mk((s, i) => `What ${DO(i).toLowerCase()} ${lo(s)} ... ?`)],
    ['~는 가지고 있다', v('have', 'has')],
    ['~는 안 갖고 있어', neg('have')],
    ['~는 갖고 있니?', q('have')],
    ['~는 얼마나 갖고 있니?', mk((s, i) => `How many ${DO(i).toLowerCase()} ${lo(s)} have?`)],
    ['~는 간다', v('go', 'goes').map(x => x + '.')],
    ['~는 가니?', q('go')],
    ['~는 안 간다', neg('go').map(x => x + '.')],
    ['~는 했어', mk(s => `${s} did.`)],
    ['~가 가져갔니?', mk(s => `Did ${lo(s)} take?`)],
    ['~가 안 가져갔어', mk(s => `${s} didn't take`)],
    ['~는 할거야?', mk((s, i) => i === 6 ? 'Will it be done?' : `Will ${lo(s)} do that?`)],
    ['~는 안 할거야', mk(s => `${s} won't`)],
    ['~는 산다/얻다', v('get', 'gets')],
    ['~가 사? 얻어?', q('get')],
    ['~는 안 사/안 얻어', neg('get')],
    ['~는 만든다', v('make', 'makes')],
    ['~가 만드니?', q('make')],
    ['~가 안 만들어', neg('make')],
    ['~는 좋아해', v('like', 'likes').map((x, i) => i ? x : 'I like(want/need).')],
    ['~가 좋아해?', q('like').map((x, i) => i ? x : 'Do I like(want/need)?')],
  ];
  return L.map(([ko, lines], i) => ({ n: i + 1, ko, lines }));
})();
const GG_MAX = GG_DANS.length;
const ggDanOf = n => GG_DANS[n - 1];
const ggSayText = t => String(t).replace(/\(.*?\)/g, '').replace(/\.\.\./g, ' ').replace(/\s+([?.])/g, '$1').replace(/\s+/g, ' ').trim();
const ggSec = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const GG_ST = { none: ['·', '아직'], submitted: ['⏳', '확인 대기'], pass: ['✓', '통과'], redo: ['🔁', '다시 녹음'] };

(function () {
  if (document.getElementById('gg-css')) return;
  const st = document.createElement('style'); st.id = 'gg-css'; st.textContent = `
  .gghome{display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;background:linear-gradient(135deg,#ecfeff,#eef2ff)}
  .gghome .ic{font-size:26px;margin-right:10px}
  .ggrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:10px}
  .ggt{display:flex;flex-direction:column;gap:3px;text-align:left;border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:10px 12px;font:inherit;color:inherit;cursor:pointer;min-height:86px}
  .ggt .no{font-weight:800;font-size:17px;color:#4338ca}.ggt b{font-size:13px;font-weight:600;color:#475569;line-height:1.3}
  .ggt .st{margin-top:auto;font-size:12px;font-weight:700;color:#94a3b8}
  .ggt.pass{background:#ecfdf5;border-color:#a7f3d0}.ggt.pass .st{color:#047857}
  .ggt.submitted{background:#eef2ff;border-color:#c7d2fe}.ggt.submitted .st{color:#4338ca}
  .ggt.redo{background:#fff7ed;border-color:#fdba74}.ggt.redo .st{color:#c2410c}
  .ggt.cur{border:2px solid #4f46e5;box-shadow:0 0 0 3px #e0e7ff}.ggt.cur .st{color:#4f46e5}
  .ggt.lock{opacity:.5;cursor:not-allowed}
  .gglines{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
  .gglines li{display:flex;align-items:center;gap:8px;border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;background:#fff}
  .gglines li .nu{width:20px;font-size:12px;font-weight:700;color:#94a3b8}
  .gglines li .tx{flex:1;font-size:19px;font-weight:700;letter-spacing:.2px}
  .gglines li.on{border-color:#4f46e5;background:#eef2ff}
  .gglines li.mask .tx{color:transparent;background:repeating-linear-gradient(90deg,#e2e8f0 0 10px,#f1f5f9 10px 20px);border-radius:8px;cursor:pointer;user-select:none}
  .gglines li .sp{border:0;background:#f1f5f9;border-radius:99px;width:36px;height:36px;font-size:16px;cursor:pointer}
  .ggnote{border-radius:12px;padding:10px 12px;margin:10px 0;font-weight:600}
  .ggnote.redo{background:#fff7ed;border:1px solid #fdba74;color:#9a3412}.ggnote.pass{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}.ggnote.submitted{background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3}
  .ggrecbox{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:10px}
  .ggrecbtn{border:0;border-radius:99px;padding:14px 26px;font:inherit;font-size:17px;font-weight:800;color:#fff;background:#dc2626;cursor:pointer}
  .ggrecbtn.stop{background:#111827}
  .ggtime{font-size:26px;font-weight:800;font-variant-numeric:tabular-nums}
  .ggdot{display:inline-block;width:12px;height:12px;border-radius:50%;background:#dc2626;margin-right:8px;animation:ggpulse 1s infinite}
  @keyframes ggpulse{50%{opacity:.25}}
  .ggrecbox audio,.ggrv audio,.ggmine audio{width:100%;max-width:460px}
  .ggmine{border-top:1px dashed #e2e8f0;padding:8px 0;display:flex;flex-direction:column;gap:6px}
  .ggbadge{font-size:12px;font-weight:700;padding:2px 9px;border-radius:99px;background:#f1f5f9;color:#64748b}
  .ggbadge.pass{background:#ecfdf5;color:#047857}.ggbadge.submitted{background:#eef2ff;color:#4338ca}.ggbadge.redo{background:#fff7ed;color:#c2410c}
  button.spill{font:inherit;font-size:12px;font-weight:700;cursor:pointer}
  .ggrv{border:1px solid #e2e8f0;border-radius:12px;padding:10px;margin-top:10px;display:flex;flex-direction:column;gap:8px}
  .ggrv.new{border-color:#c7d2fe;background:#f8faff}
  .ggrvl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 14px;font-size:14px;background:#f8fafc;border-radius:10px;padding:8px 12px;margin-top:8px}
  .ggpend{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#eef2ff;border:1px solid #c7d2fe}
  .ggpl{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px dashed #e2e8f0;padding:8px 0}
  .ggpick{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px;margin:8px 0}
  .ggpick label{display:flex;align-items:center;justify-content:center;gap:4px;border:1px solid #e2e8f0;border-radius:10px;padding:6px 4px;font-size:13px;font-weight:700;cursor:pointer;margin:0}
  .ggpick label:has(input:checked){background:#eef2ff;border-color:#818cf8;color:#3730a3}
  .ggpick input{width:auto;margin:0}`;
  document.head.appendChild(st);
})();

/* ======================================================================
   학생
   ====================================================================== */
const GG = { ok: false, loaded: false, asg: null, sub: [] };
async function ggLoad(force) {
  if (GG.loaded && !force) return GG.ok;
  try {
    const me = S.user.id, sb = S.sb;
    const a = await sb.from('gg_assign').select('*').eq('student_id', me).maybeSingle();
    if (a.error) throw a.error;
    GG.asg = a.data || null;
    const s = await sb.from('gg_submit').select('*').eq('student_id', me).order('created_at', { ascending: false });
    GG.sub = s.error ? [] : (s.data || []);
    GG.ok = true;
  } catch (e) { GG.ok = false; GG.asg = null; }
  GG.loaded = true; return GG.ok;
}
const ggCfg = () => Object.assign({ need_pass: false, hide: true, free: false }, (GG.asg && GG.asg.settings) || {});
const ggDans = () => ((GG.asg && GG.asg.dans) || []).filter(n => n >= 1 && n <= GG_MAX).sort((a, b) => a - b);
const ggSubs = n => GG.sub.filter(x => x.dan === n);
const ggState = n => { const l = ggSubs(n)[0]; return l ? l.status : 'none'; };
function ggIsOpen(n) {
  const c = ggCfg(); if (c.free) return true;
  for (const d of ggDans()) {
    if (d >= n) break;
    if (c.need_pass ? ggState(d) !== 'pass' : !ggSubs(d).length) return false;
  }
  return true;
}
function ggCur() {
  const ds = ggDans();
  return ds.find(n => ggState(n) === 'redo') || ds.find(n => ggState(n) === 'none' && ggIsOpen(n)) || null;
}

/* ---------- 학생 홈 카드 ---------- */
function ggHomeCardHtml() {
  const ds = ggDans(); if (!GG.ok || !GG.asg || !ds.length) return '';
  const pass = ds.filter(n => ggState(n) === 'pass').length, redo = ds.filter(n => ggState(n) === 'redo').length, cur = ggCur();
  const msg = [cur ? `지금 <b>${cur}단</b>` : '녹음을 모두 냈어요 🎉', `통과 <b>${pass}/${ds.length}단</b>`, redo ? `다시 녹음 <b style="color:#dc2626">${redo}개</b>` : ''].filter(Boolean).join(' · ');
  return `<div class="card gghome" id="gggo" role="button" tabindex="0"><div style="display:flex;align-items:center"><span class="ic">🎤</span><div><h2 style="margin:0">영어구구단</h2><div class="muted">${msg}</div></div></div><button class="btn">${cur ? '시작' : '열기'}</button></div>`;
}
function ggInjectCard() {
  ggLoad().then(() => {
    if (document.getElementById('gggo')) return;
    const h = ggHomeCardHtml(); if (!h) return;
    const anchor = document.getElementById('ivgo') || document.querySelector('.s2-hero') || document.querySelector('h1'); if (!anchor) return;
    anchor.insertAdjacentHTML('afterend', h);
    const go = document.getElementById('gggo'); if (go) go.onclick = () => ggHome();
  });
}
function ggWrapHome() {
  if (typeof studentHome === 'function' && !studentHome.__gg) {
    const _sh = studentHome;
    studentHome = function () { _sh.apply(this, arguments); ggInjectCard(); };
    studentHome.__gg = true; if (_sh.__iv) studentHome.__iv = true;
  }
  ggTeacherHooks(); ggBankHook();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ggWrapHome); else ggWrapHome();

/* ---------- 단 목록 ---------- */
async function ggHome() {
  ggRecCleanup();
  await ggLoad(true);
  const ds = ggDans(), cur = ggCur();
  const cnt = k => ds.filter(n => ggState(n) === k).length;
  const tiles = ds.map(n => {
    const d = ggDanOf(n), st = ggState(n), open = ggIsOpen(n) || st !== 'none';
    const cls = !open ? 'lock' : n === cur && st === 'none' ? 'cur' : st === 'none' ? '' : st;
    const lab = !open ? '🔒 앞 단을 먼저 해요' : n === cur && st === 'none' ? '▶ 지금 여기' : `${GG_ST[st][0]} ${GG_ST[st][1]}`;
    return `<button type="button" class="ggt ${cls}" data-dan="${n}" ${open ? '' : 'data-lock="1"'}><span class="no">${n}단</span><b>${esc(d.ko)}</b><span class="st">${lab}</span></button>`;
  }).join('');
  shell(`<p><a href="#" id="back">← 처음으로</a></p><h1>🎤 영어구구단</h1>
    <div class="card"><div class="row between"><b>내 진행</b><span class="tiny">통과 ${cnt('pass')} · 확인 대기 ${cnt('submitted')} · 다시 ${cnt('redo')} · 전체 ${ds.length}단</span></div>
      <div class="progress" style="margin-top:8px"><i style="width:${ds.length ? Math.round(cnt('pass') / ds.length * 100) : 0}%"></i></div>
      <div class="tiny" style="margin-top:6px">단을 외운 다음 녹음해서 내면, 선생님이 듣고 확인해 줘요.</div></div>
    ${ds.length ? `<div class="ggrid">${tiles}</div>` : '<div class="card">아직 배정된 단이 없어요. 선생님께 물어보세요.</div>'}`);
  $('#back').onclick = e => { e.preventDefault(); studentHome(); };
  document.querySelectorAll('[data-dan]').forEach(b => b.onclick = () => b.dataset.lock ? toast('앞 단을 먼저 녹음해서 내면 열려요') : ggDan(+b.dataset.dan));
}

/* ---------- 녹음기 ---------- */
const GGR = { rec: null, stream: null, chunks: [], blob: null, url: '', mime: '', t0: 0, dur: 0, timer: null, peeks: 0, on: false };
function ggRecCleanup() {
  try { if (GGR.rec && GGR.rec.state !== 'inactive') { GGR.rec.onstop = null; GGR.rec.stop(); } } catch (e) { /* 이미 멈춤 */ }
  try { if (GGR.stream) GGR.stream.getTracks().forEach(t => t.stop()); } catch (e) { /* 괜찮아요 */ }
  clearInterval(GGR.timer); if (GGR.url) URL.revokeObjectURL(GGR.url);
  Object.assign(GGR, { rec: null, stream: null, chunks: [], blob: null, url: '', timer: null, peeks: 0, on: false, dur: 0 });
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
const ggCanRec = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
function ggMime() {
  const c = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return c.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';
}
const ggExt = m => /mp4|m4a|aac/.test(m) ? 'm4a' : /ogg/.test(m) ? 'ogg' : 'webm';

/* ---------- 단 학습 화면 ---------- */
async function ggDan(n) {
  ggRecCleanup();
  const d = ggDanOf(n); if (!d) return ggHome();
  const cfg = ggCfg(), subs = ggSubs(n), last = subs[0], st = last ? last.status : 'none';
  const ds = ggDans(), nx = ds.find(x => x > n && ggIsOpen(x));
  const note = st === 'redo' ? `<div class="ggnote redo">🔁 선생님이 다시 녹음해 달라고 했어요.${last.note ? `<br>💬 ${esc(last.note)}` : ''}</div>`
    : st === 'pass' ? `<div class="ggnote pass">✓ 통과했어요! 잘했어요 👏${last.note ? `<br>💬 ${esc(last.note)}` : ''}</div>`
      : st === 'submitted' ? '<div class="ggnote submitted">⏳ 녹음을 냈어요. 선생님이 듣고 확인해 줄 거예요.</div>' : '';
  const mine = subs.slice(0, 3).map(x => `<div class="ggmine"><div class="row between"><span>${fmtDT(x.created_at)} · ${ggSec(x.dur_sec)}</span><span class="ggbadge ${x.status}">${GG_ST[x.status][1]}</span></div>
      <button class="btn small ghost" data-play="${esc(x.audio_path)}" style="align-self:flex-start">▶ 내 녹음 듣기</button></div>`).join('');
  shell(`<p><a href="#" id="back">← 구구단 목록</a></p><h1>${n}단 <span style="font-size:.6em;font-weight:600;color:#64748b">(${esc(d.ko)})</span></h1>${note}
    <div class="card"><div class="row between" style="flex-wrap:wrap;gap:6px"><b>① 듣고 따라 말하기 → 가리고 외우기</b>
        <div class="row" style="gap:6px"><button class="btn small" id="ggall">▶ 전체 듣기</button><button class="btn small ghost" id="gghide">🙈 가리기</button></div></div>
      <ol class="gglines" id="gglines">${d.lines.map((t, i) => `<li data-i="${i}"><span class="nu">${i + 1}</span><span class="tx">${esc(t)}</span><button class="sp" data-sp="${i}" aria-label="듣기">🔊</button></li>`).join('')}</ol>
      <div class="tiny" style="margin-top:8px">「가리기」를 누르고 외워서 말해 본 다음, 가려진 줄을 눌러 맞는지 확인해요.</div></div>
    <div class="card"><b>② 녹음해서 내기</b>
      <div class="tiny" style="margin-top:4px">7줄을 순서대로 또박또박 말해요.${cfg.hide ? ' 녹음하는 동안에는 문장이 가려져요.' : ''}</div>
      <div class="ggrecbox" id="ggrec"></div></div>
    ${mine ? `<div class="card"><b>내가 낸 녹음</b>${mine}</div>` : ''}
    ${nx && subs.length ? `<button class="btn" id="ggnext" style="width:100%">${nx}단으로 가기 →</button>` : ''}`);
  $('#back').onclick = e => { e.preventDefault(); ggHome(); };
  if ($('#ggnext')) $('#ggnext').onclick = () => ggDan(nx);
  const lis = [...document.querySelectorAll('#gglines li')];
  const setMask = on => { lis.forEach(li => li.classList.toggle('mask', on)); $('#gghide').textContent = on ? '👀 보이기' : '🙈 가리기'; };
  $('#gghide').onclick = () => { const masked = lis.filter(li => li.classList.contains('mask')).length; if (masked && GGR.on) GGR.peeks += masked; setMask(!masked); };
  lis.forEach(li => li.querySelector('.tx').onclick = () => { if (!li.classList.contains('mask')) return; li.classList.remove('mask'); if (GGR.on) GGR.peeks++; });
  const say = (i, done) => {
    if (!('speechSynthesis' in window)) return done && done();
    const u = new SpeechSynthesisUtterance(ggSayText(d.lines[i])); u.lang = 'en-US'; u.rate = 0.85;
    if (typeof TTS !== 'undefined' && (TTS.voice || TTS.pick())) u.voice = TTS.voice;
    u.onstart = () => lis.forEach((li, k) => li.classList.toggle('on', k === i));
    u.onend = u.onerror = () => { lis[i].classList.remove('on'); if (done) done(); };
    speechSynthesis.speak(u);
  };
  const quiet = () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); };
  document.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { if (GGR.on) return; quiet(); say(+b.dataset.sp); });
  $('#ggall').onclick = () => { if (GGR.on) return; quiet(); let i = 0; const go = () => { if (i < d.lines.length) say(i++, () => setTimeout(go, 350)); }; go(); };
  document.querySelectorAll('[data-play]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    const r = await S.sb.storage.from('gugudan').createSignedUrl(b.dataset.play, 3600);
    if (r.error || !r.data) { b.disabled = false; return toast('녹음을 불러오지 못했어요'); }
    b.outerHTML = `<audio controls autoplay src="${esc(r.data.signedUrl)}"></audio>`;
  });

  /* 녹음 → 들어 보기 → 내기 */
  const box = $('#ggrec');
  const idle = () => {
    if (!ggCanRec()) { box.innerHTML = '<div class="ggnote redo">이 화면에서는 녹음이 안 돼요. 사파리나 크롬으로 열어 주세요.</div>'; return; }
    box.innerHTML = `<button class="ggrecbtn" id="ggstart">🎤 녹음 시작</button>`;
    $('#ggstart').onclick = start;
  };
  const start = async () => {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    try { GGR.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { return toast('마이크를 쓸 수 없어요. 마이크 사용을 "허용"으로 바꿔 주세요.', 4500); }
    GGR.mime = ggMime(); GGR.chunks = []; GGR.peeks = 0;
    try { GGR.rec = new MediaRecorder(GGR.stream, GGR.mime ? { mimeType: GGR.mime, audioBitsPerSecond: 32000 } : undefined); }
    catch (e) { GGR.stream.getTracks().forEach(t => t.stop()); return toast('이 기기에서는 녹음이 안 돼요.', 4000); }
    GGR.rec.ondataavailable = e => { if (e.data && e.data.size) GGR.chunks.push(e.data); };
    GGR.rec.onstop = () => {
      clearInterval(GGR.timer); GGR.on = false;
      GGR.stream.getTracks().forEach(t => t.stop());
      GGR.dur = Math.round((Date.now() - GGR.t0) / 1000);
      const type = (GGR.rec.mimeType || GGR.mime || 'audio/webm').split(';')[0];
      GGR.blob = new Blob(GGR.chunks, { type }); GGR.mime = type;
      if (GGR.url) URL.revokeObjectURL(GGR.url); GGR.url = URL.createObjectURL(GGR.blob);
      setMask(false); review();
    };
    GGR.rec.start(); GGR.t0 = Date.now(); GGR.on = true;
    if (cfg.hide) setMask(true);
    box.innerHTML = `<div class="ggtime"><span class="ggdot"></span><span id="ggt">0:00</span></div><button class="ggrecbtn stop" id="ggstop">■ 녹음 끝내기</button><div class="tiny">최대 2분까지 녹음돼요.</div>`;
    $('#ggstop').onclick = () => { try { GGR.rec.stop(); } catch (e) { /* 이미 멈춤 */ } };
    try { box.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* 괜찮아요 */ }
    GGR.timer = setInterval(() => { const s = (Date.now() - GGR.t0) / 1000, el = $('#ggt'); if (el) el.textContent = ggSec(s); if (s >= 120) { try { GGR.rec.stop(); } catch (e) { /* 이미 멈춤 */ } } }, 250);
  };
  const review = () => {
    if (GGR.dur < 3 || !GGR.blob || GGR.blob.size < 800) { toast('녹음이 너무 짧아요. 다시 해 볼까요?'); return idle(); }
    box.innerHTML = `<audio controls src="${GGR.url}"></audio><div class="tiny">녹음 ${ggSec(GGR.dur)} · 들어 보고 마음에 들면 내요.</div>
      <div class="row" style="gap:8px"><button class="btn ghost" id="ggre">다시 녹음</button><button class="btn" id="ggsend">선생님께 내기</button></div>`;
    $('#ggre').onclick = () => { URL.revokeObjectURL(GGR.url); GGR.url = ''; GGR.blob = null; idle(); };
    $('#ggsend').onclick = send;
  };
  const send = async () => {
    const b = $('#ggsend'); b.disabled = true; b.textContent = '내는 중…'; $('#ggre').disabled = true;
    try {
      const path = `${S.user.id}/d${n}-${Date.now()}.${ggExt(GGR.mime)}`;
      const up = await S.sb.storage.from('gugudan').upload(path, GGR.blob, { contentType: GGR.mime, upsert: false });
      if (up.error) throw up.error;
      const ins = await S.sb.from('gg_submit').insert({ student_id: S.user.id, dan: n, audio_path: path, mime: GGR.mime, dur_sec: GGR.dur, peeks: GGR.peeks }).select().single();
      if (ins.error) throw ins.error;
      GG.sub.unshift(ins.data);
      toast('녹음을 냈어요! 선생님이 듣고 확인해 줄 거예요 👏', 3500);
      ggDan(n);
    } catch (e) {
      b.disabled = false; b.textContent = '선생님께 내기'; $('#ggre').disabled = false;
      toast('내지 못했어요. 인터넷을 확인하고 다시 눌러 주세요. (녹음은 그대로 있어요)', 4500);
    }
  };
  idle();
}

/* ======================================================================
   원장님
   ====================================================================== */
const GGT = { loaded: false, loading: false, asg: [], sub: [], at: 0 };
async function ggTLoad(force) {
  if (GGT.loaded && !force) return;
  try {
    const a = await S.sb.from('gg_assign').select('*'); GGT.asg = a.error ? [] : (a.data || []);
    const s = await S.sb.from('gg_submit').select('*').order('created_at', { ascending: false }).limit(5000); GGT.sub = s.error ? [] : (s.data || []);
  } catch (e) { GGT.asg = []; GGT.sub = []; }
  GGT.loaded = true; GGT.at = Date.now();
}
/* 오래된 정보면 뒤에서 조용히 다시 불러와요. 바뀐 게 있으면 cb를 불러 화면을 다시 그려요 */
function ggTFresh(maxMs, cb) {
  if (!GGT.loaded || GGT.loading || Date.now() - GGT.at < maxMs) return;
  const sig = () => GGT.sub.length + '|' + GGT.sub.filter(x => x.status === 'submitted').length + '|' + GGT.asg.length;
  const before = sig(); GGT.loading = true;
  ggTLoad(true).then(() => { GGT.loading = false; if (sig() !== before && cb) cb(); }).catch(() => { GGT.loading = false; });
}
const ggTAsg = sid => GGT.asg.find(x => x.student_id === sid) || null;
const ggTDans = a => ((a && a.dans) || []).filter(n => n >= 1 && n <= GG_MAX).sort((x, y) => x - y);
const ggTSubs = (sid, n) => GGT.sub.filter(x => x.student_id === sid && x.dan === n);
const ggTState = (sid, n) => { const l = ggTSubs(sid, n)[0]; return l ? l.status : 'none'; };
const ggTPending = () => { const seen = new Set(), out = []; for (const x of GGT.sub) { const k = x.student_id + '|' + x.dan; if (seen.has(k)) continue; seen.add(k); if (x.status === 'submitted' && T.sById[x.student_id]) out.push(x); } return out; };
function ggTSum(sid) {
  const a = ggTAsg(sid), ds = ggTDans(a), c = k => ds.filter(n => ggTState(sid, n) === k).length;
  return { a, ds, pass: c('pass'), wait: c('submitted'), redo: c('redo') };
}
const ggRange = ds => { if (!ds.length) return '없음'; const out = []; let s = ds[0], p = ds[0]; for (const n of ds.slice(1).concat([null])) { if (n === p + 1) { p = n; continue; } out.push(s === p ? `${s}` : `${s}~${p}`); s = p = n; } return out.join(', ') + '단'; };

function ggTCardHtml(sid) {
  const m = ggTSum(sid); if (!m.a) return '';
  const chips = m.ds.map(n => { const st = ggTState(sid, n), cls = st === 'pass' ? 'done' : st === 'submitted' ? 'now' : st === 'redo' ? 'bad' : '';
    return `<button type="button" class="spill ${cls}" data-ggd="${n}" title="${esc(ggDanOf(n).ko)} · ${GG_ST[st][1]}">${GG_ST[st][0]} ${n}단</button>`; }).join('');
  const c = Object.assign({ need_pass: false, hide: true, free: false }, m.a.settings || {});
  return `<details class="bkgrp" id="ggcard" ${m.wait ? 'open' : ''}><summary><span class="bkg-cv"><span class="bkg-ph">🎤</span></span><span class="bkg-i"><span class="alb">🎤 영어구구단</span><b>영어구구단</b>
      <span class="bkg-s"><em class="f">통과 ${m.pass}/${m.ds.length}단</em>${m.wait ? `<em class="i">확인 대기 ${m.wait}</em>` : ''}${m.redo ? `<em class="n">다시 ${m.redo}</em>` : ''}</span>
      <span class="bkg-bar"><i style="width:${m.ds.length ? m.pass / m.ds.length * 100 : 0}%"></i></span></span></summary>
    <div class="bkg-body"><div class="gu"><div class="row between" style="flex-wrap:wrap;gap:6px"><div><h3>${ggRange(m.ds)} 배정</h3><div class="stu-set">${c.free ? '순서 상관없이 열림' : c.need_pass ? '통과해야 다음 단 열림' : '녹음을 내면 다음 단 열림'} · ${c.hide ? '녹음할 때 문장 가림' : '녹음할 때 문장 보임'}</div></div>
        <div class="row" style="gap:6px"><button class="btn small ghost" id="ggedit">배정 수정</button><button class="btn small ghost" id="ggdel" style="color:#dc2626">배정 해제</button></div></div>
      <div class="spills">${chips || '<span class="tiny">배정된 단이 없어요</span>'}</div>
      <div class="tiny">단을 누르면 녹음을 듣고 통과 / 다시 녹음을 줄 수 있어요. ⏳ 확인 대기 · ✓ 통과 · 🔁 다시 · · 아직</div></div></div></details>`;
}
function ggTInject(sid) {
  if (!document.getElementById('ivset') || typeof T === 'undefined' || T.stuSid !== sid) return;
  if (!GGT.loaded) { if (!GGT.loading) { GGT.loading = true; ggTLoad().then(() => { GGT.loading = false; ggTInject(sid); }).catch(() => { GGT.loading = false; }); } return; }
  if (document.getElementById('ggset')) return;
  ggTFresh(30000, () => { if (T.stuSid === sid && !document.querySelector('.modal-bg')) stuView(sid); });
  const a = ggTAsg(sid), bar = document.getElementById('ivset').parentElement, grid = bar.closest('.stu-sec').nextElementSibling;
  bar.insertAdjacentHTML('beforeend', `<button class="btn small" id="ggset">${a ? '⚙ 영어구구단' : '+ 영어구구단'}</button>`);
  document.getElementById('ggset').onclick = () => ggTSet(sid);
  if (!grid) return;
  const html = a ? ggTCardHtml(sid) : '<div class="ph-empty" id="ggempty">🎤 영어구구단<small>배정 없음 · 눌러서 배정</small></div>';
  const firstEmpty = [...grid.children].find(c => c.classList.contains('ph-empty'));
  if (firstEmpty && a) firstEmpty.insertAdjacentHTML('beforebegin', html); else grid.insertAdjacentHTML('beforeend', html);
  const em = document.getElementById('ggempty'); if (em) em.onclick = () => ggTSet(sid);
  const ed = document.getElementById('ggedit'); if (ed) ed.onclick = () => ggTSet(sid);
  const dl = document.getElementById('ggdel'); if (dl) dl.onclick = async () => {
    if (!confirm('영어구구단 배정을 해제할까요? (낸 녹음과 기록은 그대로 남아요)')) return;
    const { error } = await S.sb.from('gg_assign').delete().eq('student_id', sid); if (error) return toast(errText(error), 4000);
    GGT.asg = GGT.asg.filter(x => x.student_id !== sid); toast('해제했어요'); stuView(sid);
  };
  document.querySelectorAll('#ggcard [data-ggd]').forEach(b => b.onclick = e => { e.preventDefault(); ggTReview(sid, +b.dataset.ggd, () => stuView(sid)); });
}

/* ---------- 배정 ---------- */
function ggTSet(sid) {
  const s = T.sById[sid], old = ggTAsg(sid), cfg = Object.assign({ need_pass: false, hide: true, free: false }, (old && old.settings) || {});
  const sel = new Set(old ? ggTDans(old) : GG_DANS.slice(0, 8).map(d => d.n));
  const m = modal(`<h2>${esc(s.name)} · 영어구구단 배정</h2>
    <label>외울 단 <span class="tiny">번호가 낮은 단부터 차례로 열려요</span></label>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin:6px 0">${[[1, 8], [1, 16], [17, 32], [1, 32]].map(([a, z]) => `<button type="button" class="btn small ghost" data-q="${a}-${z}">${a}~${z}단</button>`).join('')}<button type="button" class="btn small ghost" data-q="0-0">모두 해제</button></div>
    <div class="ggpick">${GG_DANS.map(d => `<label title="${esc(d.ko)}"><input type="checkbox" data-dn="${d.n}" ${sel.has(d.n) ? 'checked' : ''}>${d.n}단</label>`).join('')}</div>
    <div class="tiny" id="ggsum" style="margin:6px 0"></div>
    <div><label class="pick"><input type="checkbox" id="ggneed" ${cfg.need_pass ? 'checked' : ''}> 원장님이 「통과」를 줘야 다음 단이 열리게 하기 <span class="tiny">(끄면 녹음을 내기만 해도 다음 단이 열려요)</span></label></div>
    <div><label class="pick"><input type="checkbox" id="ggfree" ${cfg.free ? 'checked' : ''}> 순서 상관없이 모든 단 열어 두기</label></div>
    <div><label class="pick"><input type="checkbox" id="gghd" ${cfg.hide ? 'checked' : ''}> 녹음하는 동안 문장 가리기 <span class="tiny">(외워서 말하게 해요 · 살짝 본 횟수가 기록돼요)</span></label></div>
    <div class="row" style="margin-top:12px"><button class="btn" id="sv">저장</button><button class="btn ghost" id="cx">취소</button></div>`);
  const sum = () => { const ds = [...m.querySelectorAll('[data-dn]:checked')].map(i => +i.dataset.dn); m.querySelector('#ggsum').textContent = ds.length ? `${ds.length}개 단 · ${ggRange(ds)}` : '단을 하나 이상 골라 주세요'; return ds; };
  m.querySelectorAll('[data-dn]').forEach(i => i.onchange = sum);
  m.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const [a, z] = b.dataset.q.split('-').map(Number); m.querySelectorAll('[data-dn]').forEach(i => { i.checked = !!a && +i.dataset.dn >= a && +i.dataset.dn <= z; }); sum(); });
  m.querySelector('#cx').onclick = () => m.remove(); sum();
  m.querySelector('#sv').onclick = async () => {
    const ds = sum(); if (!ds.length) return toast('단을 하나 이상 골라 주세요');
    const row = { student_id: sid, dans: ds.sort((a, b) => a - b), settings: { need_pass: m.querySelector('#ggneed').checked, free: m.querySelector('#ggfree').checked, hide: m.querySelector('#gghd').checked }, updated_at: new Date().toISOString() };
    const { error } = await S.sb.from('gg_assign').upsert([row], { onConflict: 'student_id' });
    if (error) return toast(errText(error), 4000);
    GGT.asg = GGT.asg.filter(x => x.student_id !== sid).concat([row]); m.remove(); toast('저장했어요'); stuView(sid);
  };
}

/* ---------- 녹음 듣고 확인 ---------- */
async function ggTReview(sid, n, after) {
  const s = T.sById[sid] || {}, d = ggDanOf(n), subs = ggTSubs(sid, n);
  const item = (x, i) => `<div class="ggrv ${i ? '' : 'new'}" data-id="${x.id}"><div class="row between" style="flex-wrap:wrap;gap:6px"><b>${fmtDT(x.created_at)}</b>
      <span class="tiny">${ggSec(x.dur_sec)}${x.peeks ? ` · 살짝 보기 ${x.peeks}번` : ''}</span><span class="ggbadge ${x.status}">${GG_ST[x.status][1]}</span></div>
      <audio controls preload="none" data-path="${esc(x.audio_path)}"></audio>
      ${i ? (x.note ? `<div class="tiny">💬 ${esc(x.note)}</div>` : '') : `<input type="text" id="ggnote" maxlength="200" placeholder="학생에게 한마디 (선택) 예: She does 발음 한 번 더!" value="${esc(x.note || '')}">
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn" data-set="pass" style="background:#16a34a;border-color:#16a34a">✅ 통과</button><button class="btn" data-set="redo" style="background:#ea580c;border-color:#ea580c">🔁 다시 녹음</button></div>`}
      <button class="btn small ghost" data-rm="${x.id}" style="align-self:flex-end;color:#dc2626">이 녹음 지우기</button></div>`;
  const m = modal(`<h2>${esc(s.name || '')} · ${n}단 <span class="tiny">(${esc(d.ko)})</span></h2>
    <div class="ggrvl">${d.lines.map(t => `<span>${esc(t)}</span>`).join('')}</div>
    ${subs.length ? subs.map(item).join('') : '<p class="muted" style="margin-top:12px">아직 낸 녹음이 없어요.</p>'}
    <div class="row" style="margin-top:12px"><button class="btn ghost" id="cx">닫기</button></div>`);
  const done = () => { m.remove(); if (after) after(); };
  m.querySelector('#cx').onclick = () => m.remove();
  if (subs.length) {
    const r = await S.sb.storage.from('gugudan').createSignedUrls(subs.map(x => x.audio_path), 3600);
    const by = new Map(((r && r.data) || []).filter(x => x.signedUrl).map(x => [x.path, x.signedUrl]));
    m.querySelectorAll('audio[data-path]').forEach(a => { const u = by.get(a.dataset.path); if (u) a.src = u; else a.insertAdjacentHTML('afterend', '<span class="tiny">녹음 파일을 불러오지 못했어요.</span>'); });
  }
  m.querySelectorAll('[data-set]').forEach(b => b.onclick = async () => {
    const x = subs[0], patch = { status: b.dataset.set, note: m.querySelector('#ggnote').value.trim() || null, reviewed_at: new Date().toISOString() };
    b.disabled = true;
    const { error } = await S.sb.from('gg_submit').update(patch).eq('id', x.id);
    if (error) { b.disabled = false; return toast(errText(error), 4000); }
    Object.assign(x, patch); toast(patch.status === 'pass' ? '통과 처리했어요' : '다시 녹음하도록 알렸어요'); done();
  });
  m.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => {
    const x = subs.find(y => y.id === b.dataset.rm); if (!x) return;
    if (!confirm('이 녹음을 지울까요? 지우면 되돌릴 수 없어요.')) return;
    await S.sb.storage.from('gugudan').remove([x.audio_path]);
    const { error } = await S.sb.from('gg_submit').delete().eq('id', x.id); if (error) return toast(errText(error), 4000);
    GGT.sub = GGT.sub.filter(y => y.id !== x.id); toast('지웠어요'); m.remove(); ggTReview(sid, n, after);
  });
}
function ggTPendList() {
  const L = ggTPending();
  if (!L.length) { toast('확인할 녹음이 없어요'); return; }
  const m = modal(`<h2>🎤 영어구구단 녹음 확인 <span class="tiny">${L.length}건</span></h2>
    ${L.map((x, i) => `<div class="ggpl"><span><b>${esc((T.sById[x.student_id] || {}).name || '?')}</b> · ${x.dan}단 <span class="tiny">${esc(ggDanOf(x.dan).ko)} · ${fmtDT(x.created_at)} · ${ggSec(x.dur_sec)}</span></span><button class="btn small" data-i="${i}">듣기</button></div>`).join('')}
    <div class="row" style="margin-top:12px"><button class="btn ghost" id="cx">닫기</button></div>`);
  m.querySelector('#cx').onclick = () => { m.remove(); if (T.tab === 'today' && !T.stuSid) tabToday(); };
  m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const x = L[+b.dataset.i]; m.remove(); ggTReview(x.student_id, x.dan, () => { if (ggTPending().length) ggTPendList(); else if (T.tab === 'today' && !T.stuSid) tabToday(); }); });
}

/* ---------- 원장님 화면에 끼워 넣기 (기존 함수는 그대로 두고 감싸요) ---------- */
function ggTeacherHooks() {
  if (typeof stuView === 'function' && !stuView.__gg) {
    const _sv = stuView;
    stuView = function (sid) { const r = _sv.apply(this, arguments); try { ggTInject(sid); } catch (e) { /* 카드가 없어도 화면은 보여요 */ } return r; };
    stuView.__gg = true;
  }
  if (typeof progressRows === 'function' && !progressRows.__gg) {
    const _pr = progressRows;
    progressRows = function (sid) {
      const h = _pr.apply(this, arguments);
      try {
        if (!GGT.loaded) return h;
        const m = ggTSum(sid); if (!m.a || !m.ds.length) return h;
        const p = Math.round(m.pass / m.ds.length * 100);
        const chip = `<span class="sgchip pg ${m.pass >= m.ds.length ? 'full' : ''}" style="--p:${p}%" title="영어구구단 · 통과한 단 / 배정한 단">🎤 구구단 ${m.pass}/${m.ds.length}단${m.wait ? ` · <b style="color:#dc2626">확인 ${m.wait}</b>` : ''}</span>`;
        return h.includes('</div><i data-sid') ? h.replace('</div><i data-sid', chip + '</div><i data-sid') : h;
      } catch (e) { return h; }
    };
    progressRows.__gg = true;
  }
  if (typeof tabToday === 'function' && !tabToday.__gg) {
    const _tt = tabToday;
    tabToday = function () {
      const r = _tt.apply(this, arguments);
      try {
        if (!GGT.loaded) { if (!GGT.loading) { GGT.loading = true; ggTLoad().then(() => { GGT.loading = false; if (T.tab === 'today' && !T.stuSid && !document.querySelector('.modal-bg')) tabToday(); }).catch(() => { GGT.loading = false; }); } return r; }
        ggTFresh(60000, () => { if (T.tab === 'today' && !T.stuSid && !document.querySelector('.modal-bg')) tabToday(); });
        const n = ggTPending().length, hero = document.querySelector('#tb .hero');
        if (n && hero && !document.getElementById('ggpend')) {
          hero.insertAdjacentHTML('afterend', `<div class="card ggpend" id="ggpend"><span>🎤 영어구구단 녹음 <b>${n}건</b>이 확인을 기다려요.</span><button class="btn small" id="ggpendb">듣고 확인하기</button></div>`);
          document.getElementById('ggpendb').onclick = () => ggTPendList();
        }
      } catch (e) { /* 알림이 없어도 화면은 보여요 */ }
      return r;
    };
    tabToday.__gg = true;
  }
  if (typeof tabStudents === 'function' && !tabStudents.__gg) {
    const _ts = tabStudents;
    tabStudents = function () {
      const r = _ts.apply(this, arguments);
      try {
        if (!GGT.loaded) { if (!GGT.loading) { GGT.loading = true; ggTLoad().then(() => { GGT.loading = false; if (T.tab === 'students' && !T.view) tabStudents(); }).catch(() => { GGT.loading = false; }); } return r; }
        document.querySelectorAll('.sg-card').forEach(c => {
          const b = c.querySelector('[data-s]'); if (!b || c.querySelector('.sg-gg')) return;
          const m = ggTSum(b.dataset.s); if (!m.a || !m.ds.length) return;
          const full = m.pass >= m.ds.length;
          c.insertAdjacentHTML('beforeend', `<div class="sg-gg"><div class="sg-bk"><span>🎤 영어구구단</span><small>통과 ${m.pass}/${m.ds.length}단</small></div><div class="sg-its"><div class="sg-it"><div class="t">${ggRange(m.ds)}</div>
            <div class="s ${full ? 'done' : m.wait ? 'warn' : ''}">${full ? '✓ 모두 통과' : m.wait ? `확인 대기 ${m.wait}` : m.redo ? `다시 녹음 ${m.redo}` : `통과 ${m.pass}단`}</div><div class="bar"><i class="${full ? 'ok' : ''}" style="width:${Math.round(m.pass / m.ds.length * 100)}%"></i></div></div></div></div>`);
        });
      } catch (e) { /* 표시가 없어도 화면은 보여요 */ }
      return r;
    };
    tabStudents.__gg = true;
  }
}

/* ---------- 문항 관리 책장에 영어구구단 보여 주기 (내용 보기 전용) ---------- */
function ggTBank() {
  const say = t => { if (typeof TTS !== 'undefined') TTS.speak(ggSayText(t), 0.85); };
  $('#tb').innerHTML = `<div class="card"><div class="row between"><h2 style="margin:0">문항 관리</h2></div>
      <div class="notice" style="margin-top:10px">영어구구단은 1~${GG_MAX}단이 모두 <b>공개</b>돼 있어요. 학생에게는 원장님이 배정한 단만 보여요. (학생 상세 → 「+ 영어구구단」)</div>
      <div class="crumbs"><a href="#" id="ggbk">문항 관리</a> <span class="muted">›</span> 영어구구단</div></div>
    <div class="card"><div class="grid2">${GG_DANS.map(d => `<div class="qcard" style="cursor:default"><div class="row between"><div class="qt">${d.n}단 <span class="tiny">${esc(d.ko)}</span></div><button class="btn small ghost" data-ggall="${d.n}">▶ 듣기</button></div>
      <div style="margin-top:6px;line-height:1.7">${d.lines.map(t => `<div>${esc(t)}</div>`).join('')}</div></div>`).join('')}</div></div>`;
  $('#ggbk').onclick = e => { e.preventDefault(); if ('speechSynthesis' in window) speechSynthesis.cancel(); tabQuestions(); };
  document.querySelectorAll('[data-ggall]').forEach(b => b.onclick = () => {
    if (!('speechSynthesis' in window)) return; speechSynthesis.cancel();
    ggDanOf(+b.dataset.ggall).lines.forEach(t => { const u = new SpeechSynthesisUtterance(ggSayText(t)); u.lang = 'en-US'; u.rate = 0.85; if (typeof TTS !== 'undefined' && (TTS.voice || TTS.pick())) u.voice = TTS.voice; speechSynthesis.speak(u); });
  });
}
function ggBankHook() {
  if (typeof tabQuestions !== 'function' || tabQuestions.__gg) return;
  const _tq = tabQuestions;
  tabQuestions = async function () {
    const r = await _tq.apply(this, arguments);
    try {
      if (QB || QU || T.tab !== 'questions') return r;   // 책장 첫 화면에서만
      const cards = document.querySelectorAll('#tb > .card'), host = cards[cards.length - 1];
      if (host && !document.getElementById('ggbank')) {
        host.insertAdjacentHTML('beforeend', `<h3 style="margin-top:14px">영어구구단</h3><div class="grid2 qroot"><div class="qcard" id="ggbank"><div class="qt">🎤 1~${GG_MAX}단</div><div class="tiny">단 ${GG_MAX}개 · 문장 ${GG_DANS.reduce((n, d) => n + d.lines.length, 0)}개 · 외워서 녹음 제출</div><div style="margin-top:6px"><span class="badge ok">전부 공개</span></div></div></div>`);
        document.getElementById('ggbank').onclick = ggTBank;
      }
    } catch (e) { /* 표시가 없어도 화면은 보여요 */ }
    return r;
  };
  tabQuestions.__gg = true;
}
