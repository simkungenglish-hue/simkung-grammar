/* 회귀 테스트: 서버는 한 번에 1000행까지만 주므로, 풀이 기록·배정·정답표는 쪽을 나눠 끝까지 불러와야 해요.
   실행: node --test tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const { createFake } = require('./fake-supabase');
const { loadApp } = require('./load-app');

const iso = i => new Date(Date.UTC(2026, 9, 1, 0, 0, i)).toISOString();
function tables(nAttempts, nAsg = 3, nKeys = 3) {
  const attempts = Array.from({ length: nAttempts }, (_, i) => ({ id: 'a' + String(i).padStart(5, '0'), student_id: 's1', assignment_id: 'g1', question_id: 'q1', attempt_no: 1, round: 1, status: 'graded', is_correct: true, submitted_at: iso(i) }));
  return {
    profiles: [{ id: 's1', role: 'student', name: '김하나' }],
    assignments: Array.from({ length: nAsg }, (_, i) => ({ id: 'g' + String(i).padStart(5, '0'), student_id: 's1', unit_id: 'u1', created_at: iso(i), units: { id: 'u1', status: 'published' } })),
    units: [{ id: 'u1', code: 'U1', status: 'published' }],
    questions: [], concepts: [], attempts,
    question_keys: Array.from({ length: nKeys }, (_, i) => ({ question_id: 'k' + String(i).padStart(5, '0'), answers: ['A'] })),
    teacher_notes: [], book_covers: [], app_settings: []
  };
}
const run = (ctx, code) => vm.runInContext(code, ctx);

test('원장님 화면: 풀이 기록 1500건을 모두 불러온다 (최신순 유지)', async () => {
  const ctx = loadApp();
  ctx.__sb = createFake(tables(1500));
  await run(ctx, 'S.sb = __sb; S.user = { id: "t1" }; loadTeacher()');
  assert.strictEqual(run(ctx, 'T.attempts.length'), 1500);
  assert.strictEqual(run(ctx, 'T.attempts[0].id'), 'a01499', '가장 최근 기록이 맨 앞');
  assert.strictEqual(run(ctx, 'T.attempts[1499].id'), 'a00000');
});

test('원장님 화면: 배정 1200건도 모두 불러온다', async () => {
  const ctx = loadApp();
  ctx.__sb = createFake(tables(0, 1200));
  await run(ctx, 'S.sb = __sb; loadTeacher()');
  assert.strictEqual(run(ctx, 'T.asg.length'), 1200);
});

test('원장님 화면: 정답표(question_keys) 1200건도 모두 불러온다', async () => {
  const ctx = loadApp();
  ctx.__sb = createFake(tables(0, 1, 1200));
  await run(ctx, 'S.sb = __sb; loadKeys()');
  assert.strictEqual(run(ctx, 'Object.keys(T.keys).length'), 1200);
});

test('학생 화면: 풀이 기록 1500건을 모두 불러온다 (가장 최근 기록 포함)', async () => {
  const ctx = loadApp();
  ctx.__sb = createFake(tables(1500));
  await run(ctx, 'S.sb = __sb; S.user = { id: "s1" }; loadStudent()');
  assert.strictEqual(run(ctx, 'ST.allAttempts.length'), 1500);
  assert.strictEqual(run(ctx, 'ST.allAttempts[1499].id'), 'a01499', '학생 화면에서도 가장 최근 풀이가 빠지면 안 돼요');
});

test('1000행 이하일 때는 한 번만 요청한다', async () => {
  const ctx = loadApp();
  const fake = createFake(tables(10));
  ctx.__sb = fake;
  await run(ctx, 'S.sb = __sb; S.user = { id: "s1" }; loadStudent()');
  assert.strictEqual(fake.calls.filter(c => c.table === 'attempts').length, 1);
});

test('원장님 화면: 가벼운 새로고침은 문제·단원·학생을 다시 받지 않고, 처음엔 전부 받는다', async () => {
  const ctx = loadApp();
  const t = tables(5);
  t.questions = [{ id: 'q1', unit_id: 'u1', stage: 'basic', ord: 1 }];
  const fake = createFake(t);
  ctx.__sb = fake;
  await run(ctx, 'S.sb = __sb; S.user = { id: "t1" }; loadTeacher(true)');   // 처음엔 light여도 전부 받아야 해요
  const n = name => fake.calls.filter(c => c.table === name).length;
  assert.strictEqual(n('questions'), 1);
  assert.strictEqual(run(ctx, 'T.questions.length'), 1);
  await run(ctx, 'loadTeacher(true)');
  assert.strictEqual(n('questions'), 1, '가벼운 새로고침은 문제를 다시 받지 않아요');
  assert.strictEqual(n('units'), 1);
  assert.strictEqual(n('profiles'), 1);
  assert.ok(n('attempts') >= 2, '풀이 기록은 새로 받아요');
  assert.strictEqual(run(ctx, 'T.questions.length'), 1, '받아 둔 문제는 그대로 남아요');
  await run(ctx, 'loadTeacher()');
  assert.strictEqual(n('questions'), 2, '그냥 부르면 전부 다시 받아요');
});
