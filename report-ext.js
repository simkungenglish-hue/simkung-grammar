/* 심쿵영어 성장 리포트 — 문법 말고 어휘·내신 본문·불규칙동사까지 한 장에 보여 주는 부분
   report-core.js 의 RPT.render 가 d.all(리포트 자료의 전체 학습 요약)이 있을 때만 이 파일을 불러 써요. */
'use strict';
window.RPT_X = (() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const AR = { g: ['문법', '#4f46e5', '📗'], v: ['어휘', '#0ea5e9', '📘'], p: ['본문', '#10b981', '📖'], i: ['불규칙동사', '#f59e0b', '🔁'] };
  const GRAY = '#a9a9a9', DARK = '#444';
  const md = x => x ? x.slice(5).replace('-', '/') : '';
  const clipT = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const dur = sec => { sec = Math.round(sec || 0); if (sec <= 0) return '-'; if (sec < 60) return sec + '초'; const m = Math.floor(sec / 60); return m < 60 ? m + '분' : Math.floor(m / 60) + '시간 ' + (m % 60) + '분'; };
  const none = t => `<p class="rnone">${E(t)}</p>`;
  const sumA = (arr, f) => (arr || []).reduce((n, x) => n + (f(x) || 0), 0);

  /* 도넛 (고리 모양 비율): parts=[{label,n,color}] — n 은 개수 */
  function donut(parts, top, sub, unit) {
    const tot = parts.reduce((a, p) => a + p.n, 0); if (!tot) return '';
    const R = 42, CIRC = 2 * Math.PI * R; let off = 0, arcs = '';
    parts.forEach(p => { if (!p.n) return; const len = CIRC * p.n / tot;
      arcs += `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${p.color}" stroke-width="20" stroke-dasharray="${len} ${CIRC - len}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"/>`; off += len; });
    const leg = parts.filter(p => p.n).map(p => `<div class="rleg"><i style="background:${p.color}"></i>${E(p.label)} <b>${p.n}${unit}</b> <span>${Math.round(p.n / tot * 100)}%</span></div>`).join('');
    return `<div class="rdonut"><svg viewBox="0 0 120 120" class="rchart" role="img"><circle cx="60" cy="60" r="${R}" fill="none" stroke="#fff" stroke-width="20"/>${arcs}<text x="60" y="58" text-anchor="middle" font-size="${top.length > 5 ? 11 : 15}" font-weight="700" fill="${DARK}">${E(top)}</text><text x="60" y="73" text-anchor="middle" font-size="9" fill="${GRAY}">${E(sub)}</text></svg><div>${leg}</div></div>`;
  }
  /* 프로그레스 바: rows=[{label, note, v (0~100|null), text, color}] */
  function prog(rows) {
    return rows.map(r => `<div class="rpb"><div class="rpb-l">${r.label}${r.note ? ` <small>${E(r.note)}</small>` : ''}</div><div class="rpb-t"><i style="width:${r.v == null ? 0 : Math.max(2, Math.min(100, r.v))}%;background:${r.color}"></i></div><b>${E(r.text)}</b></div>`).join('');
  }
  /* 누적 막대: 날짜마다 영역별 학습 시간을 쌓아요 */
  function stack(cal) {
    const n = cal.length, bw = Math.min(30, 300 / n), gap = Math.max(6, bw * .4), W = n * (bw + gap) + 8, h = 100;
    const tot = cal.map(c => c.g + c.v + c.p + c.i), mx = Math.max(60, ...tot);
    let s = `<svg viewBox="0 0 ${W} ${h + 30}" class="rchart rwide" role="img"><line x1="0" y1="${h + 4}" x2="${W}" y2="${h + 4}" stroke="#d8d8d8"/>`;
    cal.forEach((c, i) => {
      const x = 4 + i * (bw + gap); let y = h + 4;
      ['g', 'v', 'p', 'i'].forEach(k => { const hh = (h - 14) * c[k] / mx; if (hh > 0.5) { y -= hh; s += `<rect x="${x}" y="${y}" width="${bw}" height="${hh}" fill="${AR[k][1]}"/>`; } });
      if (tot[i] > 0) s += `<text x="${x + bw / 2}" y="${y - 3}" text-anchor="middle" font-size="9" fill="${DARK}">${Math.round(tot[i] / 60)}분</text>`;
      if (n <= 8 || i % 2 === 0 || i === n - 1) s += `<text x="${x + bw / 2}" y="${h + 17}" text-anchor="middle" font-size="9" fill="${DARK}">${md(c.d)}</text>`;
    });
    return s + '</svg>' + `<div class="rlegend">${['g', 'v', 'p', 'i'].map(k => `<i style="background:${AR[k][1]}"></i>${AR[k][0]} `).join('')}</div>`;
  }
  /* 히트맵: 영역(줄) × 날짜(칸), 진할수록 오래 학습 */
  function heat(cal) {
    const n = cal.length, cw = Math.min(24, 250 / n), lw = 62, ch = 20, W = lw + n * cw + 4, H = 4 * ch + 22;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="rchart" role="img">`;
    ['g', 'v', 'p', 'i'].forEach((k, r) => {
      s += `<text x="0" y="${r * ch + 14}" font-size="10.5" fill="${DARK}">${AR[k][0]}</text>`;
      cal.forEach((c, i) => { const m = c[k] / 60, op = m <= 0 ? 0 : m < 5 ? .25 : m < 15 ? .5 : m < 30 ? .75 : 1;
        s += `<rect x="${lw + i * cw}" y="${r * ch + 2}" width="${cw - 2}" height="${ch - 3}" rx="3" fill="${op ? AR[k][1] : '#eef0f3'}" fill-opacity="${op || 1}"/>`; });
    });
    cal.forEach((c, i) => { if (n <= 8 || i % 2 === 0 || i === n - 1) s += `<text x="${lw + i * cw + (cw - 2) / 2}" y="${4 * ch + 14}" text-anchor="middle" font-size="8.5" fill="${GRAY}">${md(c.d)}</text>`; });
    return s + '</svg><p class="tiny">진할수록 그날 오래 학습했어요 (5분 · 15분 · 30분 단위)</p>';
  }
  /* 선 그래프: pts=[{label, v (0~100|null)}] */
  function line(pts, color) {
    const n = pts.length, W = 330, H = 110, L = 26, R = 8, T = 14, B = 22, X = i => n === 1 ? L + (W - L - R) / 2 : L + (W - L - R) * i / (n - 1), Y = v => T + (H - T - B) * (1 - v / 100);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="rchart" role="img">`;
    [0, 50, 100].forEach(g => { s += `<line x1="${L}" y1="${Y(g)}" x2="${W - R}" y2="${Y(g)}" stroke="#e5e5e5"/><text x="${L - 4}" y="${Y(g) + 3}" text-anchor="end" font-size="8.5" fill="${GRAY}">${g}</text>`; });
    let seg = []; const flush = () => { if (seg.length > 1) s += `<polyline fill="none" stroke="${color}" stroke-width="2" points="${seg.join(' ')}"/>`; seg = []; };
    pts.forEach((p, i) => { if (p.v == null) { flush(); return; } seg.push(`${X(i)},${Y(p.v)}`); });
    flush();
    pts.forEach((p, i) => { if (p.v != null) s += `<circle cx="${X(i)}" cy="${Y(p.v)}" r="3" fill="${color}"/><text x="${X(i)}" y="${Y(p.v) - 6}" text-anchor="middle" font-size="9" fill="${DARK}">${p.v}</text>`;
      if (n <= 8 || i % 2 === 0 || i === n - 1) s += `<text x="${X(i)}" y="${H - 7}" text-anchor="middle" font-size="8.5" fill="${GRAY}">${md(p.d)}</text>`; });
    return s + '</svg>';
  }
  const banner = (k, sub) => `<div class="rarea" style="border-color:${AR[k][1]};color:${AR[k][1]}"><span>${AR[k][2]} ${AR[k][0]}</span><small>${E(sub || '')}</small></div>`;
  const table = (head, rows) => `<table class="rt"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;

  function parts(d) {
    const a = d.all, sm = d.summary, enough = sm.enough, out = {};
    const act = ['g', 'v', 'p', 'i'].filter(k => a.sec[k] > 0 || (k === 'g' && sm.submissions) || (k === 'v' && a.vocab.rows.length) || (k === 'p' && a.pass.rows.length) || (k === 'i' && a.iv && a.iv.act));

    /* 이번에 학습한 내용 (영역 전체) */
    const row = (k, book, name, stat) => `<div class="ru-row"><span class="ru-area" style="background:${AR[k][1]}">${AR[k][0]}</span><span class="ru-book">${E(book)}</span><b class="ru-name">${E(name)}</b><span class="ru-stat">${E(stat)}</span></div>`;
    const R = [];
    (d.units || []).forEach(u => R.push(row('g', u.book, u.name, `${u.n}문제 · 처음 정답률 ${u.pct == null ? '자료 부족' : u.pct + '%'} · ${u.first === u.last ? md(u.first) : md(u.first) + '~' + md(u.last)}`)));
    a.vocab.rows.forEach(v => R.push(row('v', v.book, v.name, `${v.steps}단계 완료${v.pct == null ? '' : ' · 점수 ' + v.pct + '%'}${v.sec ? ' · ' + dur(v.sec) : ''} · ${md(v.last)}`)));
    a.pass.rows.forEach(p => R.push(row('p', p.label || '내신 본문', p.name, `${p.steps}단계 완료${p.pct == null ? '' : ' · 점수 ' + p.pct + '%'}${p.sec ? ' · ' + dur(p.sec) : ''} · ${md(p.last)}`)));
    if (a.iv && a.iv.act) R.push(row('i', '불규칙동사', `새 동사 ${a.iv.new_n}개 · 복습 ${a.iv.rev_n}개`, `${a.iv.pct == null ? '' : '정답률 ' + a.iv.pct + '% · '}${a.iv.days}일 · ${dur(a.iv.sec)}`));
    out.units = R.length ? `<section class="runit"><div class="ru-h"><span>이번에 학습한 내용</span><small>영역 · 교재 · 단원 · 학습명</small></div>${R.join('')}</section>` : `<section class="runit"><div class="ru-h"><span>이번에 학습한 내용</span></div>${none('이 기간에 학습 기록이 없어요.')}</section>`;

    /* 핵심 숫자 */
    const kpi = (t, v, sub) => `<div class="rkpi"><div class="rk-v">${v}</div><div class="rk-t">${E(t)}</div>${sub ? `<div class="rk-s">${sub}</div>` : ''}</div>`;
    out.kpis = `<div class="rkpis">${kpi('총 학습 시간', a.total_sec ? dur(a.total_sec) : '기록 없음', '문법·어휘·본문·불규칙 합계')
      + kpi('공부한 날', a.days + '일', d.range)
      + kpi('학습한 영역', act.length + '개', act.map(k => AR[k][0]).join(' · ') || '-')
      + kpi('문법 처음 정답률', enough ? sm.first_pct + '%' : (sm.submissions ? '자료 부족' : '-'), sm.submissions ? '푼 문제 ' + sm.solved + '개' : '이 기간 문법 풀이 없음')}</div>`;

    /* 전체 한눈에: 영역별 시간(도넛) + 영역별 진행(프로그레스 바) */
    const dn = ['g', 'v', 'p', 'i'].map(k => ({ label: AR[k][0], n: Math.round(a.sec[k] / 60), color: AR[k][1] }));
    const donutHtml = dn.some(x => x.n > 0) ? donut(dn, a.total_sec >= 3600 ? Math.floor(a.total_sec / 3600) + '시간 ' + Math.round(a.total_sec % 3600 / 60) + '분' : Math.round(a.total_sec / 60) + '분', '총 학습 시간', '분') + '<p class="tiny">영역별로 화면을 실제로 조작한 시간이에요.</p>' : none('학습 시간 기록이 없어요');
    const P = [];
    if (sm.submissions) P.push({ label: `${AR.g[2]} 문법`, note: '처음 정답률', v: enough ? sm.first_pct : null, text: enough ? sm.first_pct + '%' : '자료 부족', color: AR.g[1] });
    if (a.vocab.books.length) { const A = sumA(a.vocab.books, b => b.a), B = sumA(a.vocab.books, b => b.b); P.push({ label: `${AR.v[2]} 어휘`, note: `통과 ${A}/${B}`, v: B ? Math.round(A / B * 100) : null, text: B ? Math.round(A / B * 100) + '%' : '-', color: AR.v[1] }); }
    if (a.pass.books.length) { const A = sumA(a.pass.books, b => b.a), B = sumA(a.pass.books, b => b.b); P.push({ label: `${AR.p[2]} 내신 본문`, note: `단계 ${A}/${B}`, v: B ? Math.round(A / B * 100) : null, text: B ? Math.round(A / B * 100) + '%' : '-', color: AR.p[1] }); }
    if (a.iv && a.iv.stages.length) { const A = sumA(a.iv.stages, b => b.a), B = sumA(a.iv.stages, b => b.b); P.push({ label: `${AR.i[2]} 불규칙동사`, note: `외운 ${A}/${B}개`, v: B ? Math.round(A / B * 100) : null, text: B ? Math.round(A / B * 100) + '%' : '-', color: AR.i[1] }); }
    out.overview = `<div class="rgrid"><section class="rsec"><h2>영역별 학습 시간</h2>${donutHtml}</section>
      <section class="rsec"><h2>영역별 진행 정도</h2>${P.length ? prog(P) + '<p class="tiny">문법은 처음 푼 정답률, 나머지는 배정한 양 중 끝낸 비율이에요.</p>' : none('배정된 학습이 없어요')}</section></div>
      <div class="rgrid"><section class="rsec"><h2>날짜별 학습 시간</h2>${a.cal.some(c => c.g + c.v + c.p + c.i > 0) ? stack(a.cal) : none('이 기간에 시간 기록이 없어요')}</section>
      <section class="rsec"><h2>학습한 날 한눈에</h2>${a.cal.some(c => c.g + c.v + c.p + c.i > 0) ? heat(a.cal) : none('이 기간에 학습 기록이 없어요')}</section></div>`;

    out.gramBanner = banner('g', sm.submissions ? `푼 문제 ${sm.solved}개 · 제출 ${sm.submissions}회` : '');

    /* 어휘 */
    const v = a.vocab;
    out.vocab = !v.rows.length && !v.books.length ? '' : banner('v', v.books.length ? `통과한 유닛 ${sumA(v.books, b => b.a)}/${sumA(v.books, b => b.b)}${v.passed_n ? ' · 이 기간 새로 통과 ' + v.passed_n + '개' : ''}` : '') +
      `<div class="rgrid"><section class="rsec"><h2>학습한 단어장·유닛</h2>${v.rows.length ? table(['단어장 · 유닛', '단계', '점수', '시간'], v.rows.map(r => `<tr><td>${E(clipT(r.book + ' ' + r.name, 28))}</td><td>${r.steps}단계</td><td>${r.pct == null ? '-' : r.pct + '%'}</td><td>${dur(r.sec)}</td></tr>`)) : none('이 기간에 어휘 학습 기록이 없어요')}</section>
      <section class="rsec"><h2>단어장별 진행</h2>${v.books.length ? prog(v.books.map(b => ({ label: E(clipT(b.name, 14)), note: `통과 ${b.a}/${b.b}`, v: b.b ? Math.round(b.a / b.b * 100) : null, text: b.b ? Math.round(b.a / b.b * 100) + '%' : '-', color: AR.v[1] }))) : none('배정된 단어장이 없어요')}
      ${v.rows.some(r => r.pct != null) ? '<h3 class="rsub">유닛별 점수</h3>' + prog(v.rows.filter(r => r.pct != null).slice(0, 6).map(r => ({ label: E(clipT(r.name, 12)), v: r.pct, text: r.pct + '%', color: r.pct >= 80 ? '#10b981' : r.pct >= 60 ? AR.v[1] : '#f59e0b' }))) : ''}</section></div>`;

    /* 내신 본문 */
    const p = a.pass;
    out.pass = !p.rows.length && !p.books.length ? '' : banner('p', p.books.length ? `끝낸 단계 ${sumA(p.books, b => b.a)}/${sumA(p.books, b => b.b)}` : '') +
      `<div class="rgrid"><section class="rsec"><h2>학습한 본문</h2>${p.rows.length ? table(['본문', '단계', '점수', '시간'], p.rows.map(r => `<tr><td>${E(clipT(r.name, 26))}</td><td>${r.steps}단계</td><td>${r.pct == null ? '-' : r.pct + '%'}</td><td>${dur(r.sec)}</td></tr>`)) : none('이 기간에 본문 학습 기록이 없어요')}</section>
      <section class="rsec"><h2>본문별 진행</h2>${p.books.length ? prog(p.books.map(b => ({ label: E(clipT(b.name, 14)), note: `${b.a}/${b.b}단계`, v: b.b ? Math.round(b.a / b.b * 100) : null, text: b.b ? Math.round(b.a / b.b * 100) + '%' : '-', color: AR.p[1] }))) : none('배정된 본문이 없어요')}</section></div>`;

    /* 불규칙동사 */
    const iv = a.iv;
    if (!iv) out.iv = '';
    else {
      const st = iv.status, dn2 = [{ label: '완전 암기', n: st.mastered, color: '#10b981' }, { label: '외우는 중', n: Math.max(0, st.learned - st.mastered - st.relearn), color: AR.i[1] }, { label: '다시 배울 동사', n: st.relearn, color: GRAY }];
      out.iv = banner('i', iv.act ? `새 동사 ${iv.new_n}개 · 복습 ${iv.rev_n}개${iv.pct == null ? '' : ' · 정답률 ' + iv.pct + '%'} · ${iv.days}일 · ${dur(iv.sec)}` : '이 기간에는 학습 기록이 없어요') +
        `<div class="rgrid"><section class="rsec"><h2>암기 상태</h2>${st.learned ? donut(dn2, st.learned + '개', '배운 동사', '개') + `<p class="tiny">복습할 차례가 된 동사 ${st.due}개 · 지금까지 맞힘 ${st.ok}번 · 틀림 ${st.bad}번</p>` : none('아직 배운 동사가 없어요')}</section>
        <section class="rsec"><h2>단계별 진행</h2>${iv.stages.length ? prog(iv.stages.map(s => ({ label: E(s.name), note: `${s.a}/${s.b}개`, v: s.b ? Math.round(s.a / s.b * 100) : null, text: s.b ? Math.round(s.a / s.b * 100) + '%' : '-', color: s.a >= s.b ? '#10b981' : AR.i[1] }))) : none('배정된 단계가 없어요')}</section></div>` +
        (iv.cal.some(c => c.pct != null) ? `<section class="rsec"><h2>날짜별 정답률 <span class="tiny">(새 동사·복습 풀이 기준)</span></h2>${line(iv.cal.map(c => ({ d: c.d, v: c.pct })), AR.i[1])}</section>` : '');
    }
    return out;
  }
  return { parts };
})();
