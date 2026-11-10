/* 심쿵문법 - 학생 미션 홈 · 오답 프린트(학생/원장님) */
'use strict';
(function () {
  if (document.getElementById('s2-css')) return;
  const st = document.createElement('style'); st.id = 's2-css';
  st.textContent = `
.s2-hero{position:relative;overflow:hidden;border-radius:22px;padding:20px 20px 18px;color:#fff;margin-bottom:14px;
  background:radial-gradient(120% 140% at 100% 0%,rgba(125,211,252,.55),transparent 55%),linear-gradient(135deg,#4338ca,#4f46e5 45%,#2563eb);box-shadow:0 14px 30px rgba(67,56,202,.28)}
.s2-hero h1{color:#fff;font-size:1.35rem;margin:0 0 4px}
.s2-hero .sub{opacity:.85;font-size:.9rem}
.s2-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
.s2-chip{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:4px 10px;font-size:.82rem;font-weight:700}
.s2-lv{margin-top:12px}.s2-lv .bar{height:8px;background:rgba(255,255,255,.22);border-radius:99px;overflow:hidden}.s2-lv .bar i{display:block;height:100%;background:linear-gradient(90deg,#a5f3fc,#fff);border-radius:99px}
.s2-lv .t{display:flex;justify-content:space-between;font-size:.76rem;opacity:.9;margin-bottom:4px}
.s2-ring{position:absolute;right:16px;top:16px;width:78px;height:78px}
.s2-ring svg{transform:rotate(-90deg)}.s2-ring .c{position:absolute;inset:0;display:grid;place-items:center;text-align:center;line-height:1.1}
.s2-ring .c b{font-size:1.15rem}.s2-ring .c small{font-size:.66rem;opacity:.85;display:block}
.s2-now{border:2px solid #6366f1;background:linear-gradient(180deg,#f5f7ff,#fff);border-radius:20px;padding:16px;margin-bottom:16px;box-shadow:0 10px 26px rgba(79,70,229,.14)}
.s2-now .lbl{font-size:.78rem;font-weight:800;color:#4f46e5;letter-spacing:.02em}
.s2-now h2{margin:4px 0 2px;font-size:1.15rem}
.s2-now .meta{color:#64748b;font-size:.86rem}
.s2-now .go{width:100%;margin-top:12px;padding:14px;font-size:1.05rem;border-radius:14px}
.s2-sec{display:flex;justify-content:space-between;align-items:baseline;margin:18px 2px 8px}
.s2-sec h3{margin:0;font-size:1.02rem}.s2-sec span{color:#64748b;font-size:.82rem}
.s2-m{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px;margin-bottom:10px;cursor:pointer;transition:transform .12s, box-shadow .12s}
.s2-m:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(15,23,42,.08)}
.s2-m .top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.s2-m .top b{font-size:.98rem;line-height:1.35}.s2-m .book{color:#64748b;font-size:.78rem}
.s2-due{font-size:.72rem;font-weight:800;padding:3px 8px;border-radius:999px;background:#eef2ff;color:#4338ca;white-space:nowrap}
.s2-due.hot{background:#fef2f2;color:#dc2626}
.s2-steps{display:flex;gap:4px;margin-top:10px;flex-wrap:wrap}
.s2-steps span{font-size:.72rem;font-weight:700;padding:3px 7px;border-radius:8px;background:#f1f5f9;color:#94a3b8}
.s2-steps span.done{background:#ecfdf5;color:#059669}.s2-steps span.cur{background:#4f46e5;color:#fff}
/* 단계 버튼 */
.s2-sbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:8px;margin-top:12px}
.s2-sb{display:flex;flex-direction:column;align-items:center;gap:1px;border:2px solid #c7d2fe;background:#fff;color:#3730a3;border-radius:14px;padding:9px 6px;font:inherit;cursor:pointer;transition:transform .1s, box-shadow .1s}
.s2-sb:hover{transform:translateY(-1px);box-shadow:0 6px 14px rgba(79,70,229,.18)}
.s2-sb .ic{font-size:1.15rem;line-height:1.2}.s2-sb b{font-size:.88rem}.s2-sb small{font-size:.72rem;font-weight:700;opacity:.75}
.s2-sb.done{background:#ecfdf5;border-color:#a7f3d0;color:#047857}
.s2-sb.cur{background:#4f46e5;border-color:#4f46e5;color:#fff;box-shadow:0 8px 18px rgba(79,70,229,.32)}
.s2-pbar{height:7px;background:#eef2f7;border-radius:99px;margin-top:10px;overflow:hidden}.s2-pbar i{display:block;height:100%;background:linear-gradient(90deg,#6366f1,#3b82f6);border-radius:99px}
.s2-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.s2-tile{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px;text-align:left;cursor:pointer;font:inherit;color:inherit}
.s2-tile .ic{font-size:1.4rem}.s2-tile b{display:block;margin-top:4px}.s2-tile small{color:#64748b}
.s2-badges{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
.s2-badge{flex:none;min-width:92px;text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:10px 8px;font-size:.76rem;color:#94a3b8}
.s2-badge .e{font-size:1.5rem;filter:grayscale(1);opacity:.5}.s2-badge.on{color:#0f172a;border-color:#c7d2fe;background:#f5f7ff}.s2-badge.on .e{filter:none;opacity:1}
.s2-done{color:#64748b;font-size:.86rem}
/* 오답 프린트 */
.wp{max-width:820px;margin:0 auto;background:#fff;color:#0f172a}
.wp .ph{border-bottom:3px solid #4f46e5;padding-bottom:8px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end}
.wp .ph h1{font-size:1.3rem;margin:0}.wp .ph small{color:#64748b}
.wp h2{font-size:1.05rem;border-left:4px solid #4f46e5;padding-left:8px;margin:18px 0 10px}
.wp .q{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:10px;break-inside:avoid}
.wp .q .n{font-weight:800;color:#4338ca;margin-right:6px}.wp .q .src{font-size:.75rem;color:#64748b}
.wp .q .p{white-space:pre-line;margin:4px 0}.wp .q .ch{margin:4px 0 0 18px;padding:0}.wp .q .ch li{margin:2px 0}
.wp .q .ans-line{border-bottom:1px solid #94a3b8;height:26px;margin-top:6px}
.wp .ex{border:1px solid #c7d2fe;background:#fafbff;border-radius:10px;padding:10px 12px;margin-bottom:12px;break-inside:avoid}
.wp .ex .row2{display:flex;gap:12px;flex-wrap:wrap;font-size:.92rem;margin:4px 0}
.wp .ex .my{color:#dc2626}.wp .ex .ok{color:#059669;font-weight:800}
.wp .ex .box{margin-top:6px;font-size:.9rem;line-height:1.6}
.wp .ex .box b.t{display:inline-block;min-width:74px;color:#4338ca}
.wp .ex .cc{margin-top:6px;background:#fff;border:1px dashed #c7d2fe;border-radius:8px;padding:8px 10px;font-size:.88rem}
.wp .ex .cc .st{margin:2px 0 2px 4px}.wp .ex .cc .w{color:#dc2626}.wp .ex .cc .r{color:#059669}
.wp .pb{page-break-before:always;break-before:page}
@media print{body{background:#fff!important}.noprint,.topbar,nav.side{display:none!important}.wrap,#main,.tmain{max-width:none!important;padding:0!important;margin:0!important}.wp{max-width:none}.wp .q,.wp .ex{border-color:#bbb}@page{size:A4;margin:12mm}}
`;
  document.head.appendChild(st);
})();

/* ---------- 학습 통계 · 레벨 · 연속 학습 ---------- */
const kdate = d => { const t = new Date(d); const k = new Date(t.getTime() + (t.getTimezoneOffset() + 540) * 60000); return k.getFullYear() + '-' + String(k.getMonth() + 1).padStart(2, '0') + '-' + String(k.getDate()).padStart(2, '0'); };
function s2Stats() {
  const all = ST.allAttempts || ST.attempts || [];
  const graded = all.filter(a => a.status === 'graded');
  const xp = graded.reduce((s, a) => s + (a.is_correct ? 10 : (Number(a.score) > 0 ? 4 : 1)), 0);
  const per = 200, lv = 1 + Math.floor(xp / per), into = xp % per;
  const days = new Set(all.map(a => kdate(a.submitted_at)));
  const today = kdate(new Date());
  let streak = 0; const d = new Date();
  if (!days.has(today)) d.setDate(d.getDate() - 1);
  while (days.has(kdate(d))) { streak++; d.setDate(d.getDate() - 1); }
  const td = all.filter(a => kdate(a.submitted_at) === today);
  const tdOk = td.filter(a => a.is_correct).length;
  const week = all.filter(a => (Date.now() - new Date(a.submitted_at)) < 7 * 864e5 && a.status === 'graded');
  const acc = week.length ? Math.round(week.filter(a => a.is_correct).length / week.length * 100) : null;
  const perfectWrite = graded.some(a => a.is_correct && (ST.questions.find(q => q.id === a.question_id) || {}).qtype === 'write');
  return { xp, lv, into, per, streak, today: td.length, tdOk, goal: 20, acc, total: graded.length, perfectWrite, daysCount: days.size };
}

/* ---------- 단원 안 학습 순서(미션 단계) ---------- */
const S2_SHORT = { concept: '개념확인', basic: '기본', mid: '중급', adv: '심화', writing: '서술형', exam: '내신' };
const seenKey = (k, id) => 'sk_' + k + '_' + id;
function s2Steps(a) {
  const steps = [];
  const v = (ST.videos || []).find(x => x.unit_id === a.unit_id);
  if (v) steps.push({ k: 'video', name: '영상', done: !!localStorage.getItem(seenKey('vseen', v.id)), run: () => videoView(v.id, 'home', v.start_sec != null ? v.start_sec : null), label: '영상 보기' + (v.start_sec != null ? ' (' + fmtLen(v.start_sec) + '부터)' : '') });
  const cs = (ST.concepts || []).filter(c => c.unit_id === a.unit_id);
  if (cs.length) steps.push({ k: 'concept', name: '개념', done: !!localStorage.getItem(seenKey('cseen', a.id + '_' + (a.current_round || 1))), run: () => conceptView(a.id, 0), label: '개념 카드 읽기 (' + cs.length + '장)' });
  for (const [k, n] of STAGES) {
    const qs = stageQs(a, k); if (!qs.length) continue;
    const sm = stageSummary(a, k);
    steps.push({ k, name: S2_SHORT[k] || n, done: sm.finished, sm, run: () => startStage(a.id, k), label: n + ' 문제 ' + (sm.done ? (sm.done + '/' + sm.total + ' 이어서') : sm.total + '문제') });
  }
  return steps;
}
const S2_ICON = { video: '🎬', concept: '📘' };
function stepBtns(m) {
  return `<div class="s2-sbs">${m.steps.map((s, i) => {
    const cls = s.done ? 'done' : s === m.cur ? 'cur' : '';
    const sub = s.sm ? (s.done ? '완료' : (s.sm.done ? s.sm.done + '/' + s.sm.total : s.sm.total + '문제')) : (s.done ? '완료' : s.k === 'video' ? '보기' : '읽기');
    return `<button type="button" class="s2-sb ${cls}" data-sb="${m.a.id}:${i}"><span class="ic">${s.done ? '✓' : (s.sm ? '✏️' : (S2_ICON[s.k] || '✏️'))}</span><b>${esc(s.name)}</b><small>${sub}</small></button>`;
  }).join('')}</div>`;
}
const s2UnitNo = x => { const m = String((x.a.units || {}).code || '').match(/(\d+)\s*$/); return m ? Number(m[1]) : 999; };
function s2Due(a) {
  if (!a.due_date) return '';
  const d = Math.round((new Date(a.due_date + 'T00:00:00+09:00') - new Date(kdate(new Date()) + 'T00:00:00+09:00')) / 864e5);
  return d < 0 ? `<span class="s2-due hot">마감 지남</span>` : d === 0 ? `<span class="s2-due hot">오늘 마감</span>` : `<span class="s2-due ${d <= 2 ? 'hot' : ''}">D-${d}</span>`;
}
function s2Missions() {
  return ST.asg.map(a => { const steps = s2Steps(a); const qSteps = steps.filter(s => s.sm); const done = steps.filter(s => s.done).length; const cur = steps.find(s => !s.done); return { a, steps, cur, pct: steps.length ? Math.round(done / steps.length * 100) : 0, qDone: qSteps.filter(s => s.done).length, qTotal: qSteps.length }; })
    .sort((x, y) => (ST.bootcamp ? s2UnitNo(x) - s2UnitNo(y) : 0) || (!!x.cur === !!y.cur ? 0 : x.cur ? -1 : 1) || String(x.a.due_date || '9999').localeCompare(String(y.a.due_date || '9999')) || (y.pct - x.pct) || String(x.a.created_at).localeCompare(String(y.a.created_at)));
}
function s2WrongCount() {
  let n = 0;
  for (const a of ST.asg) for (const [k] of STAGES) for (const q of stageQs(a, k)) { const l = lastAttempt(q.id); if (l && l.status === 'graded' && !l.is_correct) n++; }
  return n;
}

/* ---------- 학생 홈 (미션형) ---------- */
function studentHome() {
  const p = S.profile || {}, nm = String(p.name || '');
  const stt = s2Stats(), ms = s2Missions(), todo = ms.filter(m => m.cur), fin = ms.filter(m => !m.cur);
  const now = todo[0];
  const R = 34, C = 2 * Math.PI * R, ringP = Math.min(1, stt.today / stt.goal);
  const greet = stt.today >= stt.goal ? '오늘 목표 달성! 최고예요 🎉' : stt.streak >= 3 ? `${stt.streak}일 연속 공부 중! 오늘도 이어가요 🔥` : todo.length ? '오늘도 한 걸음씩, 가 볼까요? 🚀' : '배정된 미션을 모두 끝냈어요 👏';
  const hero = `<div class="s2-hero">
    <div class="s2-ring"><svg width="78" height="78" viewBox="0 0 78 78"><circle cx="39" cy="39" r="${R}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="7"/><circle cx="39" cy="39" r="${R}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - ringP)}"/></svg><div class="c"><div><b>${stt.today}</b><small>/ ${stt.goal} 문제</small></div></div></div>
    <h1>${esc(nm.slice(-2) || nm)}, 안녕!</h1><div class="sub" style="max-width:70%">${greet}</div>
    <div class="s2-chips"><span class="s2-chip">Lv.${stt.lv}</span><span class="s2-chip">🔥 ${stt.streak}일 연속</span><span class="s2-chip">⭐ ${stt.xp.toLocaleString()} XP</span>${stt.acc != null ? `<span class="s2-chip">🎯 정답률 ${stt.acc}%</span>` : ''}</div>
    <div class="s2-lv"><div class="t"><span>Lv.${stt.lv}</span><span>다음 레벨까지 ${stt.per - stt.into} XP</span></div><div class="bar"><i style="width:${Math.round(stt.into / stt.per * 100)}%"></i></div></div></div>`;
  const nowCard = now ? `<div class="s2-now"><div class="lbl">▶ 지금 할 일 · ${now.steps.indexOf(now.cur) + 1}/${now.steps.length}단계</div>
      <h2>${esc(now.a.units.title)}</h2><div class="meta">${esc(now.a.units.school_book || '')} ${esc(now.a.units.lesson || '')} · ${esc(now.cur.label)}</div>
      ${stepBtns(now)}
      <button class="btn go" id="s2go">${now.cur.k === 'video' ? '🎬 영상부터 보기' : now.cur.k === 'concept' ? '📘 개념 읽기' : '✏️ 문제 풀기'}</button></div>`
    : `<div class="s2-now"><div class="lbl">🎉 미션 완료</div><h2>지금 배정된 공부를 모두 끝냈어요!</h2><div class="meta">틀린 문제를 한 번 더 보거나, 영상 강의실에서 복습해 보세요.</div></div>`;
  const mCard = m => `<div class="s2-m" data-mu="${m.a.id}"><div class="top"><div><b>${esc(m.a.units.title)}</b><div class="book">${esc(m.a.units.school_book || '')} ${esc(m.a.units.lesson || '')}${(m.a.current_round || 1) > 1 ? ' · ' + m.a.current_round + '회차' : ''}</div></div>${s2Due(m.a)}</div>
    ${stepBtns(m)}
    <div class="s2-pbar"><i style="width:${m.pct}%"></i></div></div>`;
  const wn = s2WrongCount();
  const nae = ST.bootcamp ? [] : ST.asg.filter(isNaesin);
  const libN = (typeof myLib === 'function') ? myLib().length : 0;
  const tiles = `<div class="s2-tiles">
    ${libN ? `<button class="s2-tile" id="t-lib"><div class="ic">🎬</div><b>영상 강의실</b><small>문법 영상 ${libN}개</small></button>` : ''}
    <button class="s2-tile" id="t-wr"><div class="ic">📝</div><b>오답노트</b><small>${wn ? `다시 볼 문제 ${wn}개` : '틀린 문제 없음'}</small></button>
    ${wn ? `<button class="s2-tile" id="t-pr"><div class="ic">🖨️</div><b>오답 프린트</b><small>문제지 + 자세한 해설</small></button>` : ''}
    ${nae.length ? `<button class="s2-tile" id="t-nh"><div class="ic">📘</div><b>중등 내신</b><small>교과서별 시험 대비</small></button>` : ''}</div>`;
  const B = [['🌱', '첫 정답', stt.total > 0], ['🔥', '3일 연속', stt.streak >= 3], ['🏃', '7일 연속', stt.streak >= 7], ['🎯', '정답률 90%', stt.acc != null && stt.acc >= 90], ['✍️', '서술형 정답', stt.perfectWrite], ['🏆', '단원 완료', fin.length > 0], ['💯', '100문제', stt.total >= 100]];
  const badges = `<div class="s2-badges">${B.map(([e, n, on]) => `<div class="s2-badge ${on ? 'on' : ''}"><div class="e">${e}</div>${n}</div>`).join('')}</div>`;
  // 어휘(게임 포함)·내신 본문 카드: 배정된 학생에게만 보여요
  const vcard = typeof vocabHomeCard === 'function' ? vocabHomeCard() : '', pcard = typeof passageHomeCard === 'function' ? passageHomeCard() : '';
  const vp = !ST.bootcamp && (vcard || pcard) ? `<div class="s2-sec"><h3>어휘 · 본문</h3></div>${vcard}${pcard}` : '';
  shell(`${hero}${nowCard}${vp}
    <div class="s2-sec"><h3>${ST.bootcamp ? '부트캠프 학습' : '오늘의 미션'}</h3><span>${todo.length}개 남음</span></div>
    ${todo.map(mCard).join('') || '<div class="card s2-done">남은 미션이 없어요. 원장님이 새 단원을 배정하면 여기에 나타나요.</div>'}
    <div class="s2-sec"><h3>바로 가기</h3></div>${tiles}
    <div class="s2-sec"><h3>나의 배지</h3><span>${B.filter(b => b[2]).length}/${B.length}</span></div>${badges}
    ${fin.length ? `<div class="s2-sec"><h3>완료한 단원</h3><span>${fin.length}개</span></div>${fin.map(mCard).join('')}` : ''}`);
  if (now) $('#s2go').onclick = () => now.cur.run();
  document.querySelectorAll('[data-mu]').forEach(el => el.onclick = () => unitView(el.dataset.mu));
  document.querySelectorAll('[data-sb]').forEach(b => b.onclick = e => { e.stopPropagation(); const [id, i] = b.dataset.sb.split(':'); const m = ms.find(x => x.a.id === id); const s = m && m.steps[Number(i)]; if (s) s.run(); });
  const on = (id, f) => { const e = document.getElementById(id); if (e) e.onclick = f; };
  on('t-lib', () => libView()); on('t-wr', () => wrongNote()); on('t-pr', () => wrongPrintStudent()); on('t-nh', () => naesinHub());
  if (typeof bindVocabHome === 'function') bindVocabHome();
  if (typeof bindPassageHome === 'function') bindPassageHome();
}

/* 영상·개념을 열면 '봤음'으로 표시해요 */
(function () {
  const _vv = videoView, _cv = conceptView;
  videoView = async function (vid, back, at) { try { localStorage.setItem(seenKey('vseen', vid), '1'); } catch (e) { } return _vv(vid, back, at); };
  conceptView = function (asgId, i) { try { const a = ST.asg.find(x => x.id === asgId); localStorage.setItem(seenKey('cseen', asgId + '_' + ((a && a.current_round) || 1)), '1'); } catch (e) { } return _cv(asgId, i); };
})();

/* ---------- 오답 프린트 (공통 화면) ---------- */
const NUM = ['①', '②', '③', '④', '⑤', '⑥'];
function conceptOf(unitId, tag, concepts) { return (concepts || []).find(c => c.unit_id === unitId && c.tag === tag) || null; }
function wpHtml(title, who, items) {
  const today = kdate(new Date());
  const qHtml = items.map((x, i) => `<div class="q"><span class="n">${i + 1}.</span><span class="src">${esc(x.unit)} · ${esc(x.stage)}${x.tag ? ' · ' + esc(x.tag) : ''}</span>
      <div class="p">${esc(x.q.prompt)}</div>${x.q.ko ? `<div class="p" style="color:#475569">${esc(x.q.ko)}</div>` : ''}
      ${Array.isArray(x.q.choices) && x.q.choices.length ? `<ol class="ch" style="list-style:none">${x.q.choices.map((c, j) => `<li>${NUM[j] || '-'} ${esc(c)}</li>`).join('')}</ol>` : '<div class="ans-line"></div>' + (x.q.qtype === 'write' ? '<div class="ans-line"></div>' : '')}</div>`).join('');
  const exHtml = items.map((x, i) => {
    const k = x.key || {}, ans = (k.all_answers || k.answers || [])[0] || k.correct_answer || '';
    const why = (k.wrong_notes && x.my && k.wrong_notes[x.my]) || x.feedback || '';
    const c = x.concept, b = (c && c.body) || {};
    const cc = c ? `<div class="cc"><b>📘 핵심 개념 · ${esc(c.title || c.tag)}</b>${b.summary ? `<div>${esc(b.summary)}</div>` : ''}${(b.steps || []).map(s => `<div class="st">${esc(s)}</div>`).join('')}${(b.compare || []).map(cp => `<div class="st"><span class="w">✗ ${esc(cp.wrong)}</span> → <span class="r">✓ ${esc(cp.right)}</span>${cp.note ? ` <span style="color:#64748b">(${esc(cp.note)})</span>` : ''}</div>`).join('')}${b.tip ? `<div class="st">💡 ${esc(b.tip)}</div>` : ''}</div>` : '';
    return `<div class="ex"><b style="color:#4338ca">${i + 1}번</b> <span class="src" style="font-size:.75rem;color:#64748b">${esc(x.unit)} · ${esc(x.stage)}</span>
      <div class="row2"><span>내 답: <span class="my">${esc(x.my || '-')}</span></span><span>정답: <span class="ok">${esc(ans)}</span></span>${(k.all_answers || k.answers || []).length > 1 ? `<span style="color:#64748b">(다른 정답: ${esc((k.all_answers || k.answers).slice(1).join(' / '))})</span>` : ''}</div>
      <div class="box"><div><b class="t">해설</b>${esc(k.explanation || '')}</div>${why ? `<div><b class="t">왜 틀렸나</b>${esc(why)}</div>` : ''}${x.q.hint ? `<div><b class="t">기억 포인트</b>${esc(x.q.hint)}</div>` : ''}</div>${cc}</div>`;
  }).join('');
  return `<div class="wp"><div class="ph"><div><small>스텔라의 심쿵영어 · 오답 복습지</small><h1>${esc(title)}</h1></div><small>${esc(who)} · ${today} · ${items.length}문항</small></div>
    <h2>Part 1. 다시 풀어 보기</h2><p style="font-size:.85rem;color:#64748b">답을 보지 말고 먼저 풀어 보세요. 다 풀면 뒤쪽 해설지로 채점해요.</p>${qHtml}
    <div class="pb"></div><h2>Part 2. 자세한 해설</h2>${exHtml}</div>`;
}
function wpShow(html, back) {
  shell(`<div class="noprint row between" style="margin-bottom:12px"><a href="#" id="wpback">← 돌아가기</a><button class="btn" id="wpgo">🖨️ 인쇄하기</button></div>${html}`);
  $('#wpback').onclick = e => { e.preventDefault(); back(); };
  $('#wpgo').onclick = () => window.print();
}

/* 학생: 내 오답 프린트 */
async function wrongPrintStudent() {
  const items = [];
  for (const a of ST.asg) for (const [k, n] of STAGES) for (const q of stageQs(a, k)) { const l = lastAttempt(q.id); if (l && l.status === 'graded' && !l.is_correct) items.push({ a, q, l, unit: a.units.title, stage: n, tag: q.concept_tag, my: l.answer, feedback: l.feedback }); }
  if (!items.length) return toast('틀린 문제가 없어요!');
  shell('<p class="muted">오답 복습지를 만드는 중…</p>');
  for (const x of items) { try { const { data } = await S.sb.rpc('get_explanation', { p_assignment: x.a.id, p_question: x.q.id }); x.key = data || {}; } catch (e) { x.key = {}; } x.concept = conceptOf(x.a.unit_id, x.q.concept_tag, ST.concepts); }
  wpShow(wpHtml('나의 오답 복습지', (S.profile && S.profile.name) || '', items), studentHome);
}

/* 원장님: 학생별 오답 프린트 (오늘 현황 카드의 버튼) */
async function wrongPrintTeacher(sid) {
  const s = T.sById[sid]; if (!s) return;
  const asgs = T.asg.filter(a => a.student_id === sid);
  const last = new Map();
  T.attempts.filter(x => x.student_id === sid).forEach(x => { const a = asgs.find(y => y.id === x.assignment_id); if (!a || (x.round || 1) !== (a.current_round || 1)) return; const kk = x.assignment_id + '|' + x.question_id; const p = last.get(kk); if (!p || x.attempt_no > p.attempt_no) last.set(kk, x); });
  const wrong = [...last.values()].filter(x => x.status === 'graded' && !x.is_correct);
  if (!wrong.length) return toast(`${s.name} 학생은 지금 회차에 틀린 문제가 없어요`);
  toast('오답 복습지를 만드는 중…');
  const qids = [...new Set(wrong.map(x => x.question_id))], uids = [...new Set(asgs.map(a => a.unit_id))];
  const [kr, cr] = await Promise.all([S.sb.from('question_keys').select('*').in('question_id', qids), S.sb.from('concepts').select('*').in('unit_id', uids)]);
  const keys = new Map(((kr && kr.data) || []).map(k => [k.question_id, k])), concepts = (cr && cr.data) || [];
  const items = wrong.map(x => { const q = T.questions.find(y => y.id === x.question_id); const a = asgs.find(y => y.id === x.assignment_id); const u = T.uById[a.unit_id]; if (!q || !u) return null;
    return { q, unit: u.title, stage: STAGE_NAME[q.stage] || q.stage, tag: q.concept_tag, my: x.answer, feedback: x.feedback, key: keys.get(q.id) || {}, concept: conceptOf(u.id, q.concept_tag, concepts), ord: (STAGES.findIndex(st => st[0] === q.stage) * 100) + (q.ord || 0), u: u.title }; })
    .filter(Boolean).sort((a, b) => a.u.localeCompare(b.u, 'ko') || a.ord - b.ord);
  const bg = document.createElement('div'); bg.className = 'modal-bg'; bg.style.alignItems = 'flex-start'; bg.style.overflow = 'auto';
  bg.innerHTML = `<div class="modal" style="max-width:900px;width:96%;margin:20px auto"><div class="noprint row between" style="margin-bottom:10px"><b>${esc(s.name)} 오답 복습지 미리보기</b><span class="row" style="gap:6px"><button class="btn" id="tpgo">🖨️ 인쇄하기</button><button class="btn ghost" id="tpx">닫기</button></span></div>${wpHtml(s.name + '의 오답 복습지', s.name + ' · ' + (s.grade || ''), items)}</div>`;
  document.body.appendChild(bg);
  const st = document.createElement('style'); st.id = 'tp-print'; st.textContent = '@media print{body>*:not(.modal-bg){display:none!important}.modal-bg{position:static!important;background:none!important;overflow:visible!important}.modal-bg .modal{box-shadow:none!important;max-width:none!important;width:auto!important;margin:0!important;padding:0!important}}';
  document.head.appendChild(st);
  const close = () => { bg.remove(); st.remove(); };
  bg.querySelector('#tpx').onclick = close; bg.querySelector('#tpgo').onclick = () => window.print();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-wprint]'); if (b) { e.preventDefault(); wrongPrintTeacher(b.dataset.wprint); } });
