/* 심쿵영어 - 원장님 화면: 학생별 학습 화면
   ① 오늘 현황 카드에 어휘·문법·내신 진행을 한눈에 보여 주고
   ② 카드를 누르면 그 학생 화면에서 지금 하는 학습·단계·시간을 보고, 학습 배정·단계 수정까지 한 곳에서 해요.
   (따로 있던 「과제 배정」 탭은 이 화면으로 합쳤어요. 저장 구조는 그대로예요.) */
'use strict';

const STU = { loaded: false, loading: false, vprog: [], pprog: [], vtime: [], ivA: [], ivP: [], ivD: [] };
const SV_STEP = { look: '보고 듣기', memorize: '외우기', check: '뜻 고르기', write: '철자 쓰기', match: '짝 맞추기', pos: '품사 맞추기', sent: '문장 빈칸', test: '유닛 테스트' };
const SV_ORDER = ['look', 'memorize', 'check', 'write', 'match', 'pos', 'sent'];
const stuMin = sec => { const m = Math.round((sec || 0) / 60); return m <= 0 ? (sec > 0 ? '1분 미만' : '-') : m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; };

(function css() {
  const st = document.createElement('style');
  st.textContent = `
  .sgsec{font-size:12px;font-weight:800;color:#4338ca;margin:10px 0 3px;display:flex;align-items:center;gap:4px}
  .sgsec:first-child{margin-top:0}
  .sgcur{font-size:12px;color:#475569;margin:1px 0 4px 2px}
  .scard[data-stucard]{cursor:pointer}
  .stuopen{margin-top:8px;width:100%}
  .scard .sm,.scard .sf button{display:none}
  .sgline{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0}
  .sgchip{font-size:12px;font-weight:700;padding:3px 9px;border-radius:99px;background:#eef2ff;color:#4338ca}
  .sgchip.zero{background:#f1f5f9;color:#94a3b8;font-weight:600}
  .bkgrp{background:#fff;border:1px solid #e2e8f0;border-radius:16px;margin:0 0 12px;box-shadow:0 1px 3px rgba(15,23,42,.05);overflow:hidden}
  .bkgrp>summary{list-style:none;cursor:pointer;display:flex;gap:12px;align-items:center;padding:12px 14px;background:linear-gradient(90deg,#f5f3ff,#fff)}
  .bkgrp>summary::-webkit-details-marker{display:none}
  .bkgrp>summary::after{content:"▾";margin-left:auto;color:#94a3b8;font-size:18px}
  .bkgrp:not([open])>summary::after{content:"▸"}
  .bkg-cv .cvs.big{width:54px;height:74px;margin:0}
  .bkg-ph{display:flex;width:54px;height:74px;align-items:center;justify-content:center;background:#ecfdf5;border-radius:6px;font-size:26px}
  .bkg-i{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
  .bkg-i>b{font-size:17px}
  .bkg-s{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .bkg-s em{font-style:normal;font-size:12px;font-weight:700;padding:2px 9px;border-radius:99px}
  .bkg-s em.f{background:#ecfdf5;color:#047857}.bkg-s em.i{background:#eef2ff;color:#4338ca}.bkg-s em.n{background:#f1f5f9;color:#64748b}
  .bkg-bar{display:block;height:6px;background:#e2e8f0;border-radius:99px;overflow:hidden}.bkg-bar i{display:block;height:100%;background:#10b981}
  .kpis.k5{grid-template-columns:repeat(5,1fr)}@media(max-width:900px){.kpis.k5{grid-template-columns:repeat(2,1fr)}}
  .bkg-act{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 4px 8px;border-bottom:1px dashed #e2e8f0}
  .bkgrp.arch{opacity:.85;background:#f8fafc}
  .archsec{margin-top:10px}.archsec>summary{cursor:pointer;font-weight:700;color:#64748b;padding:6px 2px}
  .alb{font-size:11px;font-weight:700;color:#64748b}
  .ph-empty{border:2px dashed #cbd5e1;border-radius:16px;padding:18px 14px;color:#94a3b8;font-weight:700;display:flex;flex-direction:column;gap:4px;cursor:pointer;min-height:76px;justify-content:center}.ph-empty small{font-weight:500}.ph-empty:hover{border-color:#818cf8;color:#6366f1}
  .bkgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px;margin-bottom:8px;align-items:start}
  .bkgrid .bkgrp{margin:0}.bkgrid .bkgrp[open]{grid-column:1/-1}
  .bkgrp>summary{padding:10px 12px;gap:10px}
  .bkgrp:not([open])>summary .tiny{display:none}
  .bkg-cv .cvs.big{width:46px;height:64px}.bkg-ph{width:46px;height:64px}
  .bkg-i>b{font-size:15px}
  .bkg-body{padding:6px 12px 10px}
  .gu{padding:9px 4px;border-top:1px dashed #e2e8f0}.gu:first-child{border-top:0}
  .gu-h{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:flex-start}
  .gu-t b{font-size:14.5px}.gu.fin .gu-t b::after{content:" ✓";color:#059669}
  .gu-b{display:flex;gap:4px}.gu-b .btn.small{padding:3px 9px;font-size:12px}
  .gu .spills{margin:5px 0 0}
  .stu-a{margin-bottom:10px}
  .stu-a h3{margin:0}
  .spill{display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:99px;font-size:12px;font-weight:700;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0}
  .spill.done{background:#ecfdf5;color:#047857;border-color:#a7f3d0}
  .spill.now{background:#eef2ff;color:#4338ca;border-color:#c7d2fe;box-shadow:0 0 0 2px #e0e7ff}
  .spill.bad{background:#fff7ed;color:#c2410c;border-color:#fed7aa}
  .spills{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
  .calk{cursor:pointer;transition:.15s}.calk:hover{box-shadow:0 0 0 2px #a5b4fc;transform:translateY(-1px)}
  .hbtns{display:flex;gap:6px;margin-top:8px;justify-content:flex-end;flex-wrap:wrap}.hbtns button{background:#fff;color:#4338ca;border:0;border-radius:10px;padding:6px 11px;font-weight:700;font-size:13px;cursor:pointer}
  .stu-sec{display:flex;align-items:center;justify-content:space-between;margin:18px 0 8px}
  .stu-sec h2{margin:0}
  .tbars .tr{display:grid;grid-template-columns:54px 1fr 90px;gap:8px;align-items:center;font-size:12px;margin:3px 0}
  .tbars .bar{display:flex;height:12px;border-radius:6px;overflow:hidden;background:#f1f5f9}
  .tbars .bar i{display:block;height:100%}
  .tbars .v{background:#6366f1}.tbars .g{background:#f59e0b}
  .stu-set{font-size:12px;color:#64748b;margin-top:4px}
  `;
  document.head.appendChild(st);
})();

/* ---------- 자료 불러오기 ---------- */
async function stuLoad(force) {
  if (STU.loaded && !force) return;
  const sb = S.sb;
  try { if (typeof loadVT === 'function' && (force || !VT.loaded)) await loadVT(); } catch (e) { /* 어휘 기능이 없어도 계속 */ }
  try { if (typeof loadPT === 'function' && (force || !PT.loaded)) await loadPT(); } catch (e) { /* 내신 본문이 없어도 계속 */ }
  try { STU.vprog = await vFetchAll(() => sb.from('vocab_progress').select('student_id,unit_id,step,score,total,time_sec,done_at').order('student_id').order('unit_id').order('step')); } catch (e) { STU.vprog = []; }
  try { STU.pprog = await vFetchAll(() => sb.from('passage_progress').select('student_id,passage_id,step,score,total,time_sec,done_at').order('student_id').order('passage_id').order('step')); } catch (e) { STU.pprog = []; }
  try { const r = await sb.rpc('vocab_time_overview', { p_days: 120 }); STU.vtime = r.error ? [] : (r.data || []); } catch (e) { STU.vtime = []; }
  try {
    const g = await sb.from('iv_assign').select('*'); STU.ivA = g.error ? [] : (g.data || []);
    STU.ivP = await vFetchAll(() => sb.from('iv_progress').select('student_id,verb_no,box,due_on,ok,bad,last_at').order('student_id').order('verb_no'));
    const d = await sb.from('iv_day').select('*').gte('day', addDays(kstToday(), -120)); STU.ivD = d.error ? [] : (d.data || []);
  } catch (e) { STU.ivA = []; STU.ivP = []; STU.ivD = []; }
  try { const r = await sb.from('book_archive').select('*'); STU.arch = r.error ? [] : (r.data || []); } catch (e) { STU.arch = []; }
  STU.loaded = true;
}

/* ---------- 학생별 어휘·내신 진행 계산 ---------- */
function stuVSteps(a, unit) {
  const bk = vtBook(a.book_id), c = { ...vtDefaults(bk), ...(a.settings || {}) };
  const us = unit && c.unit_steps ? c.unit_steps[unit.ord] : null;
  const on = Array.isArray(us) && us.length ? us : Array.isArray(c.steps) && c.steps.length ? c.steps : ['look', 'memorize', 'check', 'write', 'match'];
  return [...SV_ORDER.filter(k => on.includes(k)), 'test'];
}
function stuVocabInfo(sid) {
  if (typeof VT === 'undefined' || !VT.ok) return [];
  return VT.asg.filter(a => a.student_id === sid).map(a => {
    const bk = vtBook(a.book_id); if (!bk) return null;
    const us = vtAsgUnits(a);
    const st = u => VT.ustat.find(x => x.student_id === sid && x.unit_id === u.id);
    const passed = us.filter(u => { const x = st(u); return x && x.passed_at; }).length;
    const curU = us.find(u => { const x = st(u); return !(x && x.passed_at); });
    let cur = null;
    if (curU) {
      const steps = stuVSteps(a, curU), prog = STU.vprog.filter(p => p.student_id === sid && p.unit_id === curU.id);
      const done = prog.map(p => p.step), next = steps.find(k => !done.includes(k));
      cur = { unit: curU, steps, prog, done, next };
    }
    return { a, bk, us, passed, cur, st };
  }).filter(Boolean);
}
function stuPassInfo(sid) {
  if (typeof PT === 'undefined' || !PT.ok) return [];
  return PT.asg.filter(a => a.student_id === sid).map(a => {
    const p = ptPas(a.passage_id); if (!p) return null;
    const done = STU.pprog.filter(g => g.student_id === sid && g.passage_id === a.passage_id);
    let total = 0; try { total = ptStepCount(a.passage_id, a.track); } catch (e) { total = 0; }
    return { a, p, done, total };
  }).filter(Boolean);
}
const stuUnitName = u => (u.title || ('Unit ' + u.ord)).replace(/\s+/g, ' ').slice(0, 24);

/* ---------- ① 오늘 현황 카드: 등록된 학생만 간단히 (자세한 건 학생 화면에서) ---------- */
const stuArchSet = sid => new Set((STU.arch || []).filter(r => r.student_id === sid).map(r => r.school_book));
progressRows = function (sid) {
  const _ar = stuArchSet(sid);
  let v = 0, g = (T.asg || []).filter(a => a.student_id === sid && !_ar.has(((T.uById[a.unit_id] || {}).school_book) || '교재 미정')).length, p = 0;
  try { v = stuVocabInfo(sid).length; p = stuPassInfo(sid).length; } catch (e) { /* 정보가 없어도 카드는 보여요 */ }
  const chip = (ic, n, un) => `<span class="sgchip ${n ? '' : 'zero'}">${ic} ${n}${un}</span>`;
  const ia = (STU.ivA || []).find(x => x.student_id === sid), iN = ia ? (ia.stages || []).filter(n => IV_STAGES.includes(n)).length : 0;
  return `<div class="sgline">${chip('📘 어휘', v, '권')}${chip('📗 문법', g, '단원')}${chip('📖 본문', p, '개')}${chip('🔁 불규칙', iN, '단계')}</div><i data-sid="${sid}" hidden></i>`;
};
const _tabToday = tabToday;
tabToday = function () {
  _tabToday();
  document.querySelectorAll('.scard').forEach(c => { if (c.querySelector('[data-sid]')) c.setAttribute('data-stucard', '1'); });
  if (!STU.loaded && !STU.loading) {
    STU.loading = true;
    stuLoad().then(() => { STU.loading = false; if (T.tab === 'today' && !T.stuSid && !document.querySelector('.modal-bg')) _tabToday2(); }).catch(() => { STU.loading = false; });
  }
};
function _tabToday2() { tabToday(); }

/* 카드·버튼을 누르면 학생 화면으로 */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-stuopen]');
  if (b) { e.preventDefault(); e.stopPropagation(); stuOpen(b.dataset.stuopen); return; }
  if (T.tab !== 'today' || T.stuSid) return;
  const card = e.target.closest('.scard[data-stucard]');
  if (!card || e.target.closest('button,a,input,select,textarea,label,[data-aedit],[data-adel]')) return;
  const m = card.querySelector('[data-sid]'); if (m) stuOpen(m.dataset.sid);
});
/* 왼쪽 메뉴를 누르면 학생 화면에서 나와요 */
document.addEventListener('click', e => { if (e.target.closest('[data-t]')) T.stuSid = null; }, true);
const _renderTab = renderTab;
renderTab = function () { if (T.tab === 'today' && T.stuSid) return stuView(T.stuSid); return _renderTab.apply(this, arguments); };

async function stuOpen(sid) {
  T.tab = 'today'; T.stuSid = sid;
  if (!document.getElementById('tb')) { drawTeacher(); return; }
  $('#tb').innerHTML = '<p class="muted">학생 화면을 불러오는 중…</p>';
  try { await stuLoad(); } catch (e) { /* 일부만 불러와도 보여요 */ }
  if (T.stuSid === sid) stuView(sid);
  window.scrollTo(0, 0);
}
async function stuReload(sid) { try { await loadTeacher(); await stuLoad(true); } catch (e) { toast(errText(e), 4000); } if (T.stuSid === sid) drawTeacher(); }

/* ---------- ② 학생 화면 ---------- */
function stuView(sid) {
  const s = T.sById[sid];
  if (!s) { T.stuSid = null; return tabToday(); }
  const today = dayKey(new Date());
  const at = T.byStu.get(sid) || [];
  const gToday = at.filter(a => dayKey(a.submitted_at) === today), gAll7 = at.filter(a => (Date.now() - new Date(a.submitted_at)) < 7 * 864e5);
  const gr = gToday.filter(a => a.status === 'graded');
  const vTm = STU.vtime.filter(r => r.student_id === sid);
  const vSum = from => vTm.filter(r => r.day >= from).reduce((n, r) => n + r.sec, 0);
  const kst = typeof kstToday === 'function' ? kstToday() : today;
  const vT0 = vSum(kst), vT7 = vSum(addDays(kst, -6));
  const gSec = list => timeSum(list).sec;
  const vo = (VT.ov && VT.ov.students || []).find(x => x.student_id === sid) || {};

  /* 학습 시간 14일 */
  const days = Array.from({ length: 14 }, (_, k) => addDays(kst, k - 13));
  const gByDay = {}; at.forEach(a => { const d = dayKey(a.submitted_at); gByDay[d] = (gByDay[d] || 0) + (a.time_spent_sec || 0); });
  const vByDay = {}; vTm.forEach(r => { vByDay[r.day] = (vByDay[r.day] || 0) + r.sec; });
  const mx = Math.max(60 * 20, ...days.map(d => (vByDay[d] || 0) + (gByDay[d] || 0)));
  const timeHtml = days.slice().reverse().map(d => { const v = vByDay[d] || 0, g = gByDay[d] || 0;
    return `<div class="tr"><span>${d.slice(5).replace('-', '/')}</span><div class="bar"><i class="v" style="width:${v / mx * 100}%"></i><i class="g" style="width:${g / mx * 100}%"></i></div><span>${v + g ? stuMin(v + g) : '-'}${v + g ? `<span class="tiny"> (어${Math.round(v / 60)}·문${Math.round(g / 60)})</span>` : ''}</span></div>`; }).join('');

  /* 어휘 */
  const lcard = (icon, title, chips, pctv, body, area) => `<details class="bkgrp"><summary><span class="bkg-cv"><span class="bkg-ph">${icon}</span></span><span class="bkg-i">${area ? `<span class="alb">${area}</span>` : ''}<b>${esc(title)}</b><span class="bkg-s">${chips}</span><span class="bkg-bar"><i style="width:${Math.max(0, Math.min(100, pctv || 0))}%"></i></span></span></summary><div class="bkg-body">${body}</div></details>`;
  const lgrid = h => h ? `<div class="bkgrid">${h}</div>` : '';
  const vInfo = stuVocabInfo(sid);
  const vHtml = vInfo.map(x => {
    const c = { ...vtDefaults(x.bk), ...(x.a.settings || {}) };
    const curBox = x.cur ? `<div style="margin-top:8px"><b>지금 공부 중 · ${esc(vtUnitWord(x.bk) === '과' ? x.cur.unit.ord + '과' : 'Unit ' + x.cur.unit.ord)} ${/^(unit|\d)/i.test(x.cur.unit.title || '') ? '' : esc((x.cur.unit.title || '').slice(0, 30))}</b>
      <div class="spills">${x.cur.steps.map(k => { const pr = x.cur.prog.find(p => p.step === k);
        const cls = pr ? 'done' : k === x.cur.next ? 'now' : '';
        return `<span class="spill ${cls}" title="${pr ? fmtDT(pr.done_at) : ''}">${pr ? '✓' : k === x.cur.next ? '▶' : '·'} ${esc(SV_STEP[k] || k)}${pr && pr.total ? ` <small>${pr.score}/${pr.total}</small>` : ''}${pr && pr.time_sec ? ` <small>${stuMin(pr.time_sec)}</small>` : ''}</span>`; }).join('')}</div></div>` : '<div class="tiny" style="margin-top:6px">모든 유닛을 통과했어요 🎉</div>';
    const chips = x.us.map(u => { const st = x.st(u), cls = st && st.passed_at ? 'ok' : st ? 'now' : 'lock';
      return `<button class="uchip ${cls}" data-vreset="${u.id}" title="${st ? `최고 ${st.best_pct}% · 테스트 ${st.tests}번 (누르면 처음부터 다시)` : '시작 전'}">${st && st.passed_at ? '✓' : ''}<span>${u.ord}</span>${st ? `<small>${st.best_pct}%</small>` : ''}</button>`; }).join('');
    return lcard('📘', x.bk.title, `<em class="f">✓ 통과 ${x.passed}/${x.us.length}</em><span class="tiny">${esc(vtLevelLabel(x.bk))}</span>`, pct(x.passed, x.us.length), `<div class="gu"><div class="row between" style="flex-wrap:wrap;gap:6px"><div><h3>${esc(x.bk.title)}</h3><span class="tiny">${esc(vtLevelLabel(x.bk))} · ${x.passed}/${x.us.length} ${esc(vtUnitWord(x.bk))} 통과</span></div>
      <div class="row" style="gap:6px"><button class="btn small ghost" data-vday="${x.a.id}">📅 Day별 단계</button><button class="btn small ghost" data-vset="${x.a.id}">⚙ 설정</button><button class="btn small ghost" data-vdel="${x.a.id}" style="color:#dc2626">해제</button></div></div>
      <div class="progress" style="margin:8px 0"><i style="width:${pct(x.passed, x.us.length) || 0}%"></i></div>${curBox}
      <div class="uchips" style="margin-top:8px">${chips}</div>
      <div class="stu-set">통과 ${c.pass_pct}% · 하루 새 ${vtUnitWord(x.bk)} ${c.units_per_day || '제한 없음'} · 첫 글자 힌트 ${c.first_letter ? '켬' : '끔'} · 기본 단계: ${stuVSteps(x.a).slice(0, -1).map(k => SV_STEP[k]).join(' → ')}${c.unit_steps && Object.keys(c.unit_steps).length ? ` · <b>Day별 따로 ${Object.keys(c.unit_steps).length}개</b>` : ''}</div></div>`, '📘 어휘');
  }).join('');
  
  const vRecent = STU.vprog.filter(p => p.student_id === sid).sort((a, b) => String(b.done_at).localeCompare(String(a.done_at))).slice(0, 8).map(r => {
    const u = VT.units.find(x => x.id === r.unit_id), b = u && vtBook(u.book_id);
    return `<tr><td class="tiny">${fmtDT(r.done_at)}</td><td>${esc(b ? b.title : '')} <b>${esc(u ? (u.title || 'Unit ' + u.ord) : '')}</b></td><td>${esc(SV_STEP[r.step] || r.step)}</td><td>${r.total ? r.score + '/' + r.total : '-'}</td><td>${stuMin(r.time_sec)}</td></tr>`; }).join('');

  /* 문법 · 내신(교과서) */
  const arSet = stuArchSet(sid);
  const asgsAll = T.asg.filter(a => a.student_id === sid);
  const bookOfA = a => ((T.uById[a.unit_id] || {}).school_book) || '교재 미정';
  const asgs = asgsAll.filter(a => !arSet.has(bookOfA(a)));
  const kindOf = a => { const u = T.uById[a.unit_id]; return bookKind(u && u.school_book || '교재 미정'); };
  const gCard = a => {
    const u = T.uById[a.unit_id]; if (!u) return null;
    const stg = STAGES.map(([k, n]) => ({ k, n, sm: tStage(a, k) })).filter(x => x.sm.total);
    let curK = null; for (const x of stg) if (!x.sm.finished) { curK = x.k; break; }
    const pills = stg.map(x => { const cls = x.sm.finished ? (x.sm.passed || x.sm.waiting ? 'done' : 'bad') : x.k === curK ? 'now' : '';
      return `<span class="spill ${cls}">${x.sm.finished ? (x.sm.passed || x.sm.waiting ? '✓' : '⚠') : x.k === curK ? '▶' : '·'} ${esc(x.n)} <small>${x.sm.done}/${x.sm.total}${x.sm.pct != null && x.sm.finished ? ' · ' + x.sm.pct + '%' : ''}</small></span>`; }).join('');
    const mine = at.filter(t => t.assignment_id === a.id), last = mine[0];
    const fin = stg.length && stg.every(x => x.sm.finished), started = stg.some(x => x.sm.done > 0);
    const pcts = stg.filter(x => x.sm.finished && x.sm.pct != null).map(x => x.sm.pct);
    const html = `<div class="gu ${fin ? 'fin' : started ? 'ing' : ''}"><div class="gu-h"><div class="gu-t"><b>${u.lesson ? esc(u.lesson) + ' · ' : ''}${esc(u.title)}</b>${roundBadge(a)}
        <div class="tiny">${a.due_date ? '마감 ' + esc(a.due_date) + ' · ' : ''}${stageLabel(a)} · 풀이 ${mine.length}번 · ${timeSum(mine).n ? fmtDur(timeSum(mine).sec) : '시간 -'}${last ? ' · 마지막 ' + fmtDT(last.submitted_at) : ''}</div></div>
        <div class="gu-b"><button class="btn small ghost" data-gstg="${a.id}">단계</button><button class="btn small ghost" data-grl="${a.id}">다시</button><button class="btn small ghost" data-ged="${a.id}">수정</button><button class="btn small ghost" data-gdel="${a.id}" style="color:#dc2626">삭제</button></div></div>
      <div class="spills">${pills || '<span class="tiny">공개된 문제가 아직 없어요</span>'}</div></div>`;
    return { a, u, html, fin, started, pcts, n: mine.length, sec: timeSum(mine).sec || 0 };
  };
  const gAll = asgsAll.map(gCard).filter(Boolean);
  const gGroups = new Map(); gAll.forEach(x => { const b = x.u.school_book || '교재 미정'; if (!gGroups.has(b)) gGroups.set(b, []); gGroups.get(b).push(x); });
  const gBookHtml = (b, isArch) => {
    const L = gGroups.get(b).sort((p, q) => unitSort(p.u, q.u)), nf = L.filter(x => x.fin).length, ni = L.filter(x => !x.fin && x.started).length, nn = L.length - nf - ni;
    const allp = L.flatMap(x => x.pcts), avg = allp.length ? Math.round(allp.reduce((p, q) => p + q, 0) / allp.length) : null;
    const tot = L.reduce((p, x) => p + x.sec, 0), cnt = L.reduce((p, x) => p + x.n, 0);
    return `<details class="bkgrp ${isArch ? 'arch' : ''}"><summary><span class="bkg-cv">${cvImg(b, 'big') || '<span class="bkg-ph">📗</span>'}</span>
      <span class="bkg-i"><span class="alb">${isArch ? '📦 종료' : '📗 문법'}</span><b>${esc(b)}</b><span class="bkg-s"><em class="f">✓ 완료 ${nf}</em><em class="i">▶ 진행 ${ni}</em><em class="n">· 시작 전 ${nn}</em><span class="tiny">총 ${L.length}단원${avg != null ? ' · 평균 ' + avg + '%' : ''} · 풀이 ${cnt}번${tot ? ' · ' + fmtDur(tot) : ''}</span></span>
      <span class="bkg-bar"><i style="width:${Math.round(nf / L.length * 100)}%"></i></span></span></summary>
      <div class="bkg-body"><div class="bkg-act">${isArch ? `<span class="tiny">학습 종료한 교재예요. 기록은 그대로 남아 있어요.</span><button class="btn small" data-gun="${esc(b)}">↩ 다시 학습 중으로</button>` : `<span class="tiny">이 교재 학습이 모두 끝났다면</span><button class="btn small" data-garch="${esc(b)}">📦 학습 종료</button>`}</div>${L.map(x => x.html).join('')}</div></details>`;
  };
  const gBooks = md => [...gGroups.keys()].filter(b => !arSet.has(b) && (md === 'naesin') === (bookKind(b) === 'naesin')).sort((x, y) => bookRank(x) - bookRank(y) || x.localeCompare(y, 'ko'));
  const gGen = gBooks('general').length ? `<div class="bkgrid">${gBooks('general').map(b => gBookHtml(b, false)).join('')}</div>` : '';
  const gArch = [...gGroups.keys()].filter(b => arSet.has(b)).sort((x, y) => x.localeCompare(y, 'ko'));
  const gArchHtml = gArch.length ? `<details class="archsec"><summary>📦 학습 종료한 교재 ${gArch.length}개 <span class="tiny">(눌러서 보기)</span></summary><div class="bkgrid">${gArch.map(b => gBookHtml(b, true)).join('')}</div></details>` : '';
  const gNae = gBooks('naesin').length ? `<div class="bkgrid">${gBooks('naesin').map(b => gBookHtml(b, false)).join('')}</div>` : '';

  /* 내신 본문 */
  const pInfo = stuPassInfo(sid);
  const pHtml = pInfo.map(x => { const dn = x.done.length, tot = x.total || 0;
    return lcard('📖', x.p.title, `<em class="${tot && dn >= tot ? 'f' : dn ? 'i' : 'n'}">${tot && dn >= tot ? '✓ 완료' : dn ? '▶ 진행' : '· 시작 전'} ${dn}${tot ? '/' + tot : ''}단계</em><span class="tiny">${esc(ptLabel(x.p))}</span>`, tot ? dn / tot * 100 : 0,
      `<div class="gu"><div class="row between" style="flex-wrap:wrap;gap:6px"><div><span class="tiny">${esc(ptLabel(x.p))} · 시간 ${stuMin(x.done.reduce((n, g) => n + (g.time_sec || 0), 0))}</span></div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><select data-ptr="${x.a.id}">${Object.entries(P_TRACK).map(([k, n]) => `<option value="${k}" ${x.a.track === k ? 'selected' : ''}>${n}</option>`).join('')}</select><button class="btn small ghost" data-prs="${x.a.id}">처음부터</button><button class="btn small ghost" data-pdel="${x.a.id}" style="color:#dc2626">해제</button></div></div>
      <div class="spills">${x.done.map(g => `<span class="spill done">✓ ${esc(P_STEP_NAME[g.step] || g.step)} <small>${g.total ? g.score + '/' + g.total : ''}</small></span>`).join('') || '<span class="tiny">아직 시작 전이에요</span>'}</div></div>`, '📖 내신 본문'); }).join('');

  /* 불규칙동사 */
  const ivA = (STU.ivA || []).find(x => x.student_id === sid), ivP = (STU.ivP || []).filter(x => x.student_id === sid && IV_BY.has(x.verb_no)), ivD = (STU.ivD || []).filter(x => x.student_id === sid);
  const ivTodayD = ivD.find(x => x.day === kst) || { new_n: 0, rev_n: 0, ok: 0, total: 0, sec: 0 };
  let ivHtml = '';
  if (ivA) {
    const have = new Set(ivP.map(x => x.verb_no)), dueN = ivP.filter(x => x.due_on <= kst).length, mst = ivP.filter(x => x.box >= 5).length;
    const stg = (ivA.stages || []).filter(n => IV_STAGES.includes(n)).sort((x, y) => x - y);
    const pills = stg.map(n => { const vs = ivStageVerbs(n), c = vs.filter(v => have.has(v.no)).length, full = c === vs.length;
      return `<span class="spill ${full ? 'done' : c ? 'now' : ''}">${full ? '✓' : c ? '▶' : '·'} ${ivStageName(n)} <small>${c}/${vs.length}</small></span>`; }).join('');
    const days7 = new Set(ivD.filter(x => x.day >= addDays(kst, -6) && (x.new_n || x.rev_n)).map(x => x.day)).size;
    const lastV = ivP.slice().sort((x, y) => String(y.last_at).localeCompare(String(x.last_at))).slice(0, 8).map(x => { const v = IV_BY.get(x.verb_no); return v ? `<span class="spill ${x.bad > x.ok ? 'bad' : ''}" title="맞힘 ${x.ok} · 틀림 ${x.bad}">${esc(v.base)} <small>${x.ok}/${x.ok + x.bad}</small></span>` : ''; }).join('');
    const ivTot = stg.reduce((n, k) => n + ivStageVerbs(k).length, 0), ivHave = stg.reduce((n, k) => n + ivStageVerbs(k).filter(v => have.has(v.no)).length, 0);
    ivHtml = (lcard('🔁', '불규칙동사', `<em class="f">외운 ${ivHave}/${ivTot}개</em><em class="i">암기 ${mst}</em><em class="n">복습 ${dueN}</em><span class="tiny">하루 ${ivA.per_day}개 · ${stg.length}개 단계 · 최근 7일 ${days7}일</span>`, ivTot ? ivHave / ivTot * 100 : 0, `<div class="gu"><div class="row between" style="flex-wrap:wrap;gap:6px"><div><h3>하루 ${ivA.per_day}개 · ${stg.length}개 단계 배정</h3><span class="tiny">외운 동사 ${have.size}개 · 완전 암기 ${mst}개 · 밀린 복습 ${dueN}개 · 최근 7일 ${days7}일 학습</span></div>
      <div class="row" style="gap:6px"><button class="btn small ghost" id="ivreset">처음부터</button><button class="btn small ghost" id="ivdel" style="color:#dc2626">배정 해제</button></div></div>
      <div class="spills">${pills || '<span class="tiny">배정된 단계가 없어요</span>'}</div>
      <div class="stu-set">오늘 새 ${ivTodayD.new_n}/${ivA.per_day}개 · 복습 ${ivTodayD.rev_n}개 · 정답 ${ivTodayD.ok}/${ivTodayD.total} · 시간 ${ivTodayD.sec ? stuMin(ivTodayD.sec) : '-'}${(ivA.settings && ivA.settings.hint === false) ? ' · 쓰기 힌트 끔' : ''}</div>
      ${lastV ? `<div class="tiny" style="margin-top:8px">최근 학습 (맞힘/시도)</div><div class="spills">${lastV}</div>` : ''}</div>`, '🔁 불규칙동사'));
  }
  const lastStudy = (() => {
    const c = [];
    if (at[0] && at[0].submitted_at) c.push(['문법', at[0].submitted_at]);
    at.forEach(x => { if (x.submitted_at) c.push(['문법', x.submitted_at]); });
    STU.vprog.filter(p => p.student_id === sid).forEach(p => p.done_at && c.push(['어휘', p.done_at]));
    (STU.pprog || []).filter(p => p.student_id === sid).forEach(p => p.done_at && c.push(['내신 본문', p.done_at]));
    (STU.ivP || []).filter(p => p.student_id === sid).forEach(p => p.last_at && c.push(['불규칙동사', p.last_at]));
    let best = null; c.forEach(x => { if (!best || new Date(x[1]) > new Date(best[1])) best = x; });
    if (!best) return { t: null };
    const m = Math.max(0, Math.round((Date.now() - new Date(best[1])) / 60000)), d = Math.floor(m / 1440);
    const ago = m < 1 ? '방금' : m < 60 ? m + '분 전' : m < 1440 ? Math.floor(m / 60) + '시간 전' : d + '일 전';
    return { t: best[1], src: best[0], ago };
  })();
  const emp = (ic, t, btn) => `<div class="ph-empty" data-clickbtn="${btn}">${ic} ${t}<small>배정 없음 · 눌러서 배정</small></div>`;
  const emptyCards = (vHtml ? '' : emp('📘', '어휘', 'vadd')) + ((gGen || gNae) ? '' : emp('📗', '문법', 'gadd')) + (pHtml ? '' : emp('📖', '내신 본문', 'padd')) + (ivHtml ? '' : emp('🔁', '불규칙동사', 'ivset'));
  $('#tb').innerHTML = `
    <div class="row between noprint" style="margin-bottom:8px"><button class="btn ghost small" id="stuback">← 전체 학생</button>
      <span class="row" style="gap:6px"><select id="stuswitch">${T.students.map(x => `<option value="${x.id}" ${x.id === sid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><button class="btn ghost small" id="sturl">새로고침</button></span></div>
    <section class="hero"><div><small>학생 화면</small><h1>${esc(s.name)} <span style="font-size:15px;font-weight:600;opacity:.8">${esc(s.grade || '')}</span></h1>
      <p>어휘 ${vInfo.length}권 · 문법 ${asgs.length}단원 · 내신 본문 ${pInfo.length}개 배정${gToday.length || vT0 ? ` · 오늘 ${vT0 + gSec(gToday) > 0 ? stuMin(vT0 + gSec(gToday)) : '학습 있음'} 학습` : ' · 오늘 학습 없음'}</p></div>
      <div class="upd">마지막 새로고침<br><b>${fmtDT(T.lastLoad)}</b><div class="hbtns noprint"><button id="stureport2">📄 학습 리포트 만들기</button><button id="stureport">문법 상세·오답노트</button></div></div></section>
    <section class="kpis k5">
      <div class="kpi calk" data-cal="1" title="눌러서 학습 달력 보기"><small>마지막 학습 📅</small><b style="font-size:1.35rem">${lastStudy.t ? fmtDT(lastStudy.t) : '-'}</b><span>${lastStudy.t ? esc(lastStudy.src) + ' · ' + lastStudy.ago : '학습 기록 없음'}</span></div>
      <div class="kpi calk" data-cal="1" title="눌러서 학습 달력 보기"><small>오늘 학습 시간 📅</small><b>${stuMin(vT0 + gSec(gToday))}</b><span>어휘 ${stuMin(vT0)} · 문법 ${stuMin(gSec(gToday))}</span></div>
      <div class="kpi calk" data-cal="1" title="눌러서 학습 달력 보기"><small>최근 7일 (총 학습시간) 📅</small><b>${stuMin(vT7 + gSec(gAll7))}</b><span>어휘 ${stuMin(vT7)} · 문법 ${stuMin(gSec(gAll7))}</span></div>
      <div class="kpi"><small>어휘</small><b>${vo.learned || 0}<em>개</em></b><span>외운 단어 · 밀린 복습 ${vo.due || 0}개</span></div>
      <div class="kpi"><small>문법 오늘</small><b>${gToday.length}<em>회</em></b><span>${gr.length ? '정답률 ' + pct(gr.filter(a => a.is_correct).length, gr.length) + '%' : '채점 완료 없음'}</span></div>
    </section>

    <div class="stu-sec"><h2>📚 지금 학습 중</h2><div class="row noprint" style="gap:6px;flex-wrap:wrap"><button class="btn small" id="vadd">+ 단어장</button><button class="btn small" id="gadd">+ 문법 단원</button><button class="btn small" id="padd">+ 내신 본문</button><button class="btn small" id="ivset">${ivA ? '⚙ 불규칙동사' : '+ 불규칙동사'}</button></div></div>
    <div class="bkgrid">${vHtml}${gGen}${gNae}${pHtml}${ivHtml}${emptyCards}</div>
    ${gArchHtml}
    ${vRecent ? `<div class="card" style="margin-top:12px"><h3 style="margin:0 0 6px">최근 어휘 학습</h3><div class="tablewrap"><table><thead><tr><th>시각</th><th>교재 · 유닛</th><th>단계</th><th>점수</th><th>시간</th></tr></thead><tbody>${vRecent}</tbody></table></div></div>` : ''}`;
  stuBind(sid);
}

/* ---------- 버튼 연결 ---------- */
function stuBind(sid) {
  const s = T.sById[sid];
  $('#stuback').onclick = () => { T.stuSid = null; tabToday(); window.scrollTo(0, 0); };
  $('#sturl').onclick = async () => { await stuReload(sid); toast('새로 불러왔어요'); };
  $('#stuswitch').onchange = e => stuOpen(e.target.value);
  document.querySelectorAll('[data-cal]').forEach(k => k.onclick = () => stuCal(sid));
  const _r2 = document.getElementById('stureport2'); if (_r2) _r2.onclick = () => stuReport(sid, 30);
  $('#stureport').onclick = () => { T.stuSid = null; T.tab = 'students'; T.view = sid; drawTeacher(); };
  $('#vadd').onclick = () => stuVAssign(sid);
  $('#ivset').onclick = () => stuIvSet(sid);
  if ($('#ivreset')) $('#ivreset').onclick = async () => {
    if (!confirm('이 학생의 불규칙동사 학습 기록을 모두 지우고 처음부터 다시 시작할까요?')) return;
    const { error } = await S.sb.from('iv_progress').delete().eq('student_id', sid); if (error) return toast(errText(error), 4000);
    await S.sb.from('iv_day').delete().eq('student_id', sid);
    STU.ivP = STU.ivP.filter(x => x.student_id !== sid); STU.ivD = STU.ivD.filter(x => x.student_id !== sid); toast('처음부터 다시 시작해요'); stuView(sid);
  };
  if ($('#ivdel')) $('#ivdel').onclick = async () => {
    if (!confirm('불규칙동사 배정을 해제할까요? (학습 기록은 남아요)')) return;
    const { error } = await S.sb.from('iv_assign').delete().eq('student_id', sid); if (error) return toast(errText(error), 4000);
    STU.ivA = STU.ivA.filter(x => x.student_id !== sid); toast('해제했어요'); stuView(sid);
  };
  $('#gadd').onclick = () => stuGAssign(sid);
  $('#padd').onclick = () => stuPAssign(sid);
  /* 어휘 */
  document.querySelectorAll('[data-vset]').forEach(b => b.onclick = () => {
    const a = VT.asg.find(x => x.id === b.dataset.vset), bk = vtBook(a.book_id);
    const m = modal(`<h2>${esc(s.name)} · ${esc(bk.title)}</h2>${vtSettingsForm({ ...vtDefaults(bk), ...(a.settings || {}) }, a.start_ord || 1, bk)}
      <div class="row" style="margin-top:12px"><button class="btn" id="sv">저장</button><button class="btn ghost" id="cx">취소</button></div>`);
    vtBindSteps(m); m.querySelector('#cx').onclick = () => m.remove();
    m.querySelector('#sv').onclick = async () => {
      const { settings, start } = vtReadSettings(m);
      if (a.settings && a.settings.unit_steps) settings.unit_steps = a.settings.unit_steps;
      const { error } = await S.sb.from('vocab_assignments').update({ settings, start_ord: start }).eq('id', a.id);
      if (error) return toast(errText(error), 4000);
      a.settings = settings; a.start_ord = start; m.remove(); toast('저장했어요'); stuView(sid);
    };
  });
  document.querySelectorAll('[data-vday]').forEach(b => b.onclick = () => stuDaySteps(sid, b.dataset.vday));
  document.querySelectorAll('[data-vdel]').forEach(b => b.onclick = async () => {
    if (!confirm('이 단어장 배정을 해제할까요? 학생 화면에서 사라져요. (학습 기록은 남아요)')) return;
    const { error } = await S.sb.from('vocab_assignments').delete().eq('id', b.dataset.vdel);
    if (error) return toast(errText(error), 4000);
    VT.asg = VT.asg.filter(a => a.id !== b.dataset.vdel); toast('해제했어요'); stuView(sid);
  });
  document.querySelectorAll('[data-vreset]').forEach(b => b.onclick = async () => {
    const u = VT.units.find(x => x.id === b.dataset.vreset);
    if (!confirm(`${s.name} 학생의 ${u.title || 'Unit ' + u.ord}을(를) 처음부터 다시 학습시킬까요? (지난 답안 기록은 남아요)`)) return;
    const { error } = await S.sb.rpc('vocab_reset_unit', { p_student: sid, p_unit: u.id });
    if (error) return toast(errText(error), 4000);
    VT.ustat = VT.ustat.filter(x => !(x.student_id === sid && x.unit_id === u.id));
    STU.vprog = STU.vprog.filter(p => !(p.student_id === sid && p.unit_id === u.id));
    toast('다시 학습하도록 바꿨어요'); stuView(sid);
  });
  /* 문법 */
  document.querySelectorAll('[data-gstg]').forEach(b => b.onclick = () => stageModal(b.dataset.gstg));
  document.querySelectorAll('[data-grl]').forEach(b => b.onclick = () => relearnModal(b.dataset.grl));
  document.querySelectorAll('[data-ged]').forEach(b => b.onclick = () => asgEdit(b.dataset.ged));
  document.querySelectorAll('[data-gdel]').forEach(b => b.onclick = () => asgDelete(b.dataset.gdel));
  document.querySelectorAll('[data-clickbtn]').forEach(b => b.onclick = () => { const t = document.getElementById(b.dataset.clickbtn); if (t) t.click(); });
  document.querySelectorAll('[data-garch]').forEach(b => b.onclick = async e => { e.preventDefault(); const bk = b.dataset.garch;
    if (!confirm(`「${bk}」 학습을 종료할까요?\n현재 학습 목록에서 숨겨지고(학생 화면에서도), 「학습 종료한 교재」로 옮겨져요.\n풀이 기록은 그대로 남아 있고 언제든 되돌릴 수 있어요.`)) return;
    const { error } = await S.sb.from('book_archive').upsert({ student_id: sid, school_book: bk }, { onConflict: 'student_id,school_book' });
    if (error) return toast(errText(error), 4000); toast('학습 종료로 옮겼어요'); await stuReload(sid); });
  document.querySelectorAll('[data-gun]').forEach(b => b.onclick = async e => { e.preventDefault();
    const { error } = await S.sb.from('book_archive').delete().eq('student_id', sid).eq('school_book', b.dataset.gun);
    if (error) return toast(errText(error), 4000); toast('다시 학습 중으로 되돌렸어요'); await stuReload(sid); });
  /* 내신 본문 */
  document.querySelectorAll('[data-ptr]').forEach(sel => sel.onchange = async () => {
    const { error } = await S.sb.from('passage_assignments').update({ track: sel.value }).eq('id', sel.dataset.ptr);
    if (error) return toast(errText(error), 4000);
    PT.asg.find(a => a.id === sel.dataset.ptr).track = sel.value; toast('수준을 바꿨어요');
  });
  document.querySelectorAll('[data-prs]').forEach(b => b.onclick = async () => {
    const a = PT.asg.find(x => x.id === b.dataset.prs);
    if (!confirm('이 본문을 처음 단계부터 다시 학습시킬까요? (답안 기록은 남아요)')) return;
    const { error } = await S.sb.rpc('passage_reset', { p_student: a.student_id, p_passage: a.passage_id }); if (error) return toast(errText(error), 4000);
    STU.pprog = STU.pprog.filter(g => !(g.student_id === a.student_id && g.passage_id === a.passage_id)); toast('처음부터 다시 하도록 바꿨어요'); stuView(sid);
  });
  document.querySelectorAll('[data-pdel]').forEach(b => b.onclick = async () => {
    if (!confirm('이 본문 배정을 해제할까요? (학습 기록은 남아요)')) return;
    const { error } = await S.sb.from('passage_assignments').delete().eq('id', b.dataset.pdel); if (error) return toast(errText(error), 4000);
    PT.asg = PT.asg.filter(a => a.id !== b.dataset.pdel); toast('해제했어요'); stuView(sid);
  });
}

/* ---------- 이 학생에게 배정하기 ---------- */
function stuVAssign(sid) {
  const s = T.sById[sid], pub = VT.books.filter(b => b.status === 'published');
  if (!pub.length) return toast('공개된 단어장이 없어요. 어휘 탭의 단어장에서 학생에게 공개해 주세요');
  const have = new Set(VT.asg.filter(a => a.student_id === sid).map(a => a.book_id));
  const m = modal(`<h2>${esc(s.name)} · 단어장 배정</h2>
    <label>단어장</label><select id="abk">${pub.map(b => `<option value="${b.id}">${have.has(b.id) ? '✓ ' : ''}${esc(b.title)} (${esc(vtLevelLabel(b))} · ${vtUnits(b.id).length}유닛)</option>`).join('')}</select>
    <div id="aset">${vtSettingsForm(vtDefaults(vtBook(pub[0].id)), 1, vtBook(pub[0].id))}</div>
    <p class="tiny">✓ 표시는 이미 배정된 단어장이에요. 다시 저장하면 설정만 바뀌고 학습 기록은 그대로예요.</p>
    <div class="row" style="margin-top:12px"><button class="btn" id="sv">배정하기</button><button class="btn ghost" id="cx">취소</button></div>`);
  vtBindSteps(m);
  m.querySelector('#abk').onchange = e => { const bk = vtBook(e.target.value); m.querySelector('#aset').innerHTML = vtSettingsForm(vtDefaults(bk), 1, bk); vtBindSteps(m); };
  m.querySelector('#cx').onclick = () => m.remove();
  m.querySelector('#sv').onclick = async () => {
    const { settings, start } = vtReadSettings(m), book = m.querySelector('#abk').value;
    const old = VT.asg.find(x => x.student_id === sid && x.book_id === book);
    if (old && old.settings && old.settings.unit_steps) settings.unit_steps = old.settings.unit_steps;
    const { error } = await S.sb.from('vocab_assignments').upsert([{ student_id: sid, book_id: book, settings, start_ord: start }], { onConflict: 'student_id,book_id' });
    if (error) return toast(errText(error), 4000);
    m.remove(); toast('배정했어요'); await stuReload(sid);
  };
}
function stuGAssign(sid) {
  const s = T.sById[sid];
  let mode = 'general';
  const had = new Set(T.asg.filter(a => a.student_id === sid).map(a => a.unit_id));
  const approvedN = u => T.questions.filter(q => q.unit_id === u.id && q.review_status === 'approved').length;
  const bk = new Map(); T.units.forEach(u => { const k = u.school_book || '교재 미정'; if (!bk.has(k)) bk.set(k, []); bk.get(k).push(u); });
  const booksOf = md => [...bk.keys()].filter(b => bookKind(b) === md).sort((x, y) => bookRank(x) - bookRank(y) || x.localeCompare(y, 'ko'));
  const m = modal(`<h2>${esc(s.name)} · 문법 단원 배정</h2>
    <div class="modebar"><button type="button" class="mbtn on" data-gm="general">📘 일반 교재</button><button type="button" class="mbtn" data-gm="naesin">🏫 내신 대비</button></div>
    <label style="margin-top:8px">교재</label><div class="row" style="gap:10px;align-items:center"><span id="gcv"></span><select id="gbk" style="flex:1"></select></div>
    <label style="margin-top:8px">단원 <span class="tiny">(여러 개 고를 수 있어요 · 이미 배정된 단원은 회색)</span></label><div class="picks col" id="gun" style="max-height:260px;overflow:auto"></div>
    <div class="setgrid" style="margin-top:8px"><div><label>마감일 (선택)</label><input type="date" id="gd"></div><div><label>단계별 문항 수</label><input type="number" id="gp" min="1" max="20" value="5"></div>
      <div><label>통과 기준 (%)</label><input type="number" id="gc" min="1" max="100" value="80"></div><div><label>다시 풀기 횟수</label><input type="number" id="gr" min="0" max="10" value="2"></div>
      <div><label>내신대비 문항 수</label><input type="number" id="ge" min="1" max="20" value="8"></div></div>
    <div style="margin-top:8px"><label>학습할 단계 <span class="tiny">(아이 실력에 맞게 골라요)</span></label>${stagePickHtml('gst', null)}</div>
    <div class="row" style="margin-top:12px"><button class="btn" id="gsv">배정하기</button><button class="btn ghost" id="gcx">취소</button></div>`);
  const drawUnits = () => {
    const b = m.querySelector('#gbk').value; m.querySelector('#gcv').innerHTML = cvImg(b, 'big'); 
    const _b = b, list = (bk.get(b) || []).slice().sort(unitSort);
    m.querySelector('#gun').innerHTML = list.map(u => { const n = approvedN(u), h = had.has(u.id);
      return `<label class="pick wide ${n ? '' : 'off'}" style="${h ? 'opacity:.5' : ''}"><input type="checkbox" name="gu" value="${u.id}" ${h ? 'disabled' : ''}><span>${u.lesson ? esc(u.lesson) + ' · ' : ''}${esc(u.title)}</span><i class="tiny">${h ? '배정됨' : n ? '공개 ' + n : '공개 0 · 승인 필요'}</i></label>`; }).join('') || '<p class="tiny">이 교재에 단원이 없어요.</p>';
  };
  const drawBooks = () => { const bs = booksOf(mode); m.querySelector('#gbk').innerHTML = bs.map(b => `<option>${esc(b)}</option>`).join('') || '<option value="">교재 없음</option>'; drawUnits(); };
  m.querySelectorAll('[data-gm]').forEach(b => b.onclick = () => { mode = b.dataset.gm; m.querySelectorAll('[data-gm]').forEach(x => x.classList.toggle('on', x === b)); drawBooks(); });
  m.querySelector('#gbk').onchange = drawUnits; drawBooks();
  m.querySelector('#gcx').onclick = () => m.remove();
  m.querySelector('#gsv').onclick = async () => {
    const uids = [...m.querySelectorAll('[name=gu]:checked')].map(x => x.value);
    if (!uids.length) return toast('단원을 하나 이상 골라 주세요');
    const picked = stagePicked('gst'); if (!picked.length) return toast('학습할 단계를 하나 이상 골라 주세요');
    const num = (id, d) => { const v = parseInt(m.querySelector(id).value, 10); return isNaN(v) ? d : v; };
    const mk = u => { const sc = { exam: /-hit$/.test((T.uById[u] || {}).code || '') ? 200 : num('#ge', 8) }; STAGES.forEach(([k]) => { if (!picked.includes(k)) sc[k] = 0; });
      return { per_stage: num('#gp', 5), pass_pct: num('#gc', 80), max_retries: num('#gr', 2), stage_counts: sc }; };
    const rows = uids.map(u => ({ student_id: sid, unit_id: u, due_date: m.querySelector('#gd').value || null, settings: mk(u) }));
    const { error } = await S.sb.from('assignments').upsert(rows, { onConflict: 'student_id,unit_id' });
    if (error) return toast(errText(error), 4000);
    m.remove(); toast(`${rows.length}개 단원을 배정했어요`); await stuReload(sid);
  };
}
function stuPAssign(sid) {
  const s = T.sById[sid], pub = (PT.passages || []).filter(p => p.status === 'published');
  if (!pub.length) return toast('공개된 본문이 없어요. 내신 본문 탭에서 본문을 만들고 학생에게 공개해 주세요');
  const have = new Set(PT.asg.filter(a => a.student_id === sid).map(a => a.passage_id));
  const m = modal(`<h2>${esc(s.name)} · 본문 배정</h2>
    <label>본문</label><select id="ppk">${pub.map(p => `<option value="${p.id}">${have.has(p.id) ? '✓ ' : ''}${esc(p.title)} (${esc(ptLabel(p))} · ${ptSents(p.id).length}문장)</option>`).join('')}</select>
    <label style="margin-top:10px">수준</label><div class="picks">${Object.entries(P_TRACK).map(([k, n]) => `<label class="pick"><input type="radio" name="ptr" value="${k}" ${k === 'normal' ? 'checked' : ''}> ${n}</label>`).join('')}</div>
    <p class="tiny">🌱 기초: 핵심 문장만 · 🌿 기본: 모든 문장 · 🌳 심화: 더 어려운 문제. ✓ 표시는 이미 배정된 본문이에요(수준만 바뀌어요).</p>
    <div class="row" style="margin-top:12px"><button class="btn" id="sv">배정하기</button><button class="btn ghost" id="cx">취소</button></div>`);
  m.querySelector('#cx').onclick = () => m.remove();
  m.querySelector('#sv').onclick = async () => {
    const track = m.querySelector('[name=ptr]:checked').value, pid = m.querySelector('#ppk').value;
    const { error } = await S.sb.from('passage_assignments').upsert([{ student_id: sid, passage_id: pid, track }], { onConflict: 'student_id,passage_id' });
    if (error) return toast(errText(error), 4000);
    m.remove(); toast('배정했어요'); await stuReload(sid);
  };
}

/* ---------- Day(유닛)마다 학습 단계 따로 정하기 ---------- */
function stuDaySteps(sid, aid) {
  const s = T.sById[sid], a = VT.asg.find(x => x.id === aid), bk = vtBook(a.book_id), uw = vtUnitWord(bk) === '과' ? '과' : 'Day';
  const base = stuVSteps(a).slice(0, -1), us = (a.settings && a.settings.unit_steps) || {}, units = vtAsgUnits(a);
  const opts = SV_ORDER.map(k => [k, SV_STEP[k]]);
  const rows = units.map(u => { const on = Array.isArray(us[u.ord]) && us[u.ord].length ? us[u.ord] : base;
    return `<tr data-ord="${u.ord}"><td style="white-space:nowrap"><b>${u.ord}${uw === '과' ? '과' : ''}</b>${uw === 'Day' ? ' <span class="tiny">Day</span>' : ''}</td>${opts.map(([k]) => `<td style="text-align:center"><input type="checkbox" data-k="${k}" ${on.includes(k) ? 'checked' : ''}></td>`).join('')}<td class="tiny" data-tag>${Array.isArray(us[u.ord]) && us[u.ord].length ? '따로' : '기본'}</td></tr>`; }).join('');
  const m = modal(`<h2>${esc(s.name)} · ${esc(bk.title)} — ${uw}별 학습 단계</h2>
    <p class="tiny">${uw}마다 해야 할 단계를 골라요. 유닛 테스트는 늘 마지막에 있어요. 기본(설정에서 고른 단계)과 같으면 「기본」으로 남아요. 이미 끝낸 단계의 기록은 그대로예요.</p>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin:6px 0"><span class="tiny">전체에 적용:</span><button type="button" class="btn small ghost" data-p="basic">기초</button><button type="button" class="btn small ghost" data-p="std">표준</button><button type="button" class="btn small ghost" data-p="adv">심화</button><button type="button" class="btn small ghost" data-p="def">기본으로 되돌리기</button></div>
    <div class="tablewrap" style="max-height:52vh;overflow:auto"><table><thead><tr><th>${uw}</th>${opts.map(([k, n]) => `<th style="font-size:11px">${esc(n)}</th>`).join('')}<th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="row" style="margin-top:12px"><button class="btn" id="sv">저장</button><button class="btn ghost" id="cx">취소</button></div>`);
  const PRE = { basic: ['look', 'memorize', 'check', 'write', 'match', 'pos', 'sent'], std: ['look', 'memorize', 'check', 'write', 'match'], adv: ['check', 'write'] };
  const setRow = (tr, list) => tr.querySelectorAll('input').forEach(i => { i.checked = list.includes(i.dataset.k); });
  const rowSteps = tr => [...tr.querySelectorAll('input:checked')].map(i => i.dataset.k);
  const same = (x, y) => x.length === y.length && x.every(k => y.includes(k));
  const tag = tr => { tr.querySelector('[data-tag]').textContent = same(rowSteps(tr), base) ? '기본' : '따로'; };
  m.querySelectorAll('tbody tr').forEach(tr => tr.addEventListener('change', () => tag(tr)));
  m.querySelectorAll('[data-p]').forEach(b => b.onclick = () => m.querySelectorAll('tbody tr').forEach(tr => { setRow(tr, b.dataset.p === 'def' ? base : PRE[b.dataset.p]); tag(tr); }));
  m.querySelector('#cx').onclick = () => m.remove();
  m.querySelector('#sv').onclick = async () => {
    const out = {}; let bad = null;
    m.querySelectorAll('tbody tr').forEach(tr => { const l = rowSteps(tr); if (!l.length) bad = tr.dataset.ord; else if (!same(l, base)) out[tr.dataset.ord] = SV_ORDER.filter(k => l.includes(k)); });
    if (bad) return toast(`${bad}번은 단계를 하나 이상 골라 주세요`, 3500);
    const settings = { ...(a.settings || {}) };
    if (Object.keys(out).length) settings.unit_steps = out; else delete settings.unit_steps;
    const { error } = await S.sb.from('vocab_assignments').update({ settings }).eq('id', a.id);
    if (error) return toast(errText(error), 4000);
    a.settings = settings; m.remove(); toast('저장했어요'); stuView(sid);
  };
}

/* ---------- 불규칙동사 배정 (단계·하루 개수·옵션) ---------- */
function stuIvSet(sid) {
  const s = T.sById[sid], old = (STU.ivA || []).find(x => x.student_id === sid);
  let sel = new Set(old ? old.stages.filter(n => IV_STAGES.includes(n)) : [1]);
  const cfg = (old && old.settings) || {};
  const m = modal(`<h2>${esc(s.name)} · 불규칙동사 배정</h2>
    <label>배울 단계 <span class="tiny">여러 단계를 골라도 돼요 · 번호가 낮은 단계부터 차례로 나와요</span></label>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin:6px 0"><button type="button" class="btn small ghost" data-q="1-3">1~3단계</button><button type="button" class="btn small ghost" data-q="1-5">1~5단계 (핵심)</button><button type="button" class="btn small ghost" data-q="6-8">6~8단계 (확장)</button><button type="button" class="btn small ghost" data-q="21-99">교과 빈출 전체</button><button type="button" class="btn small ghost" data-q="0">모두 해제</button></div>
    <div class="tiny" style="margin:4px 0">📗 기본 불규칙동사 (1~77번)</div>
    <div class="uchips" id="ivst">${IV_STAGE_MAIN.map(n => { const vs = ivStageVerbs(n); return `<label class="uchip pickable wide" title="${esc(vs.map(v => v.base).join(', '))}"><input type="checkbox" data-st="${n}" ${sel.has(n) ? 'checked' : ''}><span>${n}단계</span><small>${vs[0].no}~${vs[vs.length - 1].no}번</small></label>`; }).join('')}</div>
    <div class="tiny" style="margin:8px 0 4px">⭐ 중·고등 교과 빈출 (혼동 동사 · 추가 불규칙 · 철자가 바뀌는 규칙동사)</div>
    <div class="uchips">${IV_STAGE_EX.map(n => { const vs = ivStageVerbs(n); return `<label class="uchip pickable wide" title="${esc(vs.map(v => v.base).join(', '))}"><input type="checkbox" data-st="${n}" ${sel.has(n) ? 'checked' : ''}><span>${ivStageName(n)}</span><small>${vs.length}개</small></label>`; }).join('')}</div>
    <div class="tiny" id="ivsum" style="margin:6px 0"></div>
    <div class="setgrid">
      <div><label>하루 새 동사 수</label><input type="number" id="ivpd" min="1" max="30" value="${old ? old.per_day : 5}"><div class="row" style="gap:6px;margin-top:4px"><button type="button" class="btn small ghost" data-pd="3">3</button><button type="button" class="btn small ghost" data-pd="5">5</button><button type="button" class="btn small ghost" data-pd="10">10</button></div><div class="tiny">아이 수준에 맞게 정해요 (처음엔 3~5개 권해요)</div></div>
      <div><label>한 번에 복습할 최대 개수</label><input type="number" id="ivrc" min="5" max="50" value="${cfg.review_cap || 15}"></div>
      <div><label class="pick"><input type="checkbox" id="ivhint" ${cfg.hint === false ? '' : 'checked'}> 쓰기 연습에 첫 글자 힌트 보이기</label></div>
      <div><label>발음 속도</label><select id="ivrate"><option value="0.7" ${cfg.rate === 0.7 ? 'selected' : ''}>천천히</option><option value="0.85" ${!cfg.rate || cfg.rate === 0.85 ? 'selected' : ''}>보통</option><option value="1" ${cfg.rate === 1 ? 'selected' : ''}>빠르게</option></select></div>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn" id="sv">저장</button><button class="btn ghost" id="cx">취소</button></div>`);
  const sum = () => { sel = new Set([...m.querySelectorAll('[data-st]:checked')].map(i => +i.dataset.st)); const n = [...sel].reduce((t, k) => t + ivStageVerbs(k).length, 0), pd = +m.querySelector('#ivpd').value || 5; m.querySelector('#ivsum').textContent = sel.size ? `선택한 ${sel.size}개 단계 · 동사 ${n}개 · 하루 ${pd}개면 약 ${Math.ceil(n / pd)}일 걸려요` : '단계를 하나 이상 골라 주세요'; };
  m.querySelectorAll('[data-st]').forEach(i => i.onchange = sum); m.querySelector('#ivpd').oninput = sum;
  m.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const [a, z] = b.dataset.q.split('-').map(Number); m.querySelectorAll('[data-st]').forEach(i => { i.checked = !!a && +i.dataset.st >= a && +i.dataset.st <= z; }); sum(); });
  m.querySelectorAll('[data-pd]').forEach(b => b.onclick = () => { m.querySelector('#ivpd').value = b.dataset.pd; sum(); });
  m.querySelector('#cx').onclick = () => m.remove(); sum();
  m.querySelector('#sv').onclick = async () => {
    sum(); if (!sel.size) return toast('단계를 하나 이상 골라 주세요');
    const row = { student_id: sid, stages: [...sel].sort((a, b) => a - b), per_day: Math.max(1, Math.min(30, +m.querySelector('#ivpd').value || 5)),
      settings: { hint: m.querySelector('#ivhint').checked, review_cap: Math.max(5, Math.min(50, +m.querySelector('#ivrc').value || 15)), rate: +m.querySelector('#ivrate').value }, updated_at: new Date().toISOString() };
    const { error } = await S.sb.from('iv_assign').upsert([row], { onConflict: 'student_id' });
    if (error) return toast(errText(error), 4000);
    STU.ivA = (STU.ivA || []).filter(x => x.student_id !== sid).concat([row]); m.remove(); toast('저장했어요'); stuView(sid);
  };
}
