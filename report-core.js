/* 심쿵영어 성장 리포트 그리기 (원장님 화면과 공유 링크 화면이 같이 써요)
   입력은 '리포트 자료(snap)' 하나뿐이고, 그 안의 숫자는 모두 저장된 풀이 기록에서 계산된 값이에요. */
'use strict';
const RPT = (() => {
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const C = { main: '#e8665d', light: '#f3b3ad', gray: '#a9a9a9', dark: '#444', line: '#d8d8d8' };
  const clipT = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const durTxt = sec => { if (sec == null) return '-'; if (sec < 60) return sec + '초'; const m = Math.floor(sec / 60); return m < 60 ? m + '분' : Math.floor(m / 60) + '시간 ' + (m % 60) + '분'; };
  const none = t => `<p class="rnone">${E(t)}</p>`;

  // 가로 막대: rows=[{label, a (0~100|null), b (0~100|null, 선택), note}]
  function barH(rows, { labelW = 118, w = 330, two = false, mark = null, narrow = false } = {}) {
    const rh = two ? 30 : 22, H = rows.length * rh + 6, W = labelW + w + 62;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="rchart${narrow ? ' rnar' : ''}" role="img">`;
    const lc = Math.floor(labelW / 10.5);
    if (mark != null) s += `<line x1="${labelW + w * mark / 100}" y1="0" x2="${labelW + w * mark / 100}" y2="${H}" stroke="${C.gray}" stroke-dasharray="3 3"/>`;
    rows.forEach((r, i) => {
      const y = 3 + i * rh;
      s += `<text x="0" y="${y + (two ? 13 : 15)}" font-size="11" fill="${C.dark}">${E(clipT(r.label, lc))}</text>`;
      const bar = (v, yy, col, t) => v == null ? '' : `<rect x="${labelW}" y="${yy}" width="${Math.max(1, w * v / 100)}" height="9" rx="2" fill="${col}"/><text x="${labelW + Math.max(1, w * v / 100) + 4}" y="${yy + 8}" font-size="10" fill="${C.dark}">${E(t != null ? t : v + '%')}</text>`;
      if (r.a == null && r.b == null) s += `<text x="${labelW}" y="${y + 13}" font-size="10" fill="${C.gray}">${E(r.note || '평가 자료 부족')}</text>`;
      else if (two) s += bar(r.a, y + 2, C.main) + bar(r.b, y + 14, C.gray);
      else s += bar(r.a, y + 4, C.main, r.t);
    });
    return s + '</svg>';
  }
  // 도넛: parts=[{label,n,color}]
  function donut(parts) {
    const tot = parts.reduce((a, p) => a + p.n, 0); if (!tot) return '';
    const R = 42, CIRC = 2 * Math.PI * R; let off = 0, arcs = '';
    parts.forEach(p => { if (!p.n) return; const len = CIRC * p.n / tot;
      arcs += `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${p.color}" stroke-width="20" stroke-dasharray="${len} ${CIRC - len}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"/>`; off += len; });
    const leg = parts.map(p => `<div class="rleg"><i style="background:${p.color}"></i>${E(p.label)} <b>${p.n}문제</b> <span>${Math.round(p.n / tot * 100)}%</span></div>`).join('');
    return `<div class="rdonut"><svg viewBox="0 0 120 120" class="rchart" role="img"><circle cx="60" cy="60" r="${R}" fill="none" stroke="#fff" stroke-width="20"/>${arcs}<text x="60" y="58" text-anchor="middle" font-size="18" font-weight="700" fill="${C.dark}">${tot}</text><text x="60" y="73" text-anchor="middle" font-size="9" fill="${C.gray}">채점된 문제</text></svg><div>${leg}</div></div>`;
  }
  // 세로 막대: items=[{label, v, text}]
  function barV(items, { h = 110, color = C.main } = {}) {
    const n = items.length, bw = Math.min(38, 440 / n), gap = 12, W = n * (bw + gap) + 10, mx = Math.max(1, ...items.map(i => i.v || 0));
    let s = `<svg viewBox="0 0 ${W} ${h + 34}" class="rchart rwide" role="img"><line x1="0" y1="${h + 4}" x2="${W}" y2="${h + 4}" stroke="${C.line}"/>`;
    items.forEach((it, i) => { const x = 6 + i * (bw + gap), bh = it.v == null ? 0 : Math.max(2, (h - 14) * it.v / mx);
      s += it.v == null ? '' : `<rect x="${x}" y="${h + 4 - bh}" width="${bw}" height="${bh}" rx="2" fill="${color}"/><text x="${x + bw / 2}" y="${h - bh}" text-anchor="middle" font-size="9.5" fill="${C.dark}">${E(it.text)}</text>`;
      s += `<text x="${x + bw / 2}" y="${h + 18}" text-anchor="middle" font-size="9.5" fill="${C.dark}">${E(it.label)}</text>`; });
    return s + '</svg>';
  }

  const cmtEmpty = '<span class="muted noprint">(코멘트가 아직 없어요)</span>';
  // 선생님 코멘트: "■ 제목: 내용" 줄마다 제목 칸과 내용 칸으로 나눠 표처럼 보여줘요
  function commentHtml(text) {
    const rows = String(text || '').split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => {
      const m = l.match(/^■\s*([^:：]{1,12})[:：]\s*(.*)$/);
      return m ? `<div class="rcm-row"><b class="rcm-l">${E(m[1])}</b><span class="rcm-t">${E(m[2])}</span></div>`
        : `<div class="rcm-row"><span class="rcm-t rcm-full">${E(l.replace(/^■\s*/, ''))}</span></div>`;
    });
    return rows.length ? rows.join('') : cmtEmpty;
  }

  function render(d) {
    const sm = d.summary, enough = sm.enough;
    const kpi = (t, v, sub) => `<div class="rkpi"><div class="rk-v">${v}</div><div class="rk-t">${E(t)}</div>${sub ? `<div class="rk-s">${sub}</div>` : ''}</div>`;
    const kpis = sm.submissions ? `<div class="rkpis">${kpi('푼 문제', sm.solved + '문제', '제출 ' + sm.submissions + '회')
      + kpi('처음 푼 정답률', enough ? sm.first_pct + '%' : '자료 부족', enough ? sm.first_ok + '/' + sm.first_n : '채점 끝난 문제 ' + sm.first_n + '개')
      + kpi('공부한 날', sm.days + '일', '')
      + kpi('학습 시간', sm.time_n ? durTxt(sm.time_sec) : '기록 없음', sm.time_n && sm.time_n < sm.time_total ? sm.time_total + '회 중 ' + sm.time_n + '회 측정' : '')}</div>` : '';
    const table = sm.submissions ? `<table><tbody>
      <tr><td>푼 문제 수</td><td>${sm.solved}문제 (제출 ${sm.submissions}회)</td></tr>
      <tr><td>공부한 날</td><td>${sm.days}일 <span class="tiny">(답안을 제출한 날짜 기준)</span></td></tr>
      <tr><td>처음 푼 정답률</td><td>${enough ? sm.first_pct + '% (' + sm.first_ok + '/' + sm.first_n + ')' : '평가 자료 부족 (채점 끝난 문제 ' + sm.first_n + '개, 최소 ' + d.min.overall + '개 필요)'}</td></tr>
      <tr><td>학습 시간</td><td>${sm.time_n ? durTxt(sm.time_sec) + (sm.time_n < sm.time_total ? ` <span class="tiny">(제출 ${sm.time_total}회 중 ${sm.time_n}회 측정)</span>` : '') : '기록 없음 <span class="tiny">(시간 측정 기능 적용 전 풀이는 시간이 없어요)</span>'}</td></tr>
      <tr><td>채점 대기</td><td>${sm.pending}건 ${sm.pending ? '<span class="tiny">(확인 전이라 위 수치에 아직 반영되지 않았어요)</span>' : ''}</td></tr></tbody></table>`
      : '<p>이 기간에 풀이 기록이 없어요. <b>평가 자료 부족</b></p>';

    const how = d.how && enough ? donut([
      { label: '처음부터 스스로 맞힘', n: d.how.own1, color: C.main }, { label: '다시 풀어서 스스로 맞힘', n: d.how.retry, color: C.light },
      { label: '힌트·해설을 본 뒤 맞힘', n: d.how.helped, color: C.gray }, { label: '아직 못 맞힘', n: d.how.unsolved, color: C.dark }])
      + '<p class="tiny">비율은 채점이 끝난 문제 기준이에요. “스스로”는 힌트·해설을 열지 않은 경우예요.</p>' : none('평가 자료 부족');

    const stageRows = d.stages.map(s => s.status === 'none' ? { label: s.name, a: null, note: '풀이 기록 없음' }
      : s.status === 'few' ? { label: s.name + ' (' + s.n + ')', a: null, note: '평가 자료 부족' } : { label: s.name + ' (' + s.n + ')', a: s.first, b: s.final });
    const stages = `<div class="rlegend"><i style="background:${C.main}"></i>처음 정답률 <i style="background:${C.gray}"></i>최종 정답률</div>` + barH(stageRows, { two: true, labelW: 104, w: 140 });

    const tags = d.tags.length ? barH(d.tags.map(t => ({ label: t.tag, a: t.pct, note: '평가 자료 부족' })), { mark: 60, labelW: 112, w: 130 }) + `<p class="tiny">점선은 60%예요. 그 아래 개념은 다시 봐요. (개념별 ${d.min.tag}문제 미만은 평가 자료 부족)</p>` : none('풀이 기록 없음');

    const rounds = d.rounds && d.rounds.length > 1 ? `<section class="rsec"><h2>회차별 비교</h2>${barV(d.rounds.map(r => ({ label: r.r + '회차', v: r.pct, text: r.pct == null ? '' : r.pct + '%' })), { h: 100 })}
      <table class="rt"><thead><tr><th>회차</th><th>채점된 문제</th><th>처음 정답률</th><th>학습 시간</th></tr></thead><tbody>${d.rounds.map(r => `<tr><td>${r.r}회차</td><td>${r.n}문제</td><td>${r.pct == null ? '평가 자료 부족' : r.pct + '%'}</td><td>${r.tn ? durTxt(r.sec) : '기록 없음'}</td></tr>`).join('')}</tbody></table>
      <p class="tiny">다시 학습할 때마다 같은 단원을 새 회차로 풀어요. 이전 회차 기록은 그대로 보존돼 있어 변화를 비교할 수 있어요.</p></section>` : '';

    const daily = d.daily && d.daily.some(x => x.sec != null) ? `<section class="rsec"><h2>날짜별 학습 시간</h2>${barV(d.daily.map(x => ({ label: x.d.slice(5).replace('-', '/'), v: x.sec == null ? null : Math.round(x.sec / 60 * 10) / 10, text: x.sec == null ? '' : durTxt(x.sec) })), { h: 90, color: C.main })}
      <p class="tiny">최근 공부한 날 ${d.daily.length}일까지 표시해요. 시간 기록이 없는 날은 막대가 없어요.</p></section>` : '';

    const errs = d.errors.length ? `<section class="rsec"><h2>자주 나온 오류 유형</h2>${barH(d.errors.map(([n, c]) => ({ label: n, a: Math.round(c / Math.max(...d.errors.map(e => e[1])) * 100), t: c + '회' })), { w: 200, narrow: true })}
      <p>${d.errors.map(([n, c]) => `<span class="pill">${E(n)} ${c}회</span>`).join('')}</p><p class="tiny">원장님이 채점하며 남긴 유형 기준이에요.</p></section>` : '';

    const md = x => x ? x.slice(5).replace('-', '/') : '';
    const unitsSec = d.units && d.units.length ? `<section class="runit"><div class="ru-h"><span>이번에 학습한 내용</span><small>교재 · 단원 · 학습명</small></div>${d.units.map(u =>
      `<div class="ru-row"><span class="ru-book">${E(u.book)}</span><b class="ru-name">${E(u.name)}</b><span class="ru-stat">${u.n}문제 · 처음 정답률 ${u.pct == null ? '자료 부족' : u.pct + '%'} · ${u.first === u.last ? md(u.first) : md(u.first) + '~' + md(u.last)}</span></div>`).join('')}</section>` : '';
    return `<div class="report a4">
      <div class="rhead"><div class="rbrand">스텔라의 심쿵영어 · 문법 학습 분석 리포트</div><h1>${E(d.name)} 학생 성장 리포트</h1>
        <div class="rmeta"><span><i>학년</i>${E(d.grade || '-')}</span><span><i>분석 기간</i>${E(d.range)}</span><span><i>작성일</i>${E(d.made)}</span></div></div>
      ${unitsSec}
      ${kpis}
      <div class="rgrid"><section class="rsec"><h2>1. 한눈에 보기</h2>${table}</section>
      <section class="rsec"><h2>2. 어떻게 맞혔나요? <span class="tiny">(최종 결과 기준)</span></h2>${how}</section></div>
      <div class="rgrid"><section class="rsec"><h2>3. 단계별 결과</h2>${stages}</section>
      <section class="rsec"><h2>4. 개념별 살펴보기</h2>${tags}</section></div>
      <div class="rgrid">${rounds}${daily}</div>${errs}
      <section class="rsec rcomwrap"><h2>선생님 종합 코멘트</h2><div id="cmtP" class="rcomment">${commentHtml(d.comment)}</div></section>
      <section class="rsec"><h2>측정 기준 안내</h2>
      <p class="tiny">· 모든 수치는 서버에 저장된 풀이 기록에서만 계산했어요. 기록이 부족한 항목은 “평가 자료 부족”으로 표시했어요.<br>
      · 공부한 날은 답안 제출 날짜 기준이에요. 학습 시간은 학생이 문제 화면에서 실제로 조작한 시간만 더한 값이에요(3분 이상 가만히 있거나 다른 화면을 본 시간은 제외, 문제당 최대 30분). 시간 측정 전에 푼 기록은 시간 합계에서 빠져요.<br>
      · 정답률 최소 기준: 전체 ${d.min.overall}문제, 단계별 ${d.min.stage}문제, 개념별 ${d.min.tag}문제.</p></section>
    </div>`;
  }
  return { render, durTxt, esc: E, commentHtml };
})();
