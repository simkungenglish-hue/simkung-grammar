-- ============================================================
-- 스텔라의 심쿵영어 · 14단계: EGU 교재 · 앞 유닛 복습 · 학습 시간 · 범위 시험 · 오답관리
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run 하세요.
-- 11 → 12 → 13 단계를 먼저 실행한 뒤에 실행해요. 여러 번 실행해도 안전해요.
-- ============================================================

-- ---------- 1. 단어 칸 늘리기 (AI 음성 · 품사 · 문장 빈칸) ----------
alter table public.vocab_books add column if not exists audio_base text not null default '';
alter table public.vocab_items add column if not exists audio_word text not null default '';
alter table public.vocab_items add column if not exists audio_phrase text not null default '';
alter table public.vocab_items add column if not exists audio_example text not null default '';
alter table public.vocab_items add column if not exists forms text not null default '';
alter table public.vocab_items add column if not exists pos_list text[] not null default '{}';
alter table public.vocab_items add column if not exists sent_blank text not null default '';
alter table public.vocab_items add column if not exists sent_answer text not null default '';

-- 새 학습 단계: prev(앞 유닛 복습) · pos(품사 맞추기) · sent(문장 빈칸) · exam(시험)
alter table public.vocab_progress drop constraint if exists vocab_progress_step_check;
alter table public.vocab_progress add constraint vocab_progress_step_check
  check (step in ('look','memorize','check','write','match','test','prev','pos','sent'));
alter table public.vocab_answers drop constraint if exists vocab_answers_step_check;
alter table public.vocab_answers add constraint vocab_answers_step_check
  check (step in ('check','write','test','review','exam','pos','sent'));

-- 단계 완료 기록 (prev · pos · sent 추가. 순서가 있는 앞 4단계만 순서를 확인해요)
create or replace function public.vocab_step_done(
  p_unit uuid, p_step text, p_score int default null, p_total int default null, p_time_sec int default 0, p_best_ms int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if p_step not in ('look','memorize','check','write','match','prev','pos','sent') then raise exception 'bad_step'; end if;
  if not public.vocab_unit_allowed(p_unit) then raise exception 'unit_locked'; end if;
  if p_step in ('memorize','check','write','match') and not exists (select 1 from public.vocab_progress where student_id = me and unit_id = p_unit
       and step = (case p_step when 'memorize' then 'look' when 'check' then 'memorize' when 'write' then 'check' when 'match' then 'write' end)) then
    raise exception 'step_locked';
  end if;
  insert into public.vocab_progress (student_id, unit_id, step, score, total, time_sec, best_ms)
  values (me, p_unit, p_step, p_score, p_total, least(greatest(coalesce(p_time_sec,0),0), 3600),
          case when p_best_ms is null then null else greatest(p_best_ms, 2000) end)
  on conflict (student_id, unit_id, step) do update set
    score = excluded.score, total = excluded.total,
    tries = vocab_progress.tries + 1,
    time_sec = vocab_progress.time_sec + excluded.time_sec,
    best_ms = case when vocab_progress.best_ms is null then excluded.best_ms
                   when excluded.best_ms is null then vocab_progress.best_ms
                   else least(vocab_progress.best_ms, excluded.best_ms) end,
    done_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- 품사 맞추기 · 문장 빈칸 답안 저장 + 채점 (정답은 서버가 판단해요)
create or replace function public.vocab_extra_submit(
  p_client uuid, p_item uuid, p_kind text, p_answer text, p_run uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); it public.vocab_items%rowtype; ok boolean; a text := public.vocab_norm(p_answer); prev public.vocab_answers%rowtype;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if p_kind not in ('pos','sent') then raise exception 'bad_step'; end if;
  select * into prev from public.vocab_answers where client_id = p_client and student_id = me;
  if found then return jsonb_build_object('is_correct', prev.is_correct, 'dup', true); end if;
  select * into it from public.vocab_items where id = p_item;
  if not found or not public.vocab_unit_allowed(it.unit_id) then raise exception 'unit_locked'; end if;
  if a = '' then raise exception 'empty_answer'; end if;
  if p_kind = 'pos' then
    ok := exists (select 1 from unnest(it.pos_list) x where public.vocab_norm(x) = a);
  else
    ok := a = public.vocab_norm(it.sent_answer) or exists (select 1 from unnest(it.alt_answers) x where public.vocab_norm(x) = a);
  end if;
  insert into public.vocab_answers (client_id, student_id, item_id, unit_id, step, dir, run_id, answer, is_correct)
  values (p_client, me, it.id, it.unit_id, p_kind, 'en', p_run, left(p_answer, 300), ok);
  return jsonb_build_object('is_correct', ok);
end $$;

-- ---------- 2. 학습 시간 기록 (학생·날짜·교재별) ----------
create table if not exists public.vocab_time_log (
  student_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  book_id uuid not null default '00000000-0000-0000-0000-000000000000',
  kind text not null default 'unit',        -- unit: 유닛 학습 · review: 복습 · exam: 시험
  sec int not null default 0,
  primary key (student_id, day, book_id, kind)
);
alter table public.vocab_time_log enable row level security;
drop policy if exists p_vtl_sel on public.vocab_time_log;
create policy p_vtl_sel on public.vocab_time_log for select using (student_id = auth.uid() or public.is_teacher());
drop policy if exists p_vtl_del on public.vocab_time_log;
create policy p_vtl_del on public.vocab_time_log for delete using (public.is_teacher());

create or replace function public.vocab_time_add(p_stu uuid, p_book uuid, p_kind text, p_sec int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_sec, 0) <= 0 then return; end if;
  insert into public.vocab_time_log (student_id, day, book_id, kind, sec)
  values (p_stu, public.vocab_kst_today(), coalesce(p_book, '00000000-0000-0000-0000-000000000000'), p_kind, p_sec)
  on conflict (student_id, day, book_id, kind) do update set sec = vocab_time_log.sec + excluded.sec;
end $$;
revoke all on function public.vocab_time_add(uuid, uuid, text, int) from public, anon, authenticated;

create or replace function public.vocab_trg_time_progress() returns trigger language plpgsql security definer set search_path = public as $$
declare d int; bk uuid;
begin
  d := new.time_sec - case when tg_op = 'UPDATE' then old.time_sec else 0 end;
  if d > 0 then
    select book_id into bk from public.vocab_units where id = new.unit_id;
    perform public.vocab_time_add(new.student_id, bk, 'unit', d);
  end if;
  return new;
end $$;
drop trigger if exists vocab_time_progress on public.vocab_progress;
create trigger vocab_time_progress after insert or update of time_sec on public.vocab_progress
  for each row execute function public.vocab_trg_time_progress();

create or replace function public.vocab_trg_time_review() returns trigger language plpgsql security definer set search_path = public as $$
declare d int;
begin
  d := new.time_sec - case when tg_op = 'UPDATE' then old.time_sec else 0 end;
  if d > 0 then perform public.vocab_time_add(new.student_id, null, 'review', d); end if;
  return new;
end $$;
drop trigger if exists vocab_time_review on public.vocab_review_log;
create trigger vocab_time_review after insert or update of time_sec on public.vocab_review_log
  for each row execute function public.vocab_trg_time_review();

-- 원장님: 최근 N일 학습 시간 (학생 · 날짜 · 교재별)
create or replace function public.vocab_time_overview(p_days int default 60)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('student_id', student_id, 'day', day,
           'book_id', nullif(book_id, '00000000-0000-0000-0000-000000000000'), 'kind', kind, 'sec', sec) order by day desc)
     from public.vocab_time_log where day > public.vocab_kst_today() - greatest(p_days, 1)), '[]'::jsonb);
end $$;

-- ---------- 3. 범위 시험 ----------
create table if not exists public.vocab_exams (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.vocab_books(id) on delete set null,
  title text not null,
  range_note text not null default '',                      -- 예: Day 1~5
  item_ids uuid[] not null,                                 -- 출제할 때 뽑은 단어를 그대로 고정해요
  mode text not null default 'mix' check (mode in ('choice_en','choice_ko','spell','mix')),
  pass_pct int not null default 80 check (pass_pct between 1 and 100),
  max_attempts int not null default 1 check (max_attempts between 1 and 20),
  open boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.vocab_exam_students (
  exam_id uuid not null references public.vocab_exams(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  primary key (exam_id, student_id)
);
create table if not exists public.vocab_exam_results (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.vocab_exams(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  run_id uuid not null unique,
  score int not null, total int not null, pct int not null, passed boolean not null,
  time_sec int not null default 0,
  taken_at timestamptz not null default now()
);
create index if not exists vocab_exam_results_idx on public.vocab_exam_results (exam_id, student_id);

alter table public.vocab_exams enable row level security;
alter table public.vocab_exam_students enable row level security;
alter table public.vocab_exam_results enable row level security;
drop policy if exists p_vex_all on public.vocab_exams;
create policy p_vex_all on public.vocab_exams for all using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists p_vexs_all on public.vocab_exam_students;
create policy p_vexs_all on public.vocab_exam_students for all using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists p_vexs_own on public.vocab_exam_students;
create policy p_vexs_own on public.vocab_exam_students for select using (student_id = auth.uid());
drop policy if exists p_vexr_sel on public.vocab_exam_results;
create policy p_vexr_sel on public.vocab_exam_results for select using (student_id = auth.uid() or public.is_teacher());
drop policy if exists p_vexr_del on public.vocab_exam_results;
create policy p_vexr_del on public.vocab_exam_results for delete using (public.is_teacher());

-- 학생: 내게 배정된 시험 목록
create or replace function public.vocab_exam_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_logged_in'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', e.id, 'title', e.title, 'mode', e.mode, 'pass_pct', e.pass_pct, 'max_attempts', e.max_attempts,
      'n', cardinality(e.item_ids), 'note', e.range_note, 'created_at', e.created_at,
      'attempts', (select count(*) from public.vocab_exam_results r where r.exam_id = e.id and r.student_id = me),
      'best_pct', (select max(pct) from public.vocab_exam_results r where r.exam_id = e.id and r.student_id = me),
      'last_pct', (select pct from public.vocab_exam_results r where r.exam_id = e.id and r.student_id = me order by taken_at desc limit 1),
      'passed', coalesce((select bool_or(passed) from public.vocab_exam_results r where r.exam_id = e.id and r.student_id = me), false)
    ) order by e.created_at desc)
    from public.vocab_exams e join public.vocab_exam_students s on s.exam_id = e.id and s.student_id = me
    where e.open), '[]'::jsonb);
end $$;

-- 학생: 시험 문제 받기 (정답은 보내지 않아요 · 보기용 단어는 같은 교재에서 더 보내요)
create or replace function public.vocab_exam_get(p_exam uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ex public.vocab_exams%rowtype; used int; its jsonb; pool jsonb;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  select * into ex from public.vocab_exams where id = p_exam and open;
  if not found or not exists (select 1 from public.vocab_exam_students where exam_id = p_exam and student_id = me) then raise exception 'no_exam'; end if;
  select count(*) into used from public.vocab_exam_results where exam_id = p_exam and student_id = me;
  if used >= ex.max_attempts then raise exception 'no_attempts_left'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'unit_id', i.unit_id, 'word', i.word, 'meaning', i.meaning, 'pos', i.pos,
           'audio_word', i.audio_word)), '[]'::jsonb) into its from public.vocab_items i where i.id = any(ex.item_ids);
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'unit_id', x.unit_id, 'word', x.word, 'meaning', x.meaning)), '[]'::jsonb) into pool from (
    select i.id, i.unit_id, i.word, i.meaning from public.vocab_items i join public.vocab_units u on u.id = i.unit_id
     where u.book_id in (select u2.book_id from public.vocab_items i2 join public.vocab_units u2 on u2.id = i2.unit_id where i2.id = any(ex.item_ids))
       and not (i.id = any(ex.item_ids)) order by random() limit 60) x;
  return jsonb_build_object('exam', jsonb_build_object('id', ex.id, 'title', ex.title, 'mode', ex.mode, 'pass_pct', ex.pass_pct,
           'audio_base', coalesce((select b.audio_base from public.vocab_books b where b.id = ex.book_id), '')),
         'items', its, 'pool', pool, 'attempt', used + 1);
end $$;

-- 학생: 시험 답 한 개 저장 + 채점. 틀린 단어는 내일 복습에 나와요.
create or replace function public.vocab_exam_submit(
  p_client uuid, p_exam uuid, p_run uuid, p_item uuid, p_dir text, p_answer text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ex public.vocab_exams%rowtype; it public.vocab_items%rowtype; ok boolean; a text := public.vocab_norm(p_answer);
  prev public.vocab_answers%rowtype; today date := public.vocab_kst_today(); used int;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if coalesce(p_dir, 'en') not in ('en','ko') then raise exception 'bad_dir'; end if;
  select * into prev from public.vocab_answers where client_id = p_client and student_id = me;
  if found then return jsonb_build_object('is_correct', prev.is_correct, 'dup', true); end if;
  select * into ex from public.vocab_exams where id = p_exam and open;
  if not found or not exists (select 1 from public.vocab_exam_students where exam_id = p_exam and student_id = me) then raise exception 'no_exam'; end if;
  select count(*) into used from public.vocab_exam_results where exam_id = p_exam and student_id = me;
  if used >= ex.max_attempts then raise exception 'no_attempts_left'; end if;
  if p_run is null then raise exception 'bad_run'; end if;
  if not (p_item = any(ex.item_ids)) then raise exception 'bad_item'; end if;
  select * into it from public.vocab_items where id = p_item;
  if not found then raise exception 'bad_item'; end if;
  if a = '' then raise exception 'empty_answer'; end if;
  if coalesce(p_dir, 'en') = 'en' then
    ok := exists (select 1 from public.vocab_items o where o.id = any(ex.item_ids)
                   and (o.id = it.id or public.vocab_norm(o.meaning) = public.vocab_norm(it.meaning))
                   and (public.vocab_norm(o.word) = a or exists (select 1 from unnest(o.alt_answers) x where public.vocab_norm(x) = a)));
  else
    ok := exists (select 1 from public.vocab_items o where o.id = any(ex.item_ids)
                   and (o.id = it.id or public.vocab_norm(o.word) = public.vocab_norm(it.word))
                   and public.vocab_norm(o.meaning) = a);
  end if;
  insert into public.vocab_answers (client_id, student_id, item_id, unit_id, step, dir, run_id, answer, is_correct)
  values (p_client, me, it.id, it.unit_id, 'exam', coalesce(p_dir, 'en'), p_run, left(p_answer, 300), ok);
  if not ok then
    insert into public.vocab_srs (student_id, item_id, box, due_on, correct_n, wrong_n, last_on)
    values (me, it.id, 1, today + 1, 0, 1, today)
    on conflict (student_id, item_id) do update set box = 1, due_on = today + 1, wrong_n = vocab_srs.wrong_n + 1,
      lapses = vocab_srs.lapses + case when vocab_srs.box >= 2 then 1 else 0 end, last_on = today;
  end if;
  return jsonb_build_object('is_correct', ok);
end $$;

-- 학생: 시험 마치기. 점수는 서버에 저장된 답(문제마다 첫 답)으로 다시 계산해요.
create or replace function public.vocab_exam_finish(p_exam uuid, p_run uuid, p_time_sec int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ex public.vocab_exams%rowtype; got int; total int; pctv int; passed boolean; used int; old public.vocab_exam_results%rowtype; sec int;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  select * into ex from public.vocab_exams where id = p_exam;
  if not found or not exists (select 1 from public.vocab_exam_students where exam_id = p_exam and student_id = me) then raise exception 'no_exam'; end if;
  select * into old from public.vocab_exam_results where run_id = p_run and student_id = me;
  if found then return jsonb_build_object('score', old.score, 'total', old.total, 'pct', old.pct, 'passed', old.passed, 'pass_pct', ex.pass_pct, 'dup', true); end if;
  select count(*) into used from public.vocab_exam_results where exam_id = p_exam and student_id = me;
  if used >= ex.max_attempts then raise exception 'no_attempts_left'; end if;
  total := cardinality(ex.item_ids);
  select count(*) filter (where is_correct) into got from (
    select distinct on (item_id) item_id, is_correct from public.vocab_answers
     where run_id = p_run and student_id = me and step = 'exam' and item_id = any(ex.item_ids) order by item_id, submitted_at) x;
  if not exists (select 1 from public.vocab_answers where run_id = p_run and student_id = me and step = 'exam') then raise exception 'no_answers'; end if;
  pctv := case when total > 0 then round(got * 100.0 / total) else 0 end;
  passed := pctv >= ex.pass_pct;
  sec := least(greatest(coalesce(p_time_sec, 0), 0), 7200);
  insert into public.vocab_exam_results (exam_id, student_id, run_id, score, total, pct, passed, time_sec)
  values (p_exam, me, p_run, got, total, pctv, passed, sec);
  perform public.vocab_time_add(me, ex.book_id, 'exam', sec);
  return jsonb_build_object('score', got, 'total', total, 'pct', pctv, 'passed', passed, 'pass_pct', ex.pass_pct);
end $$;

-- 원장님: 한 학생의 시험을 다시 볼 수 있게 (결과를 지워요. 답안 기록은 남아요)
create or replace function public.vocab_exam_reset(p_exam uuid, p_student uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  delete from public.vocab_exam_results where exam_id = p_exam and student_id = p_student;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 4. 오답관리 ----------
-- 원장님: 틀린 단어 목록 (학생 한 명 또는 전체). 해결 = 마지막에 맞혔고 복습 상자가 3 이상.
create or replace function public.vocab_wrong_manage(p_student uuid default null, p_days int default 90)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(w) from (
    select a.student_id, a.item_id, i.word, i.meaning, u.ord as unit_ord, u.book_id,
           count(*) filter (where not a.is_correct) as wrong, count(*) as total,
           max(a.submitted_at) filter (where not a.is_correct) as last_wrong,
           (array_agg(a.is_correct order by a.submitted_at desc))[1] as last_ok,
           s.box
      from public.vocab_answers a
      join public.vocab_items i on i.id = a.item_id
      join public.vocab_units u on u.id = i.unit_id
      left join public.vocab_srs s on s.student_id = a.student_id and s.item_id = a.item_id
     where a.step in ('write','test','review','exam','sent')
       and a.submitted_at > now() - make_interval(days => greatest(p_days, 1))
       and (p_student is null or a.student_id = p_student)
     group by a.student_id, a.item_id, i.word, i.meaning, u.ord, u.book_id, s.box
    having count(*) filter (where not a.is_correct) > 0
     order by count(*) filter (where not a.is_correct) desc, max(a.submitted_at) desc limit 500) w), '[]'::jsonb);
end $$;

-- 원장님: 골라 둔 단어를 오늘 복습에 다시 넣기
create or replace function public.vocab_wrong_requeue(p_student uuid, p_items uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare today date := public.vocab_kst_today(); n int;
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  insert into public.vocab_srs (student_id, item_id, box, due_on, last_on)
  select p_student, i.id, 1, today, today from public.vocab_items i where i.id = any(p_items)
  on conflict (student_id, item_id) do update set box = 1, due_on = today;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'n', n);
end $$;

-- ---------- 5. 권한 ----------
do $$ declare f text; begin
  foreach f in array array[
    'vocab_step_done(uuid,text,int,int,int,int)', 'vocab_extra_submit(uuid,uuid,text,text,uuid)', 'vocab_time_overview(int)',
    'vocab_exam_list()', 'vocab_exam_get(uuid)', 'vocab_exam_submit(uuid,uuid,uuid,uuid,text,text)', 'vocab_exam_finish(uuid,uuid,int)',
    'vocab_exam_reset(uuid,uuid)', 'vocab_wrong_manage(uuid,int)', 'vocab_wrong_requeue(uuid,uuid[])'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
grant select, insert, update, delete on public.vocab_exams, public.vocab_exam_students to authenticated;
grant select, delete on public.vocab_exam_results, public.vocab_time_log to authenticated;
