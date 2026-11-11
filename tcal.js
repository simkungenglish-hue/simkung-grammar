/* 학생 학습 달력(날짜별 학습시간 · 문제별 걸린 시간) + 학습 종합 리포트
   저장된 기록을 읽기만 해요. 새로 쓰거나 바꾸는 데이터는 없어요. */
'use strict';
(function () {
  const css = document.createElement('style');
  css.textContent = `
  .cal-m{max-width:880px}
  .cal-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
  .cal-top b{font-size:18px}
  .cal-g{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
  .cal-w{font-size:12px;font-weight:700;color:#64748b;text-align:center;padding:2px 0}
  .cal-c{min-height:62px;border:1px solid #e2e8f0;border-radius:10px;padding:4px 5px;cursor:pointer;background:#fff;display:flex;flex-direction:column;gap:2px;font-size:11px;color:#64748b}
  .cal-c.empty{background:transparent;border-color:transparent;cursor:default}
  .cal-c .d{font-weight:700;color:#334155;font-size:12px}
  .cal-c .t{font-weight:800;font-size:13px;color:#312e81}
  .cal-c .s{font-size:10px;line-height:1.25}
  .cal-c.has{background:#eef2ff;border-color:#c7d2fe}
  .cal-c.l2{background:#e0e7ff}.cal-c.l3{background:#c7d2fe}.cal-c.l4{background:#a5b4fc}
  .cal-c.sel{outline:2px solid #4f46e5}
  .cal-c.today .d::after{content:" ●";color:#ef4444;font-size:9px}
  .cal-d{margin-top:12px;border-top:2px solid #e2e8f0;padding-top:10px}
  .cal-d h3{margin:0 0 6px;font-size:15px}
  .cal-d table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:10px}
  .cal-d th,.cal-d td{border-bottom:1px solid #e2e8f0;padding:4px 6px;text-align:left;vertical-align:top}
  .cal-d th{color:#64748b;font-weight:700;background:#f8fafc}
  .cal-d td.n{text-align:right;white-space:nowrap}
  .cal-d .sl{color:#b45309;font-weight:800}
  .cal-d .ok{color:#047857}.cal-d .no{color:#c2410c}
  .tbar{display:inline-block;height:6px;background:#f59e0b;border-radius:3px;vertical-align:middle;margin-left:4px}
  /* 리포트 */
  #srp{position:fixed;inset:0;z-index:30;background:#e5e7eb;overflow:auto;padding:12px}
  #srp .srp-bar{max-width:794px;margin:0 auto 10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  #srp .pg{background:#fff;max-width:794px;margin:0 auto;padding:16px 18px;color:#111;font-size:12px;line-height:1.45}
  #srp h1{font-size:20px;margin:0 0 2px}
  #srp h2{font-size:14px;margin:12px 0 4px;border-bottom:1.5px solid #4f46e5;padding-bottom:2px;color:#312e81}
  #srp .meta{display:flex;gap:14px;flex-wrap:wrap;color:#444;font-size:12px}
  #srp .k4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
  #srp .k4>div{border:1px solid #cbd5e1;border-radius:6px;padding:6px 8px}
  #srp .k4 b{display:block;font-size:17px}
  #srp table{width:100%;border-collapse:collapse;margin:4px 0}
  #srp th,#srp td{border:1px solid #d1d5db;padding:3px 6px;text-align:left;vertical-align:top}
  #srp th{background:#f3f4f6;font-weight:700}
  #srp td.n{text-align:right;white-space:nowrap}
  #srp .tg{display:inline-block;border:1px solid #4f46e5;color:#4f46e5;border-radius:99px;padding:0 6px;font-size:10.5px;margin-right:4px}
  #srp .tg.g{border-color:#64748b;color:#64748b}
  #srp .cmt{border:1px solid #cbd5e1;border-radius:6px;min-height:54px;padding:6px 8px}
  #srp tr{break-inside:avoid}
  @media print{
    body>*:not(#srp){display:none!important}
    #srp{position:static;background:#fff;padding:0;overflow:visible}
    #srp .srp-bar{display:none}
    #srp .pg{max-width:none;padding:0}
    @page{size:A4;margin:7mm}
  }`;
  document.head.appendChild(css);

  const E = s => esc(s == null ? '' : s);
  const clip = (s, n) => { s = String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const dur = sec => { sec = Math.round(sec || 0); if (sec <= 0) return '-'; if (sec < 60) return sec + '초'; const m = Math.floor(sec / 60), r = sec % 60; return m < 60 ? m + '분' + (r ? ' ' + r + '초' : '') : Math.floor(m / 60) + '시간 ' + (m % 60) + '분'; };
  const hm = s => { const d = new Date(s); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const pad = n => String(n).padStart(2, '0');
  const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];

  /* 날짜별 학습 자료 모으기 */
  function collect(sid) {
    const days = new Map();
    const get = k => { if (!days.has(k)) days.set(k, { g: [], v: [], p: [], iv: null, vsec: 0 }); return days.get(k); };
    (T.byStu.get(sid) || []).forEach(a => { if (a.submitted_at) get(dayKey(a.submitted_at)).g.push(a); });
    (STU.vprog || []).filter(r => r.student_id === sid && r.done_at).forEach(r => get(dayKey(r.done_at)).v.push(r));
    (STU.pprog || []).filter(r => r.student_id === sid && r.done_at).forEach(r => get(dayKey(r.done_at)).p.push(r));
    (STU.ivD || []).filter(r => r.student_id === sid && (r.new_n || r.rev_n || r.sec)).forEach(r => { get(r.day).iv = r; });
    (STU.vtime || []).filter(r => r.student_id === sid && r.sec > 0).forEach(r => { get(r.day).vsec += r.sec; });
    days.forEach(o => {
      o.gsec = o.g.reduce((n, a) => n + (a.time_spent_sec || 0), 0);
      const vstep = o.v.reduce((n, r) => n + (r.time_sec || 0), 0);
      o.vs = Math.max(o.vsec, vstep);
      o.ps = o.p.reduce((n, r) => n + (r.time_sec || 0), 0);
      o.is = o.iv ? (o.iv.sec || 0) : 0;
      o.total = o.gsec + o.vs + o.ps + o.is;
    });
    return days;
  }

  function dayDetail(o, k) {
    if (!o) return '<p class="tiny">이 날은 학습 기록이 없어요.</p>';
    let h = `<h3>${k.slice(5).replace('-', '/')} (${WD[new Date(k + 'T00:00:00').getDay()]}) · 총 ${dur(o.total)} <span class="tiny">문법 ${dur(o.gsec)} · 어휘 ${dur(o.vs)} · 본문 ${dur(o.ps)} · 불규칙 ${dur(o.is)}</span></h3>`;
    if (o.g.length) {
      const rows = o.g.slice().sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
      const mx = Math.max(1, ...rows.map(a => a.time_spent_sec || 0)), avg = rows.filter(a => a.time_spent_sec).reduce((n, a) => n + a.time_spent_sec, 0) / Math.max(1, rows.filter(a => a.time_spent_sec).length);
      h += `<b>📗 문법 · 문제별 걸린 시간</b> <span class="tiny">(${rows.length}번 제출 · 평균 ${dur(avg)})</span><table><thead><tr><th>시각</th><th>교재 · 단원</th><th>문제</th><th>결과</th><th class="n">걸린 시간</th></tr></thead><tbody>${rows.map(a => {
        const q = T.qById[a.question_id] || {}, u = T.uById[a.unit_id || q.unit_id] || {};
        const st = a.status === 'graded' ? (a.is_correct ? '<span class="ok">✓ 정답</span>' : '<span class="no">✗ 오답</span>') : '<span class="tiny">채점 대기</span>';
        const t = a.time_spent_sec, slow = t && t >= Math.max(60, avg * 2);
        return `<tr><td>${hm(a.submitted_at)}</td><td>${E(clip((u.school_book || '') + ' ' + (u.lesson || '') + ' ' + (u.title || ''), 34))}</td><td>${E(clip(q.prompt || q.ko || '(문제)', 50))}</td><td>${st}</td><td class="n ${slow ? 'sl' : ''}">${t != null ? dur(t) : '-'}${t ? `<span class="tbar" style="width:${Math.max(2, Math.round(t / mx * 50))}px"></span>` : ''}</td></tr>`; }).join('')}</tbody></table>`;
    }
    if (o.v.length) {
      h += `<b>📘 어휘 · 단계별</b><table><thead><tr><th>시각</th><th>단어장 · 유닛</th><th>단계</th><th>점수</th><th class="n">시간</th></tr></thead><tbody>${o.v.slice().sort((a, b) => new Date(a.done_at) - new Date(b.done_at)).map(r => {
        const u = VT.units.find(x => x.id === r.unit_id), b = u && vtBook(u.book_id);
        return `<tr><td>${hm(r.done_at)}</td><td>${E(b ? b.title : '')} ${E(u ? (u.title || 'Unit ' + u.ord) : '')}</td><td>${E(SV_STEP[r.step] || r.step)}</td><td>${r.total ? r.score + '/' + r.total : '-'}</td><td class="n">${r.time_sec ? dur(r.time_sec) : '-'}</td></tr>`; }).join('')}</tbody></table>`;
    }
    if (o.vs && !o.v.length) h += `<p class="tiny">📘 어휘 학습 ${dur(o.vs)} (단계 완료 기록 없이 연습한 시간)</p>`;
    else if (o.vs > o.v.reduce((n, r) => n + (r.time_sec || 0), 0)) h += `<p class="tiny">📘 어휘 총 학습 ${dur(o.vs)} — 위 표는 완료한 단계만 보여요. 어휘는 문제 하나하나의 시간은 기록하지 않아요.</p>`;
    if (o.p.length) {
      h += `<b>📖 내신 본문</b><table><thead><tr><th>시각</th><th>본문</th><th>단계</th><th>점수</th><th class="n">시간</th></tr></thead><tbody>${o.p.slice().sort((a, b) => new Date(a.done_at) - new Date(b.done_at)).map(r => {
        const p = ptPas(r.passage_id) || {};
        return `<tr><td>${hm(r.done_at)}</td><td>${E(p.title || '')}</td><td>${E(P_STEP_NAME[r.step] || r.step)}</td><td>${r.total ? r.score + '/' + r.total : '-'}</td><td class="n">${r.time_sec ? dur(r.time_sec) : '-'}</td></tr>`; }).join('')}</tbody></table>`;
    }
    if (o.iv) h += `<b>🔁 불규칙동사</b><table><tbody><tr><td>새로 배운 동사 ${o.iv.new_n || 0}개 · 복습 ${o.iv.rev_n || 0}개 · 정답 ${o.iv.ok || 0}/${o.iv.total || 0}</td><td class="n">${dur(o.iv.sec)}</td></tr></tbody></table>`;
    return h;
  }

  window.stuCal = function (sid) {
    const s = T.sById[sid], days = collect(sid), keys = [...days.keys()].filter(k => days.get(k).total > 0 || days.get(k).g.length || days.get(k).v.length).sort();
    const last = keys[keys.length - 1] || kstToday();
    let [Y, M] = last.split('-').map(Number); M -= 1; let sel = last;
    const m = modal(`<div class="cal-m"><div class="cal-top"><b id="cal-t"></b><button class="btn small ghost" id="cal-p">◀</button><button class="btn small ghost" id="cal-n">▶</button><span class="tiny" id="cal-s"></span><span style="flex:1"></span><button class="btn small ghost" id="cal-x">닫기</button></div>
      <div class="tiny" style="margin-bottom:6px">${E(s.name)} · 칸을 누르면 그날 푼 문제와 걸린 시간이 아래에 나와요. 색이 진할수록 오래 공부한 날이에요.</div>
      <div class="cal-g" id="cal-g"></div><div class="cal-d" id="cal-d"></div></div>`);
    m.querySelector('.modal').style.maxWidth = '900px';
    const draw = () => {
      m.querySelector('#cal-t').textContent = `${Y}년 ${M + 1}월`;
      const first = new Date(Y, M, 1).getDay(), n = new Date(Y, M + 1, 0).getDate(), today = kstToday();
      let tot = 0, cnt = 0; for (let d = 1; d <= n; d++) { const o = days.get(ymd(Y, M, d)); if (o && o.total > 0) { tot += o.total; cnt++; } }
      m.querySelector('#cal-s').textContent = `이달 ${cnt}일 · 총 ${dur(tot)}`;
      const mx = Math.max(1, ...[...days.values()].map(o => o.total));
      let h = WD.map(w => `<div class="cal-w">${w}</div>`).join('') + '<div class="cal-c empty"></div>'.repeat(first);
      for (let d = 1; d <= n; d++) { const k = ymd(Y, M, d), o = days.get(k), t = o ? o.total : 0, lv = !o ? '' : t <= 0 ? 'has' : t > mx * .66 ? 'has l4' : t > mx * .33 ? 'has l3' : t > mx * .12 ? 'has l2' : 'has';
        const parts = o ? [o.g.length ? '문법' + o.g.length : '', o.v.length || o.vs ? '어휘' : '', o.p.length ? '본문' : '', o.iv ? '불규칙' : ''].filter(Boolean).join('·') : '';
        h += `<div class="cal-c ${lv} ${k === sel ? 'sel' : ''} ${k === today ? 'today' : ''}" data-k="${k}"><span class="d">${d}</span>${o ? `<span class="t">${t > 0 ? dur(t).replace(/ \d+초$/, '') : '기록'}</span><span class="s">${parts}</span>` : ''}</div>`; }
      m.querySelector('#cal-g').innerHTML = h;
      m.querySelectorAll('.cal-c[data-k]').forEach(c => c.onclick = () => { sel = c.dataset.k; draw(); });
      m.querySelector('#cal-d').innerHTML = dayDetail(days.get(sel), sel);
    };
    m.querySelector('#cal-p').onclick = () => { M--; if (M < 0) { M = 11; Y--; } draw(); };
    m.querySelector('#cal-n').onclick = () => { M++; if (M > 11) { M = 0; Y++; } draw(); };
    m.querySelector('#cal-x').onclick = () => m.remove();
    draw();
  };

  /* ---------- 학습 종합 리포트 ---------- */
  window.stuReport = function (sid, range) {
    range = range || 30;
    const s = T.sById[sid], days = collect(sid), kst = kstToday(), from = range ? addDays(kst, -(range - 1)) : '0000-00-00';
    const inR = k => k >= from && k <= kst;
    const ks = [...days.keys()].filter(inR).sort();
    const tot = ks.reduce((n, k) => n + days.get(k).total, 0), studyDays = ks.filter(k => days.get(k).total > 0 || days.get(k).g.length || days.get(k).v.length || days.get(k).p.length).length;
    const allG = ks.flatMap(k => days.get(k).g);
    const arSet = stuArchSet(sid), asgs = T.asg.filter(a => a.student_id === sid);
    const lastK = [...days.keys()].sort().pop();
    /* 문법: 교재별 → 단원별 */
    const byBook = new Map();
    asgs.forEach(a => { const u = T.uById[a.unit_id]; if (!u) return; const b = u.school_book || '교재 미정'; if (!byBook.has(b)) byBook.set(b, []); byBook.get(b).push({ a, u }); });
    const gRows = [...byBook.entries()].sort((x, y) => bookRank(x[0]) - bookRank(y[0]) || x[0].localeCompare(y[0], 'ko')).map(([b, L]) => {
      L.sort((p, q) => unitSort(p.u, q.u));
      const rows = L.map(({ a, u }) => {
        const mine = (T.byStu.get(sid) || []).filter(t => t.assignment_id === a.id), inr = mine.filter(t => inR(dayKey(t.submitted_at)));
        const stg = STAGES.map(([k, n]) => ({ n, sm: tStage(a, k) })).filter(x => x.sm.total);
        const fin = stg.filter(x => x.sm.finished).length, pcts = stg.filter(x => x.sm.finished && x.sm.pct != null).map(x => x.sm.pct);
        const gr = inr.filter(t => t.status === 'graded');
        const ds = [...new Set(mine.map(t => dayKey(t.submitted_at)))].sort();
        return `<tr><td>${E(u.lesson ? u.lesson + ' ' : '')}${E(u.title)}</td><td>${fin}/${stg.length}단계${stg.length && fin === stg.length ? ' ✓' : ''}</td><td class="n">${pcts.length ? Math.round(pcts.reduce((x, y) => x + y, 0) / pcts.length) + '%' : '-'}</td><td class="n">${inr.length ? inr.length + '번 · ' + dur(inr.reduce((n, t) => n + (t.time_spent_sec || 0), 0)) : '-'}</td><td class="n">${ds.length ? ds[ds.length - 1].slice(5).replace('-', '/') : '-'}</td></tr>`; });
      return `<tr><th colspan="5">📗 ${E(b)} ${arSet.has(b) ? '<span class="tg g">학습 종료</span>' : ''}<span style="font-weight:400"> · ${L.length}단원</span></th></tr>${rows.join('')}`;
    }).join('');
    /* 어휘 */
    const vRows = stuVocabInfo(sid).map(x => `<tr><td>${E(x.bk.title)}</td><td>${E(vtLevelLabel(x.bk))}</td><td>${x.passed}/${x.us.length} ${E(vtUnitWord(x.bk))} 통과</td><td class="n">${STU.vprog.filter(r => r.student_id === sid && inR(dayKey(r.done_at)) && x.us.some(u => u.id === r.unit_id)).length}단계 완료</td></tr>`).join('');
    /* 본문 */
    const pRows = stuPassInfo(sid).map(x => `<tr><td>${E(x.p.title)}</td><td>${E(ptLabel(x.p))}</td><td>${x.done.length}${x.total ? '/' + x.total : ''}단계 완료</td><td class="n">${dur(x.done.reduce((n, g) => n + (g.time_sec || 0), 0))}</td></tr>`).join('');
    /* 불규칙 */
    const ivA = (STU.ivA || []).find(x => x.student_id === sid), ivP = (STU.ivP || []).filter(x => x.student_id === sid && IV_BY.has(x.verb_no)), ivD = (STU.ivD || []).filter(x => x.student_id === sid && inR(x.day));
    let ivRow = '';
    if (ivA) { const stg = (ivA.stages || []).filter(n => IV_STAGES.includes(n)), have = new Set(ivP.map(x => x.verb_no)), totV = stg.reduce((n, k) => n + ivStageVerbs(k).length, 0), haveV = stg.reduce((n, k) => n + ivStageVerbs(k).filter(v => have.has(v.no)).length, 0);
      ivRow = `<tr><td>하루 ${ivA.per_day}개 · ${stg.map(ivStageName).join(', ')}</td><td>외운 동사 ${haveV}/${totV}개</td><td>완전 암기 ${ivP.filter(x => x.box >= 5).length}개 · 복습 대기 ${ivP.filter(x => x.due_on <= kst).length}개</td><td class="n">${ivD.filter(x => x.new_n || x.rev_n).length}일 · ${dur(ivD.reduce((n, x) => n + (x.sec || 0), 0))}</td></tr>`; }
    /* 일지 */
    const log = ks.slice().reverse().map(k => { const o = days.get(k), parts = [];
      if (o.g.length) { const um = new Map(); o.g.forEach(a => { const u = T.uById[a.unit_id] || {}; const nm = (u.lesson ? u.lesson + ' ' : '') + (u.title || ''); um.set(nm, (um.get(nm) || 0) + 1); }); parts.push('📗 ' + [...um.entries()].map(([n, c]) => clip(n, 22) + ' ' + c + '문제').join(', ')); }
      if (o.v.length) { const bm = new Map(); o.v.forEach(r => { const u = VT.units.find(x => x.id === r.unit_id), b = u && vtBook(u.book_id); const nm = (b ? b.title : '') + ' ' + (u ? (u.title || 'Unit ' + u.ord) : ''); bm.set(nm, (bm.get(nm) || 0) + 1); }); parts.push('📘 ' + [...bm.entries()].map(([n, c]) => clip(n.trim(), 24) + ' ' + c + '단계').join(', ')); }
      else if (o.vs) parts.push('📘 어휘 연습');
      if (o.p.length) parts.push('📖 ' + [...new Set(o.p.map(r => (ptPas(r.passage_id) || {}).title || ''))].map(t => clip(t, 20)).join(', '));
      if (o.iv) parts.push(`🔁 새 ${o.iv.new_n || 0} · 복습 ${o.iv.rev_n || 0}`);
      return `<tr><td>${k.slice(5).replace('-', '/')} (${WD[new Date(k + 'T00:00:00').getDay()]})</td><td>${parts.join(' &nbsp;')}</td><td class="n">${o.total ? dur(o.total) : '-'}</td></tr>`; }).join('');
    /* 오래 걸린 문제 */
    const slow = allG.filter(a => a.time_spent_sec > 0).sort((a, b) => b.time_spent_sec - a.time_spent_sec).slice(0, 6).map(a => { const q = T.qById[a.question_id] || {}, u = T.uById[a.unit_id || q.unit_id] || {};
      return `<tr><td>${a.submitted_at ? dayKey(a.submitted_at).slice(5).replace('-', '/') : ''}</td><td>${E(clip((u.lesson ? u.lesson + ' ' : '') + (u.title || ''), 26))}</td><td>${E(clip(q.prompt || q.ko || '', 56))}</td><td>${a.status === 'graded' ? (a.is_correct ? '✓' : '✗') : '-'}</td><td class="n">${dur(a.time_spent_sec)}</td></tr>`; }).join('');
    const grd = allG.filter(a => a.status === 'graded'), okN = grd.filter(a => a.is_correct).length;
    const rangeTxt = range ? `최근 ${range}일 (${from.slice(5).replace('-', '/')} ~ ${kst.slice(5).replace('-', '/')})` : '전체 기간';
    let secN = 0; const sec = (t, head, body) => body ? `<h2>${++secN}. ${t.replace(/^\d+\.\s*/, '')}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>` : '';
    const old = document.getElementById('srp'); if (old) old.remove();
    const el = document.createElement('div'); el.id = 'srp';
    el.innerHTML = `<div class="srp-bar"><button class="btn" id="srp-pr">🖨 인쇄 / PDF 저장</button>
      <select id="srp-r"><option value="7" ${range === 7 ? 'selected' : ''}>최근 7일</option><option value="30" ${range === 30 ? 'selected' : ''}>최근 30일</option><option value="90" ${range === 90 ? 'selected' : ''}>최근 90일</option><option value="0" ${range === 0 ? 'selected' : ''}>전체 기간</option></select>
      <button class="btn ghost" id="srp-g">문법 상세 리포트·오답노트</button><span style="flex:1"></span><button class="btn ghost" id="srp-x">닫기</button></div>
      <div class="pg"><div class="tiny" style="color:#4f46e5;font-weight:700">스텔라의 심쿵영어 · 학습 리포트</div><h1>${E(s.name)} 학생 학습 리포트</h1>
      <div class="meta"><span>학년 ${E(s.grade || '-')}</span><span>기간 ${rangeTxt}</span><span>작성일 ${kst}</span></div>
      <div class="k4"><div><small>학습한 날</small><b>${studyDays}일</b></div><div><small>총 학습 시간</small><b>${dur(tot)}</b></div><div><small>푼 문제(문법)</small><b>${allG.length}번</b><small>${grd.length ? '정답 ' + Math.round(okN / grd.length * 100) + '% (채점 ' + grd.length + '건)' : '채점 기록 없음'}</small></div><div><small>마지막 학습</small><b>${lastK ? lastK.slice(5).replace('-', '/') : '-'}</b></div></div>
      ${sec('1. 문법 · 교재별 학습 현황', '<th>단원</th><th>단계 진행</th><th>평균 점수</th><th>기간 내 풀이</th><th>마지막</th>', gRows)}
      ${sec('2. 어휘', '<th>단어장</th><th>수준</th><th>진행</th><th>기간 내</th>', vRows)}
      ${sec('3. 내신 본문', '<th>본문</th><th>과정</th><th>진행</th><th>시간</th>', pRows)}
      ${sec('4. 불규칙동사', '<th>배정</th><th>외운 동사</th><th>암기 상태</th><th>기간 내 학습</th>', ivRow)}
      ${sec('5. 날짜별 학습 일지', '<th>날짜</th><th>학습한 내용</th><th>시간</th>', log)}
      ${sec('6. 시간이 오래 걸린 문제 (문법)', '<th>날짜</th><th>단원</th><th>문제</th><th>결과</th><th>시간</th>', slow)}
      <h2>선생님 코멘트</h2><div class="cmt" contenteditable="true"></div>
      <p class="tiny" style="color:#666;margin-top:6px">· 모든 수치는 저장된 학습 기록에서 계산했어요. 어휘는 문제별 시간을 기록하지 않아 단계 단위로 보여 드려요. 학습 시간은 화면을 실제로 조작한 시간만 더한 값이에요.</p></div>`;
    document.body.appendChild(el);
    el.querySelector('#srp-x').onclick = () => el.remove();
    el.querySelector('#srp-pr').onclick = () => window.print();
    el.querySelector('#srp-r').onchange = e => window.stuReport(sid, parseInt(e.target.value, 10));
    el.querySelector('#srp-g').onclick = () => { el.remove(); T.stuSid = null; T.tab = 'students'; T.view = sid; drawTeacher(); };
  };
})();
