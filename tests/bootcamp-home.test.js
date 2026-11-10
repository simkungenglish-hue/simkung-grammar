/* 회귀 테스트: 부트캠프 학생 홈 — 부트캠프 단원만 단원 번호 순서로 보이고, 단계는 버튼으로 나오며,
   지금까지의 풀이 기록(XP)은 그대로 남아요. 부트캠프가 없는 학생 화면은 예전과 같아요.
   실행: node --test tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const { createFake } = require('./fake-supabase');
const { loadApp } = require('./load-app');

const run = (ctx, code) => vm.runInContext(code, ctx);
const unit = (id, code, book, title) => ({ id, code, title, school_book: book, lesson: null, status: 'published' });
function tables(bootcamp) {
  const units = [unit('uD', 'D6', '동아(윤정미) 중3', '6과 문법'), unit('u3', 'BC-U3', '부트캠프', 'U3 be동사'), unit('u1', 'BC-U1', '부트캠프', 'U1 품사'), unit('u4', 'BC-U4', '부트캠프', 'U4 부정·의문')];
  const use = bootcamp ? units : [units[0]];
  const asg = use.map((u, i) => ({ id: 'a_' + u.id, student_id: 's1', unit_id: u.id, units: u, settings: {}, created_at: '2026-11-0' + (i + 1) }));
  const questions = [];
  for (const u of use) for (const [st, n] of [['concept', 2], ['basic', 2]]) for (let i = 1; i <= n; i++) questions.push({ id: `${u.id}_${st}${i}`, unit_id: u.id, concept_tag: 't', stage: st, qtype: 'mc', ord: i, points: 1 });
  const attempts = [
    { id: 'x1', student_id: 's1', assignment_id: 'a_uD', question_id: 'uD_concept1', attempt_no: 1, round: 1, status: 'graded', is_correct: true, score: 1, submitted_at: '2026-11-01T01:00:00Z' },
    { id: 'x2', student_id: 's1', assignment_id: 'a_uD', question_id: 'uD_concept2', attempt_no: 1, round: 1, status: 'graded', is_correct: true, score: 1, submitted_at: '2026-11-01T01:01:00Z' },
  ];
  return { profiles: [{ id: 's1', role: 'student', name: '김하나', grade: '중3' }], assignments: asg, units, questions, concepts: [], attempts,
    unit_videos: [{ id: 'v1', unit_id: 'u1', yt_id: 'YT1', title: 'U1 영상', school_book: '부트캠프', ord: 1 }, { id: 'v2', unit_id: 'uD', yt_id: 'YT2', title: '동아 영상', school_book: '동아(윤정미) 중3', ord: 1 }],
    lec_videos: [], lesson_decks: [] };
}
async function home(bootcamp) {
  const ctx = loadApp(['app.js', 'student2.js']);
  ctx.__sb = createFake(tables(bootcamp));
  run(ctx, 'document.querySelector = () => ({}); document.querySelectorAll = () => [];');
  run(ctx, 'S.sb = __sb; S.user = { id: "s1" }; S.profile = { id: "s1", name: "김하나", grade: "중3" }; var __html = ""; shell = h => { __html = h; };');
  await run(ctx, 'loadStudent()');
  run(ctx, 'studentHome()');
  return { ctx, html: run(ctx, '__html') };
}

test('부트캠프 학생: 부트캠프 단원만, 단원 번호 순서(U1, U3, U4)로, 단계 버튼과 함께 보인다', async () => {
  const { ctx, html } = await home(true);
  assert.strictEqual(run(ctx, 'ST.bootcamp'), true);
  assert.strictEqual(run(ctx, 'ST.asg.length'), 3, '동아 단원은 화면에서 빠진다');
  assert.strictEqual(run(ctx, 'ST.asgAll.length'), 4, '배정 자체는 지워지지 않는다');
  assert.ok(!html.includes('6과 문법'), '동아 단원 이름이 보이지 않는다');
  const tiles = [...html.matchAll(/<button type="button" class="s2-ui[^"]*" data-mu="([^"]+)"/g)].map(m => m[1]);
  assert.deepStrictEqual(tiles, ['a_u1', 'a_u3', 'a_u4'], '유닛마다 버튼(타일)이 단원 번호 순서로 나온다');
  assert.ok(html.includes('class="s2-ui cur"'), '지금 할 유닛이 강조된다');
  assert.ok(html.includes('부트캠프 학습'));
  assert.ok(!html.includes('중등 내신'), '내신 타일이 없다');
});

test('부트캠프 학생: 지금까지의 풀이 기록(XP·문제 수)은 그대로 남는다', async () => {
  const { ctx } = await home(true);
  assert.strictEqual(run(ctx, 's2Stats().total'), 2);
  assert.strictEqual(run(ctx, 's2Stats().xp'), 20);
});

test('부트캠프 학생: 영상 강의실은 부트캠프 영상만', async () => {
  const { ctx } = await home(true);
  assert.deepStrictEqual(JSON.parse(run(ctx, 'JSON.stringify(myLib().map(v => v.yt_id))')), ['YT1']);
});

test('부트캠프 단원이 없는 학생 화면은 예전과 같다', async () => {
  const { ctx, html } = await home(false);
  assert.strictEqual(run(ctx, 'ST.bootcamp'), false);
  assert.ok(html.includes('6과 문법'));
  assert.ok(html.includes('오늘의 미션'));
  assert.deepStrictEqual(JSON.parse(run(ctx, 'JSON.stringify(myLib().map(v => v.yt_id))')), ['YT2']);
});
