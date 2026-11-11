/* 심쿵영어 - 불규칙동사 (학생 화면)
   매일 N개씩(원장님이 학생별로 정해요) 새 동사를 배우고, 잊을 때쯤 복습해요.
   ① 보고 듣기(색깔 카드·발음·예문) → ② 쓰기 연습 → ③ 문장 빈칸 → ④ 테스트 → 간격 복습(1·3·7·14·30·60일) */
'use strict';

/* 기본 트랙: PDF 1~77번(불규칙) = 1~8단계.  교과 빈출: 추가 불규칙·혼동 동사 + 철자가 바뀌는 규칙동사 = 빈출 1~7 (단계 21~27)
   단순히 -ed만 붙는 규칙동사(78번~)는 뺐어요. */
const IV_ROW = r => ({ no: r[0], base: r[1], past: r[2], pp: r[3], ko: r[4], kp: r[5], kpp: r[6], ex: [[r[7], r[8]], [r[9], r[10]], [r[11], r[12]]] });
const IV_SPL = new Set([143, 144, 145, 149, 150, 151, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313]);   // 철자가 바뀌는 규칙동사
const IV_EX_ORDER = [201, 202, 301, 203, 204, 302, 245, 303, 223, 238, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 224, 225,
  226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 239, 240, 241, 242, 243, 244, 143, 144, 145, 304, 305, 306, 307, 308, 309, 310, 149, 150, 151, 311, 312, 313];
const IV_SRC = new Map([...IV_A, ...IV_B, ...IV_C, ...IV_D].map(r => [r[0], r]));
const IV_ALL = [...Array.from({ length: 77 }, (_, i) => i + 1), ...IV_EX_ORDER].map(n => IV_ROW(IV_SRC.get(n)));
IV_ALL.forEach(v => { v.reg = IV_SPL.has(v.no); v.pat = v.reg ? 'SPL' : v.base === v.past && v.past === v.pp ? 'AAA' : v.base === v.pp ? 'ABA' : v.past === v.pp ? 'ABB' : 'ABC'; v.ex_set = v.no > 77 || v.no === 0 ? 1 : 0; });
const IV_BY = new Map(IV_ALL.map(v => [v.no, v]));
const IV_STAGE_SIZE = 10;
const IV_STAGE_MAIN = Array.from({ length: 8 }, (_, i) => i + 1), IV_STAGE_EX = Array.from({ length: Math.ceil(IV_EX_ORDER.length / IV_STAGE_SIZE) }, (_, i) => 21 + i);
const IV_STAGES = [...IV_STAGE_MAIN, ...IV_STAGE_EX];
const ivStageMap = new Map();
IV_ALL.forEach(v => { if (v.no <= 77) ivStageMap.set(v.no, Math.floor((v.no - 1) / IV_STAGE_SIZE) + 1); });
IV_EX_ORDER.forEach((n, i) => ivStageMap.set(n, 21 + Math.floor(i / IV_STAGE_SIZE)));
const ivStageOf = no => ivStageMap.get(no) || 0;
const ivStageVerbs = s => IV_ALL.filter(v => ivStageOf(v.no) === s);
const ivStageName = n => n > 20 ? `빈출 ${n - 20}` : `${n}단계`;
const ivStageBand = s => s <= 5 ? '핵심 불규칙' : s <= 8 ? '확장 불규칙' : '교과 빈출';
const IV_PAT = {
  AAA: ['🟰', '모양이 안 변해요', '현재 = 과거 = p.p'],
  ABA: ['🔁', '현재와 p.p가 같아요', '현재 = p.p'],
  ABB: ['🤝', '과거와 p.p가 같아요', '과거 = p.p'],
  ABC: ['🌈', '세 개가 모두 달라요', '하나씩 따로 외워요'],
  SPL: ['✏️', '철자가 바뀌어요', 'y→ied · 마지막 자음을 겹쳐요']
};
const IV_SAY_BASE = { use: 'to use', close: 'to close', live: 'to live', lead: 'to lead', read: 'to read', wind: 'to wind', am: 'I am', are: 'you are', is: 'he is', tear: 'to tear', lie: 'to lie', lay: 'to lay' };
const IV_SAY_PAST = { read: 'red', wound: 'wownd' };
const IV = { ok: false, loaded: false, asg: null, prog: [], day: [], busy: false };

/* ---------- 소리 ---------- */
const ivSayText = (v, k) => k === 'base' ? (IV_SAY_BASE[v.base] || v.base) : (v[k] === 'read' ? 'red' : (IV_SAY_PAST[v[k]] || v[k]));
function ivSay(v, k, rate) { TTS.speak(ivSayText(v, k), rate || 0.85); }
let ivChantT = [];
function ivChantStop() { ivChantT.forEach(clearTimeout); ivChantT = []; if ('speechSynthesis' in window) speechSynthesis.cancel(); document.querySelectorAll('.ivf.chant').forEach(e => e.classList.remove('chant')); }
function ivChant(v, times = 2) {            // go — went — gone, 리듬에 맞춰 두 번 따라 읽어요
  ivChantStop();
  const keys = ['base', 'past', 'pp'];
  for (let r = 0; r < times; r++) keys.forEach((k, i) => {
    ivChantT.push(setTimeout(() => {
      document.querySelectorAll('.ivf').forEach(e => e.classList.toggle('chant', e.dataset.k === k));
      TTS.speak(ivSayText(v, k), 0.8);
    }, (r * 3 + i) * 1100));
  });
  ivChantT.push(setTimeout(() => document.querySelectorAll('.ivf.chant').forEach(e => e.classList.remove('chant')), times * 3300));
}

/* ---------- 데이터 ---------- */
const ivToday = () => (typeof kstToday === 'function' ? kstToday() : new Date().toISOString().slice(0, 10));
async function ivLoad(force) {
  if (IV.loaded && !force) return IV.ok;
  try {
    const me = S.user.id, sb = S.sb;
    const a = await sb.from('iv_assign').select('*').eq('student_id', me).maybeSingle();
    if (a.error) throw a.error;
    IV.asg = a.data || null;
    const p = await sb.from('iv_progress').select('verb_no,box,due_on,ok,bad,last_at').eq('student_id', me);
    IV.prog = p.error ? [] : (p.data || []).filter(x => IV_BY.has(x.verb_no));
    const d = await sb.from('iv_day').select('*').eq('student_id', me).order('day', { ascending: false }).limit(30);
    IV.day = d.error ? [] : (d.data || []);
    IV.ok = true;
  } catch (e) { IV.ok = false; IV.asg = null; }
  IV.loaded = true; return IV.ok;
}
const ivCfg = () => { const s = (IV.asg && IV.asg.settings) || {}; return { per_day: (IV.asg && IV.asg.per_day) || 5, hint: s.hint !== false, review_cap: s.review_cap || 15, rate: s.rate || 0.85 }; };
const ivStages = () => ((IV.asg && IV.asg.stages) || []).filter(n => IV_STAGES.includes(n)).sort((a, b) => a - b);
const ivDay = () => IV.day.find(d => d.day === ivToday()) || { new_n: 0, rev_n: 0, ok: 0, total: 0, sec: 0 };
const ivLearned = () => new Set(IV.prog.map(p => p.verb_no));
const ivDue = () => { const t = ivToday(); return IV.prog.filter(p => p.due_on <= t).sort((a, b) => a.due_on.localeCompare(b.due_on)); };
function ivNewPool() {
  const done = ivLearned(), st = ivStages();
  return IV_ALL.filter(v => st.includes(ivStageOf(v.no)) && !done.has(v.no));
}
const ivNewLeft = () => Math.max(0, ivCfg().per_day - ivDay().new_n);

/* ---------- 스타일 ---------- */
(function () {
  const st = document.createElement('style');
  st.textContent = `
  .ivhome{display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;background:linear-gradient(135deg,#eef2ff,#fdf2f8)}
  .ivhome .ic{font-size:26px;margin-right:10px}
  .ivforms{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
  .ivf{border-radius:14px;padding:12px 6px;text-align:center;border:2px solid transparent;transition:transform .15s,box-shadow .15s;cursor:pointer;user-select:none}
  .ivf small{display:block;font-size:11px;font-weight:700;opacity:.85}
  .ivf b{display:block;font-size:22px;margin:4px 0;word-break:break-word}
  .ivf span{display:block;font-size:12px}
  .ivf[data-k=base]{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}
  .ivf[data-k=past]{background:#fff7ed;border-color:#fed7aa;color:#c2410c}
  .ivf[data-k=pp]{background:#ecfdf5;border-color:#a7f3d0;color:#047857}
  .ivf.chant{transform:scale(1.07);box-shadow:0 6px 18px rgba(79,70,229,.3)}
  .ivpat{display:inline-flex;gap:6px;align-items:center;padding:4px 10px;border-radius:99px;background:#f5f3ff;color:#6d28d9;font-size:12px;font-weight:700}
  .ivex{border-left:4px solid #e2e8f0;padding:6px 10px;margin:8px 0;border-radius:4px;background:#fafafa}
  .ivex[data-k=base]{border-color:#60a5fa}.ivex[data-k=past]{border-color:#fb923c}.ivex[data-k=pp]{border-color:#34d399}
  .ivex .e{font-size:16px}.ivex .e mark{background:none;font-weight:800;padding:0 2px;border-radius:4px}
  .ivex[data-k=base] mark{background:#dbeafe;color:#1d4ed8}.ivex[data-k=past] mark{background:#ffedd5;color:#c2410c}.ivex[data-k=pp] mark{background:#d1fae5;color:#047857}
  .ivex .k{font-size:13px;color:#64748b;margin-top:2px}
  .ivtag{font-size:11px;font-weight:700;margin-right:6px;padding:1px 7px;border-radius:99px;background:#f1f5f9;color:#475569}
  .ivfr{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
  .ivfr span{font-size:12px;padding:3px 9px;border-radius:99px;background:#f1f5f9;color:#334155}
  .ivin{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
  .ivin input{width:100%;font-size:20px;padding:10px;border-radius:12px;border:2px solid #cbd5e1;box-sizing:border-box;text-align:center}
  .ivin input.ok{border-color:#10b981;background:#ecfdf5}.ivin input.bad{border-color:#ef4444;background:#fef2f2}
  .ivin label{font-size:12px;font-weight:700;display:block;margin-bottom:3px}
  .ivopts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
  .ivopts button{font-size:18px;font-weight:800;padding:14px 4px;border-radius:12px;border:2px solid #cbd5e1;background:#fff;cursor:pointer}
  .ivopts button.ok{border-color:#10b981;background:#ecfdf5}.ivopts button.bad{border-color:#ef4444;background:#fef2f2}
  .ivblank{display:inline-block;min-width:70px;border-bottom:3px solid #6366f1;text-align:center;color:#4f46e5;font-weight:800}
  .ivdots{display:flex;gap:5px;justify-content:center;margin:8px 0}
  .ivdots i{width:10px;height:10px;border-radius:50%;background:#e2e8f0}.ivdots i.on{background:#6366f1}.ivdots i.done{background:#10b981}
  .ivstage{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .ivstage span{font-size:12px;padding:4px 10px;border-radius:99px;background:#f1f5f9;color:#475569}
  .ivlist{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
  .ivlist button{text-align:left;border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:8px 10px;cursor:pointer}
  .ivlist button b{font-size:14px}.ivlist button i{display:block;font-style:normal;font-size:12px;color:#64748b}
  `;
  document.head.appendChild(st);
})();

/* ---------- 학생 홈 카드 ---------- */
function ivHomeCardHtml() {
  if (!IV.ok || !IV.asg || !ivStages().length) return '';
  const left = ivNewLeft(), pool = ivNewPool().length, due = ivDue().length, nNew = Math.min(left, pool);
  const msg = [nNew ? `새 동사 <b>${nNew}개</b>` : (pool ? '오늘 새 동사는 끝!' : '배정된 동사를 모두 배웠어요 🎉'), due ? `복습 <b style="color:#dc2626">${due}개</b>` : ''].filter(Boolean).join(' · ');
  return `<div class="card ivhome" id="ivgo" role="button" tabindex="0"><div style="display:flex;align-items:center"><span class="ic">🔁</span><div><h2 style="margin:0">불규칙동사</h2><div class="muted">${msg}</div></div></div><button class="btn">${nNew || due ? '시작' : '열기'}</button></div>`;
}
(function wrapHome() {
  if (typeof studentHome !== 'function') return;
  const _sh = studentHome;
  studentHome = function () {
    _sh.apply(this, arguments);
    ivLoad().then(() => {
      if (document.getElementById('ivgo')) return;
      const h = ivHomeCardHtml(); if (!h) return;
      const h1 = document.querySelector('h1'); if (!h1) return;
      h1.insertAdjacentHTML('afterend', h);
      const go = document.getElementById('ivgo'); if (go) go.onclick = () => ivHome();
    });
  };
})();

/* ---------- 불규칙동사 홈 ---------- */
async function ivHome() {
  ivChantStop();
  await ivLoad(true);
  const cfg = ivCfg(), left = ivNewLeft(), pool = ivNewPool(), due = ivDue(), nNew = Math.min(left, pool.length), day = ivDay();
  const learned = ivLearned(), st = ivStages();
  const stageChips = st.map(s => { const vs = ivStageVerbs(s), n = vs.filter(v => learned.has(v.no)).length; return `<span>${ivStageName(s)} <b>${n}/${vs.length}</b></span>`; }).join('');
  const mastered = IV.prog.filter(p => p.box >= 5).length;
  shell(`<p><a href="#" id="back">← 처음으로</a></p><h1>🔁 불규칙동사</h1>
    <div class="card"><h3 style="margin:0 0 8px">오늘의 목표</h3>
      <div class="goal ${day.new_n >= cfg.per_day || !pool.length ? 'done' : ''}"><span>${day.new_n >= cfg.per_day || !pool.length ? '✓' : '○'}</span> 새 동사 ${Math.min(day.new_n, cfg.per_day)} / ${cfg.per_day}개 배우기</div>
      <div class="goal ${due.length ? '' : 'done'}"><span>${due.length ? '○' : '✓'}</span> 복습 다 하기 ${due.length ? `<b style="color:#dc2626">(${due.length}개 남음)</b>` : ''}</div>
      <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
        ${nNew ? `<button class="btn" id="ivnew" style="flex:1;min-width:150px">✨ 새 동사 ${nNew}개 배우기</button>` : ''}
        ${due.length ? `<button class="btn ${nNew ? 'ghost' : ''}" id="ivrev" style="flex:1;min-width:150px">🔁 복습 ${Math.min(due.length, cfg.review_cap)}개 하기</button>` : ''}
      </div>
      ${!nNew && !due.length ? '<div class="tiny" style="margin-top:8px">오늘 할 일을 모두 끝냈어요! 내일 또 만나요 👏</div>' : ''}
    </div>
    <div class="card"><div class="row between"><b>내 단계</b><span class="tiny">외운 동사 ${learned.size}개 · 완전 암기 ${mastered}개</span></div><div class="ivstage">${stageChips || '<span>아직 배정된 단계가 없어요</span>'}</div></div>
    <div class="card"><div class="row between"><b>📖 내 동사 사전</b><span class="tiny">배운 동사를 눌러 다시 봐요</span></div>
      <div class="ivlist" style="margin-top:8px">${[...learned].sort((a, b) => a - b).map(n => { const v = IV_BY.get(n); return v ? `<button data-vw="${n}"><b>${esc(v.base)} – ${esc(v.past)} – ${esc(v.pp)}</b><i>${esc(v.ko)}</i></button>` : ''; }).join('') || '<div class="tiny">새 동사를 배우면 여기에 모여요.</div>'}</div></div>`);
  $('#back').onclick = e => { e.preventDefault(); studentHome(); };
  if ($('#ivnew')) $('#ivnew').onclick = () => ivLearn(pool.slice(0, nNew));
  if ($('#ivrev')) $('#ivrev').onclick = () => ivReview(due.slice(0, cfg.review_cap).map(p => IV_BY.get(p.verb_no)).filter(Boolean));
  document.querySelectorAll('[data-vw]').forEach(b => b.onclick = () => ivBrowse(IV_BY.get(+b.dataset.vw)));
}

/* ---------- 카드(보고 듣기) ---------- */
function ivHi(sentence, v, k) {
  const w = v[k], esc2 = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = k === 'base' ? new RegExp(`\\b(${esc2(w)}(?:s|es|ies)?|${w.endsWith('y') ? esc2(w.slice(0, -1)) + 'ies' : '@@'})\\b`, 'i') : new RegExp(`\\b(${esc2(w)})\\b`, 'i');
  return esc(sentence).replace(re, '<mark>$1</mark>');
}
function ivFriends(v) {
  if (v.reg) return [];
  const suf = v.past.slice(-3);
  return IV_ALL.filter(x => x.no !== v.no && !x.reg && x.pat === v.pat && x.past.slice(-3) === suf).slice(0, 5);
}
function ivCardHtml(v) {
  const p = IV_PAT[v.pat], fr = ivFriends(v);
  const form = (k, label, ko) => `<div class="ivf" data-k="${k}" data-say="${k}"><small>${label}</small><b>${esc(v[k])}</b><span>${esc(ko)}</span><span>🔊</span></div>`;
  const tags = ['현재형 · 지금·습관', '과거형 · yesterday, last…', 'p.p · have/has + p.p, be + p.p'];
  return `<div class="card"><div class="row between"><span class="ivpat">${p[0]} ${p[1]}</span><span class="tiny">${ivStageName(ivStageOf(v.no))}</span></div>
    <div class="ivforms">${form('base', '현재', v.ko)}${form('past', '과거', v.kp)}${form('pp', 'p.p', v.kpp)}</div>
    <div class="row" style="justify-content:center;gap:8px"><button class="btn small" id="ivch">🎵 리듬으로 따라 읽기</button><button class="btn small ghost" id="ivall">🔊 천천히 듣기</button></div>
    ${fr.length ? `<div class="tiny" style="margin-top:10px">같은 소리 친구들</div><div class="ivfr">${fr.map(f => `<span>${esc(f.base)} – ${esc(f.past)} – ${esc(f.pp)}</span>`).join('')}</div>` : ''}
    <div style="margin-top:10px">${['base', 'past', 'pp'].map((k, i) => `<div class="ivex" data-k="${k}"><div class="e"><span class="ivtag">${tags[i]}</span><br>${ivHi(v.ex[i][0], v, k)} <button class="btn small ghost" data-ex="${i}" style="padding:0 8px">🔊</button></div><div class="k">${esc(v.ex[i][1])}</div></div>`).join('')}</div></div>`;
}
function ivBindCard(v) {
  document.querySelectorAll('[data-say]').forEach(e => e.onclick = () => { ivChantStop(); ivSay(v, e.dataset.say, ivCfg().rate); });
  document.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { ivChantStop(); TTS.speak(v.ex[+b.dataset.ex][0], ivCfg().rate); });
  $('#ivch').onclick = () => ivChant(v);
  $('#ivall').onclick = () => { ivChantStop(); ['base', 'past', 'pp'].forEach((k, i) => ivChantT.push(setTimeout(() => TTS.speak(ivSayText(v, k), 0.7), i * 1400))); };
}
function ivBrowse(v) {
  if (!v) return;
  shell(`<p><a href="#" id="back">← 불규칙동사</a></p><h1>${esc(v.base)} – ${esc(v.past)} – ${esc(v.pp)}</h1>${ivCardHtml(v)}`);
  $('#back').onclick = e => { e.preventDefault(); ivChantStop(); ivHome(); };
  ivBindCard(v); setTimeout(() => ivChant(v, 1), 300);
}

/* 문장 빈칸 보기: 정답 + 헷갈리는 형태 2개 (예: go → goed) */
function ivOpts(v, k) {
  const pool = v.pat === 'SPL' ? [v.base, v.past, v.base + 'ed', v.base + 'd', v.past + 'ed'] : [v.base, v.past, v.pp, v.base + 'ed', v.past + 'ed'];
  const out = [v[k]]; for (const p of pool) if (out.length < 3 && !out.includes(p)) out.push(p);
  return out;
}
/* ---------- 새 동사 배우기 ---------- */
async function ivLearn(batch) {
  AT.start();
  const S1 = { i: 0 };
  const dots = (i, n) => `<div class="ivdots">${Array.from({ length: n }, (_, k) => `<i class="${k < i ? 'done' : k === i ? 'on' : ''}"></i>`).join('')}</div>`;
  const stepTop = (t, i, n) => `<p><a href="#" id="back">← 그만하기</a></p><div class="row between"><b>${t}</b><span class="tiny">${i + 1} / ${n}</span></div>${dots(i, n)}`;
  const quit = () => { ivChantStop(); AT.stop(); ivHome(); };
  // ① 보고 듣기
  const look = i => {
    const v = batch[i];
    shell(stepTop('① 보고 듣기', i, batch.length) + ivCardHtml(v) + `<div class="row" style="justify-content:center;margin-top:12px"><button class="btn big" id="nx">${i + 1 < batch.length ? '다음 동사' : '쓰기 연습으로'}</button></div>`);
    $('#back').onclick = e => { e.preventDefault(); quit(); };
    ivBindCard(v); setTimeout(() => ivChant(v, 1), 350);
    $('#nx').onclick = () => { ivChantStop(); i + 1 < batch.length ? look(i + 1) : writeStep(); };
  };
  // ② 쓰기 연습 (힌트 있음, 틀려도 다시 쓰기)
  const writeStep = () => {
    const q = batch.slice(), res = [];
    const one = i => {
      if (i >= q.length) return choose();
      const v = q[i], hint = ivCfg().hint;
      shell(stepTop('② 쓰기 연습', i, q.length) + `<div class="card"><div class="muted">${esc(v.ko)}</div><h2 style="margin:4px 0">${esc(v.base)}</h2>
        <div class="ivin"><div><label style="color:#c2410c">과거형 ${esc(v.kp)}</label><input id="ip" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${hint ? esc(v.past[0]) + '…' : ''}"></div>
        <div><label style="color:#047857">p.p ${esc(v.kpp)}</label><input id="ipp" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${hint ? esc(v.pp[0]) + '…' : ''}"></div></div>
        <div id="fb" class="tiny" style="min-height:20px"></div><div class="row" style="justify-content:center"><button class="btn" id="ck">확인</button></div></div>`);
      $('#back').onclick = e => { e.preventDefault(); quit(); };
      let state = 0;
      const a = $('#ip'), b = $('#ipp'); a.focus();
      const go = () => {
        if (state === 1) { state = 0; return one(i + 1); }
        const okA = a.value.trim().toLowerCase() === v.past, okB = b.value.trim().toLowerCase() === v.pp;
        a.classList.add(okA ? 'ok' : 'bad'); b.classList.add(okB ? 'ok' : 'bad');
        if (!okA) a.value = v.past; if (!okB) b.value = v.pp;
        $('#fb').innerHTML = okA && okB ? '👏 정확해요!' : `정답: <b>${esc(v.past)}</b> · <b>${esc(v.pp)}</b> — 소리 내어 한 번 읽어 봐요`;
        ivChant(v, 1); $('#ck').textContent = '다음'; state = 1;
      };
      $('#ck').onclick = go;
      [a, b].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (state === 0 && el === a && !b.value) b.focus(); else go(); } }));
      document.addEventListener('keydown', function h(e) { if (!document.body.contains($('#ck'))) return document.removeEventListener('keydown', h); if (state === 1 && (e.key === ' ' || e.key === 'Enter') && !e.target.matches('input')) { e.preventDefault(); document.removeEventListener('keydown', h); go(); } });
    };
    one(0);
  };
  // ③ 문장 빈칸 고르기
  const choose = () => {
    const q = shuffle(batch.map(v => ({ v, k: ['base', 'past', 'pp'][Math.random() * 3 | 0] })));
    const one = i => {
      if (i >= q.length) return test();
      const { v, k } = q[i], ki = ['base', 'past', 'pp'].indexOf(k), s = v.ex[ki][0];
      const blank = ivHi(s, v, k).replace(/<mark>.*?<\/mark>/i, '<span class="ivblank">&nbsp;&nbsp;?&nbsp;&nbsp;</span>');
      const opts = ivOpts(v, k);
      shell(stepTop('③ 문장 빈칸', i, q.length) + `<div class="card"><div style="font-size:18px;line-height:1.7">${blank}</div><div class="muted" style="margin-top:4px">${esc(v.ex[ki][1])}</div>
        <div class="ivopts">${shuffle(opts).map(o => `<button data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div><div id="fb" class="tiny" style="min-height:20px"></div><div class="row" style="justify-content:center"><button class="btn" id="nx" style="display:none">다음</button></div></div>`);
      $('#back').onclick = e => { e.preventDefault(); quit(); };
      let done = false;
      const next = () => one(i + 1);
      document.querySelectorAll('[data-o]').forEach(bt => bt.onclick = () => {
        if (done) return; done = true;
        const ok = bt.dataset.o === v[k];
        bt.classList.add(ok ? 'ok' : 'bad');
        if (!ok) document.querySelectorAll('[data-o]').forEach(x => { if (x.dataset.o === v[k]) x.classList.add('ok'); });
        $('#fb').innerHTML = ok ? '👏 맞아요!' : `정답은 <b>${esc(v[k])}</b> 이에요`;
        TTS.speak(s, ivCfg().rate); $('#nx').style.display = ''; $('#nx').focus();
      });
      $('#nx').onclick = next;
      document.addEventListener('keydown', function h(e) { if (!document.body.contains($('#nx'))) return document.removeEventListener('keydown', h); if (done && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); document.removeEventListener('keydown', h); next(); } });
    };
    one(0);
  };
  // ④ 테스트 (힌트 없음) → 기록
  const test = () => typedRound(batch, '④ 테스트', false, async res => {
    const okN = res.filter(r => r.ok).length;
    await ivRecordAll(res, true);
    const sec = AT.stop();
    await ivDayAdd(batch.length, 0, okN, res.length, sec);
    ivFinish(`새 동사 ${batch.length}개를 배웠어요!`, res, '내일 복습에서 다시 만나요');
  });
  look(0);
}

/* 쓰기 라운드(과거·p.p를 직접 써요). 힌트 없음. 결과는 [{v, ok}] */
function typedRound(list, title, hint, onEnd) {
  const q = shuffle(list.slice()), res = [];
  const one = i => {
    if (i >= q.length) return onEnd(res);
    const v = q[i];
    shell(`<p><a href="#" id="back">← 그만하기</a></p><div class="row between"><b>${title}</b><span class="tiny">${i + 1} / ${q.length}</span></div>
      <div class="ivdots">${q.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="card"><div class="muted">${esc(v.ko)}</div><h2 style="margin:4px 0">${esc(v.base)} <button class="btn small ghost" id="sd" style="padding:0 8px">🔊</button></h2>
      <div class="ivin"><div><label style="color:#c2410c">과거형</label><input id="ip" autocomplete="off" autocapitalize="off" spellcheck="false"></div><div><label style="color:#047857">p.p</label><input id="ipp" autocomplete="off" autocapitalize="off" spellcheck="false"></div></div>
      <div id="fb" class="tiny" style="min-height:20px"></div><div class="row" style="justify-content:center"><button class="btn" id="ck">확인</button></div></div>`);
    $('#back').onclick = e => { e.preventDefault(); ivChantStop(); AT.stop(); ivHome(); };
    $('#sd').onclick = () => ivSay(v, 'base', ivCfg().rate);
    const a = $('#ip'), b = $('#ipp'); a.focus(); let state = 0;
    const go = () => {
      if (state === 1) return one(i + 1);
      const okA = a.value.trim().toLowerCase() === v.past, okB = b.value.trim().toLowerCase() === v.pp, ok = okA && okB;
      res.push({ v, ok }); a.classList.add(okA ? 'ok' : 'bad'); b.classList.add(okB ? 'ok' : 'bad');
      if (!okA) a.value = v.past; if (!okB) b.value = v.pp;
      $('#fb').innerHTML = ok ? '👏 정확해요!' : `정답: <b>${esc(v.past)}</b> · <b>${esc(v.pp)}</b>`;
      ivChant(v, 1); $('#ck').textContent = '다음'; state = 1; $('#ck').focus();
    };
    $('#ck').onclick = go;
    [a, b].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (state === 0 && el === a && !b.value) b.focus(); else go(); } }));
    document.addEventListener('keydown', function h(e) { if (!document.body.contains($('#ck'))) return document.removeEventListener('keydown', h); if (state === 1 && (e.key === ' ' || e.key === 'Enter') && !e.target.matches('input')) { e.preventDefault(); document.removeEventListener('keydown', h); go(); } });
  };
  one(0);
}

/* ---------- 복습 ---------- */
function ivReview(list) {
  if (!list.length) return ivHome();
  AT.start();
  typedRound(list, '🔁 복습', false, async res => {
    const okN = res.filter(r => r.ok).length;
    await ivRecordAll(res, false);
    const sec = AT.stop();
    await ivDayAdd(0, res.length, okN, res.length, sec);
    ivFinish('복습 끝!', res, '틀린 동사는 내일 다시 나와요');
  });
}

/* ---------- 기록 ---------- */
async function ivRecordAll(res, first) {
  for (const r of res) {
    try { await S.sb.rpc('iv_record', { p_verb: r.v.no, p_ok: r.ok, p_first: false }); } catch (e) { /* 기록이 잠깐 안 돼도 학습은 계속돼요 */ }
  }
}
async function ivDayAdd(n, r, ok, total, sec) {
  try { await S.sb.rpc('iv_day_add', { p_new: n, p_rev: r, p_ok: ok, p_total: total, p_sec: sec }); } catch (e) { /* 괜찮아요 */ }
  await ivLoad(true);
}
function ivFinish(title, res, sub) {
  const okN = res.filter(r => r.ok).length, bad = res.filter(r => !r.ok);
  shell(`<div class="card vend" style="text-align:center"><div style="font-size:52px">${okN === res.length ? '🎉' : '💪'}</div><h2>${esc(title)}</h2>
    <p>${res.length}개 중 <b>${okN}개</b> 맞혔어요. ${esc(sub)}</p>
    ${bad.length ? `<div class="tiny">다시 볼 동사</div><div class="ivfr" style="justify-content:center">${bad.map(r => `<span>${esc(r.v.base)} – ${esc(r.v.past)} – ${esc(r.v.pp)}</span>`).join('')}</div>` : ''}
    <div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="ok">확인</button></div></div>`);
  $('#ok').onclick = () => ivHome();
}
