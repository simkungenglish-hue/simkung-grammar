/* 성장 리포트에 넣을 '전체 학습 요약' 만들기 (원장님 화면 전용)
   문법 말고도 어휘·내신 본문·불규칙동사에서 학습한 내용을 같은 기간으로 모아요. 저장된 기록을 읽기만 해요.
   결과(d.all)는 리포트 자료에 같이 담겨서 공유 링크에서도 그대로 보여요. */
'use strict';
function buildAllSnap(sid, days) {
  const kst = kstToday(), from = days ? addDays(kst, -(days - 1)) : '0000-00-00';
  const inR = k => !!k && k >= from && k <= kst;
  const col = typeof window.stuCollect === 'function' ? window.stuCollect(sid) : new Map();
  const ks = [...col.keys()].filter(inR).sort();
  const sum = f => ks.reduce((n, k) => n + (f(col.get(k)) || 0), 0);
  const sec = { g: sum(o => o.gsec), v: sum(o => o.vs), p: sum(o => o.ps), i: sum(o => o.is) };
  const active = ks.filter(k => { const o = col.get(k); return o.total > 0 || o.g.length || o.v.length || o.p.length || o.iv; });
  const N = days ? Math.min(days, 14) : 14;
  const calDays = Array.from({ length: N }, (_, i) => addDays(kst, -(N - 1 - i)));
  const cal = calDays.map(d => { const o = col.get(d); return { d, g: o ? o.gsec : 0, v: o ? o.vs : 0, p: o ? o.ps : 0, i: o ? o.is : 0 }; });
  const pctOf = (ok, n) => n > 0 ? Math.round(ok / n * 100) : null;

  /* 어휘: 기간 안에 끝낸 단계를 유닛별로 */
  const vocab = { rows: [], books: [], passed_n: 0 };
  try {
    const m = new Map();
    (STU.vprog || []).filter(r => r.student_id === sid && r.done_at && inR(dayKey(r.done_at))).forEach(r => {
      const u = (VT.units || []).find(x => x.id === r.unit_id); if (!u) return;
      const b = vtBook(u.book_id), o = m.get(u.id) || { book: b ? b.title : '어휘', name: stuUnitName(u), steps: 0, sc: 0, tot: 0, sec: 0, last: '' };
      o.steps++; if (r.total > 0) { o.sc += r.score || 0; o.tot += r.total; } o.sec += r.time_sec || 0;
      const dk = dayKey(r.done_at); if (dk > o.last) o.last = dk; m.set(u.id, o);
    });
    vocab.rows = [...m.values()].map(o => ({ book: o.book, name: o.name, steps: o.steps, pct: o.tot >= 5 ? pctOf(o.sc, o.tot) : null, sec: o.sec, last: o.last })).sort((a, b) => b.last.localeCompare(a.last)).slice(0, 10);
    vocab.books = stuVocabInfo(sid).map(x => ({ name: x.bk.title, a: x.passed, b: x.us.length }));
    vocab.passed_n = (VT.ustat || []).filter(x => x.student_id === sid && x.passed_at && inR(dayKey(x.passed_at))).length;
  } catch (e) { /* 어휘 기능이 없거나 불러오지 못해도 리포트는 만들어요 */ }

  /* 내신 본문 */
  const pass = { rows: [], books: [] };
  try {
    const m = new Map();
    (STU.pprog || []).filter(r => r.student_id === sid && r.done_at && inR(dayKey(r.done_at))).forEach(r => {
      const p = ptPas(r.passage_id); if (!p) return;
      const o = m.get(r.passage_id) || { name: p.title || '본문', label: (() => { try { return ptLabel(p); } catch (e) { return ''; } })(), steps: 0, sc: 0, tot: 0, sec: 0, last: '' };
      o.steps++; if (r.total > 0) { o.sc += r.score || 0; o.tot += r.total; } o.sec += r.time_sec || 0;
      const dk = dayKey(r.done_at); if (dk > o.last) o.last = dk; m.set(r.passage_id, o);
    });
    pass.rows = [...m.values()].map(o => ({ name: o.name, label: o.label, steps: o.steps, pct: o.tot >= 5 ? pctOf(o.sc, o.tot) : null, sec: o.sec, last: o.last })).sort((a, b) => b.last.localeCompare(a.last)).slice(0, 10);
    pass.books = stuPassInfo(sid).map(x => ({ name: x.p.title || '본문', a: x.done.length, b: x.total || 0 }));
  } catch (e) { /* 본문 기능이 없어도 계속 */ }

  /* 불규칙동사 */
  let iv = null;
  try {
    const ivA = (STU.ivA || []).find(x => x.student_id === sid);
    if (ivA) {
      const ivD = (STU.ivD || []).filter(x => x.student_id === sid && inR(x.day));
      const ivP = (STU.ivP || []).filter(x => x.student_id === sid && IV_BY.has(x.verb_no));
      const ok = ivD.reduce((n, x) => n + (x.ok || 0), 0), tot = ivD.reduce((n, x) => n + (x.total || 0), 0);
      const stg = (ivA.stages || []).filter(n => IV_STAGES.includes(n)).sort((x, y) => x - y);
      iv = {
        act: ivD.some(x => x.new_n || x.rev_n), new_n: ivD.reduce((n, x) => n + (x.new_n || 0), 0), rev_n: ivD.reduce((n, x) => n + (x.rev_n || 0), 0), pct: pctOf(ok, tot),
        days: ivD.filter(x => x.new_n || x.rev_n).length, sec: ivD.reduce((n, x) => n + (x.sec || 0), 0),
        stages: stg.map(n => { const vs = ivStageVerbs(n); return { name: ivStageName(n), a: ivP.filter(p => !p.relearn && vs.some(v => v.no === p.verb_no)).length, b: vs.length }; }),
        status: { learned: ivP.length, mastered: ivP.filter(p => !p.relearn && p.box >= 5).length, relearn: ivP.filter(p => p.relearn).length, due: ivP.filter(p => !p.relearn && p.due_on <= kst).length,
          ok: ivP.reduce((n, p) => n + (p.ok || 0), 0), bad: ivP.reduce((n, p) => n + (p.bad || 0), 0) },
        cal: calDays.map(d => { const x = ivD.find(y => y.day === d); return { d, pct: x && x.total ? pctOf(x.ok, x.total) : null }; })
      };
    }
  } catch (e) { /* 불규칙동사 기능이 없어도 계속 */ }

  return { v: 1, sec, total_sec: sec.g + sec.v + sec.p + sec.i, days: active.length, cal, vocab, pass, iv };
}
