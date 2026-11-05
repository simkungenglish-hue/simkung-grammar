-- ============================================================
-- 스텔라의 심쿵영어 · 11단계: 어휘 학습 (심쿵어휘)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전해요. 문법 기록에는 손대지 않아요.
-- ============================================================

-- ---------- 1. 단어장 · 유닛 · 단어 ----------
create table if not exists public.vocab_books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'level' check (kind in ('level','school')),  -- level: 레벨 어휘(C~J), school: 내신 교과어휘
  level text not null default '',          -- 심쿵 레벨 C~J (레벨 어휘)
  grade_band text not null default '',     -- 예: 초5, 중1
  school_grade text not null default '',   -- 내신 교과어휘: 중1 / 중2 / 중3
  publisher text not null default '',      -- 내신 교과어휘: 출판사(저자) 예: 동아(윤정미)
  note text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now()
);

-- (이미 예전 버전을 실행했다면 칸만 추가돼요)
alter table public.vocab_books add column if not exists kind text not null default 'level';
alter table public.vocab_books add column if not exists school_grade text not null default '';
alter table public.vocab_books add column if not exists publisher text not null default '';

create table if not exists public.vocab_units (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.vocab_books(id) on delete cascade,
  ord int not null,
  title text not null default '',
  unique (book_id, ord)
);

create table if not exists public.vocab_items (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.vocab_units(id) on delete cascade,
  ord int not null,
  word text not null,                      -- 외울 영어 (단어 또는 짧은 표현)
  meaning text not null,                   -- 우리말 뜻
  pos text not null default '',            -- 품사 (n. v. adj. …)
  phrase text not null default '',         -- 2단어 연상 표현 (예: bright star)
  phrase_ko text not null default '',
  example text not null default '',        -- 예문
  example_ko text not null default '',
  alt_answers text[] not null default '{}' -- 함께 인정할 철자 (예: colour)
);
create index if not exists vocab_items_unit_idx on public.vocab_items (unit_id, ord);

-- ---------- 2. 배정 (학생에게 단어장 한 권을 배정, 유닛은 순서대로 열려요) ----------
create table if not exists public.vocab_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.vocab_books(id) on delete cascade,
  start_ord int not null default 1,
  settings jsonb not null default '{"pass_pct":90,"first_letter":false,"units_per_day":1,"review_cap":40,"speak":true}'::jsonb,
  created_at timestamptz not null default now(),
  unique (student_id, book_id)
);

-- 유닛 단계별 완료 기록 (look, memorize, check, write, match, test)
create table if not exists public.vocab_progress (
  student_id uuid not null references public.profiles(id) on delete cascade,
  unit_id uuid not null references public.vocab_units(id) on delete cascade,
  step text not null check (step in ('look','memorize','check','write','match','test')),
  score int, total int,
  tries int not null default 1,
  time_sec int not null default 0,
  best_ms int,                              -- 짝 맞추기 최고 기록
  done_at timestamptz not null default now(),
  primary key (student_id, unit_id, step)
);

-- 유닛 통과 상태
create table if not exists public.vocab_unit_status (
  student_id uuid not null references public.profiles(id) on delete cascade,
  unit_id uuid not null references public.vocab_units(id) on delete cascade,
  best_pct int not null default 0,
  last_pct int not null default 0,
  tests int not null default 0,
  passed_at timestamptz,
  primary key (student_id, unit_id)
);

-- 답안 하나하나 (뜻 고르기·쓰기·테스트·복습)
create table if not exists public.vocab_answers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique,          -- 같은 답이 두 번 저장되지 않게
  student_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.vocab_items(id) on delete cascade,
  unit_id uuid not null references public.vocab_units(id) on delete cascade,
  step text not null check (step in ('check','write','test','review')),
  dir text not null default 'en' check (dir in ('en','ko')),   -- en: 영어로 답, ko: 뜻으로 답
  run_id uuid,                              -- 같은 테스트·복습 묶음
  answer text not null,
  is_correct boolean not null,
  submitted_at timestamptz not null default now()
);
create index if not exists vocab_answers_stu_idx on public.vocab_answers (student_id, submitted_at desc);
create index if not exists vocab_answers_run_idx on public.vocab_answers (run_id);

-- 간격 복습 상자 (1→1일, 2→3일, 3→7일, 4→14일, 5→30일, 6→완전 암기·60일)
create table if not exists public.vocab_srs (
  student_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.vocab_items(id) on delete cascade,
  box int not null default 1 check (box between 1 and 6),
  due_on date not null,
  correct_n int not null default 0,
  wrong_n int not null default 0,
  lapses int not null default 0,
  last_on date,
  primary key (student_id, item_id)
);
create index if not exists vocab_srs_due_idx on public.vocab_srs (student_id, due_on);

-- 하루 복습 기록 (연속 학습일·목표 확인용)
create table if not exists public.vocab_review_log (
  student_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  sessions int not null default 0,
  n int not null default 0,
  correct int not null default 0,
  time_sec int not null default 0,
  primary key (student_id, day)
);

create table if not exists public.vocab_review_runs (
  run_id uuid primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  at timestamptz not null default now()
);

-- ---------- 3. 권한 ----------
alter table public.vocab_books       enable row level security;
alter table public.vocab_units       enable row level security;
alter table public.vocab_items       enable row level security;
alter table public.vocab_assignments enable row level security;
alter table public.vocab_progress    enable row level security;
alter table public.vocab_unit_status enable row level security;
alter table public.vocab_answers     enable row level security;
alter table public.vocab_srs         enable row level security;
alter table public.vocab_review_log  enable row level security;
alter table public.vocab_review_runs enable row level security;

create or replace function public.vocab_book_open(p_book uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vocab_assignments a join public.vocab_books b on b.id = a.book_id
                 where a.book_id = p_book and a.student_id = auth.uid() and b.status = 'published');
$$;
create or replace function public.vocab_unit_open(p_unit uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vocab_units u where u.id = p_unit and public.vocab_book_open(u.book_id));
$$;

drop policy if exists p_vb_sel on public.vocab_books;
create policy p_vb_sel on public.vocab_books for select using (public.is_teacher() or public.vocab_book_open(id));
drop policy if exists p_vb_all on public.vocab_books;
create policy p_vb_all on public.vocab_books for all using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists p_vu_sel on public.vocab_units;
create policy p_vu_sel on public.vocab_units for select using (public.is_teacher() or public.vocab_book_open(book_id));
drop policy if exists p_vu_all on public.vocab_units;
create policy p_vu_all on public.vocab_units for all using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists p_vi_sel on public.vocab_items;
create policy p_vi_sel on public.vocab_items for select using (public.is_teacher() or public.vocab_unit_open(unit_id));
drop policy if exists p_vi_all on public.vocab_items;
create policy p_vi_all on public.vocab_items for all using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists p_va_sel on public.vocab_assignments;
create policy p_va_sel on public.vocab_assignments for select using (student_id = auth.uid() or public.is_teacher());
drop policy if exists p_va_all on public.vocab_assignments;
create policy p_va_all on public.vocab_assignments for all using (public.is_teacher()) with check (public.is_teacher());

-- 학생 기록 표: 학생은 자기 것만 읽고, 쓰기는 아래 함수로만 해요. 원장님은 읽기·지우기(다시 학습)만.
do $$ declare t text; begin
  foreach t in array array['vocab_progress','vocab_unit_status','vocab_answers','vocab_srs','vocab_review_log'] loop
    execute format('drop policy if exists p_%s_sel on public.%I', t, t);
    execute format('create policy p_%s_sel on public.%I for select using (student_id = auth.uid() or public.is_teacher())', t, t);
    execute format('drop policy if exists p_%s_del on public.%I', t, t);
    execute format('create policy p_%s_del on public.%I for delete using (public.is_teacher())', t, t);
  end loop;
end $$;

-- ---------- 4. 채점 · 기록 함수 ----------
create or replace function public.vocab_norm(t text) returns text language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(btrim(lower(translate(coalesce(t,''), '’‘“”' || chr(160) || chr(8203), '''''"" '))), '\s*[.!?]+$', ''), '\s+', ' ', 'g'));
$$;
create or replace function public.vocab_kst_today() returns date language sql stable as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;
create or replace function public.vocab_gap(p_box int) returns int language sql immutable as $$
  select case p_box when 1 then 1 when 2 then 3 when 3 then 7 when 4 then 14 when 5 then 30 else 60 end;
$$;

-- 이 학생이 지금 이 유닛을 공부해도 되는지 (시작 유닛·시험 범위·순서대로 열기)
create or replace function public.vocab_unit_allowed(p_unit uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); u public.vocab_units%rowtype; a public.vocab_assignments%rowtype; bk public.vocab_books%rowtype;
  seq boolean; scope int[]; prev uuid;
begin
  select * into u from public.vocab_units where id = p_unit; if not found then return false; end if;
  select * into bk from public.vocab_books where id = u.book_id;
  if not found or bk.status <> 'published' then return false; end if;
  select * into a from public.vocab_assignments where student_id = me and book_id = u.book_id; if not found then return false; end if;
  if exists (select 1 from public.vocab_unit_status s where s.student_id = me and s.unit_id = p_unit and s.passed_at is not null) then return true; end if;
  if u.ord < coalesce(a.start_ord, 1) then return false; end if;
  select coalesce(array_agg(x::int), '{}') into scope from jsonb_array_elements_text(case when jsonb_typeof(a.settings->'only') = 'array' then a.settings->'only' else '[]'::jsonb end) x;
  if cardinality(scope) > 0 and not (u.ord = any(scope)) then return false; end if;
  seq := coalesce((a.settings->>'sequential')::boolean, bk.kind <> 'school');
  if seq then
    select v.id into prev from public.vocab_units v where v.book_id = u.book_id and v.ord < u.ord and v.ord >= coalesce(a.start_ord, 1)
       and (cardinality(scope) = 0 or v.ord = any(scope)) order by v.ord desc limit 1;
    if prev is not null and not exists (select 1 from public.vocab_unit_status s where s.student_id = me and s.unit_id = prev and s.passed_at is not null) then return false; end if;
  end if;
  return true;
end $$;

-- 답안 하나 저장 + 채점 + 복습 상자 갱신. 정답 여부는 서버가 직접 판단해요.
create or replace function public.vocab_submit(
  p_client uuid, p_item uuid, p_step text, p_dir text, p_answer text, p_run uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  it public.vocab_items%rowtype;
  ok boolean;
  a text := public.vocab_norm(p_answer);
  r public.vocab_srs%rowtype;
  today date := public.vocab_kst_today();
  nb int; nd date;
  prev public.vocab_answers%rowtype;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if p_step not in ('check','write','test','review') then raise exception 'bad_step'; end if;
  if coalesce(p_dir,'en') not in ('en','ko') then raise exception 'bad_dir'; end if;
  select * into prev from public.vocab_answers where client_id = p_client and student_id = me;
  if found then
    select * into r from public.vocab_srs where student_id = me and item_id = prev.item_id;
    return jsonb_build_object('is_correct', prev.is_correct, 'box', r.box, 'due_on', r.due_on, 'dup', true);
  end if;
  select * into it from public.vocab_items where id = p_item;
  if not found or not public.vocab_unit_open(it.unit_id) then raise exception 'no_assignment'; end if;
  if p_step <> 'review' and not public.vocab_unit_allowed(it.unit_id) then raise exception 'unit_locked'; end if;
  if a = '' then raise exception 'empty_answer'; end if;

  -- 같은 유닛에 뜻이 같은 단어(big·large = 큰)가 있으면 어느 쪽을 써도 정답, 철자가 같은 다의어도 마찬가지예요.
  if coalesce(p_dir,'en') = 'en' then
    ok := exists (select 1 from public.vocab_items o where o.unit_id = it.unit_id
                   and (o.id = it.id or public.vocab_norm(o.meaning) = public.vocab_norm(it.meaning))
                   and (public.vocab_norm(o.word) = a or exists (select 1 from unnest(o.alt_answers) x where public.vocab_norm(x) = a)));
  else
    ok := exists (select 1 from public.vocab_items o where o.unit_id = it.unit_id
                   and (o.id = it.id or public.vocab_norm(o.word) = public.vocab_norm(it.word))
                   and public.vocab_norm(o.meaning) = a);
  end if;

  insert into public.vocab_answers (client_id, student_id, item_id, unit_id, step, dir, run_id, answer, is_correct)
  values (p_client, me, it.id, it.unit_id, p_step, coalesce(p_dir,'en'), p_run, left(p_answer, 300), ok);

  if p_step in ('test','review') then
    select * into r from public.vocab_srs where student_id = me and item_id = it.id for update;
    if not found and p_step = 'review' then
      null;   -- 테스트를 보지 않은 단어는 복습 상자를 만들지 않아요
    elsif not found then
      nb := case when ok then 2 else 1 end;
      insert into public.vocab_srs (student_id, item_id, box, due_on, correct_n, wrong_n, last_on)
      values (me, it.id, nb, today + public.vocab_gap(nb), case when ok then 1 else 0 end, case when ok then 0 else 1 end, today)
      returning * into r;
    elsif p_step = 'review' and r.due_on > today then
      null;   -- 아직 복습할 날이 아닌 단어는 상자를 올리지 않아요
    elsif r.last_on = today then
      -- 같은 날 다시 묻는 것은 상자를 올리지 않아요. 단, 오늘 테스트에서 틀리면 내일 다시 나와요.
      if not ok and p_step = 'test' then
        update public.vocab_srs set box = 1, due_on = today + 1 where student_id = me and item_id = it.id returning * into r;
      end if;
    else
      if ok then
        nb := case when p_step = 'review' then least(r.box + 1, 6) else greatest(r.box, 2) end;
        nd := case when p_step = 'review' or r.box < 2 then today + public.vocab_gap(nb) else r.due_on end;
        update public.vocab_srs set box = nb, due_on = nd, correct_n = correct_n + 1, last_on = today
          where student_id = me and item_id = it.id returning * into r;
      else
        update public.vocab_srs set box = 1, due_on = today + 1, wrong_n = wrong_n + 1,
          lapses = lapses + case when r.box >= 2 then 1 else 0 end, last_on = today
          where student_id = me and item_id = it.id returning * into r;
      end if;
    end if;
  end if;
  return jsonb_build_object('is_correct', ok, 'box', r.box, 'due_on', r.due_on);
end $$;

-- 단계 완료 기록 (테스트 제외)
create or replace function public.vocab_step_done(
  p_unit uuid, p_step text, p_score int default null, p_total int default null, p_time_sec int default 0, p_best_ms int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if p_step not in ('look','memorize','check','write','match') then raise exception 'bad_step'; end if;
  if not public.vocab_unit_allowed(p_unit) then raise exception 'unit_locked'; end if;
  -- 앞 단계를 마쳐야 다음 단계를 기록해요
  if p_step <> 'look' and not exists (select 1 from public.vocab_progress where student_id = me and unit_id = p_unit
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

-- 유닛 테스트 마치기: 점수는 서버에 저장된 답으로 다시 계산해요 (단어마다 첫 답만 인정).
create or replace function public.vocab_finish_test(p_unit uuid, p_run uuid, p_time_sec int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); total int; got int; pctv int; pass int; bk uuid; passed boolean; first_pass boolean := false;
  st public.vocab_unit_status%rowtype;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if not public.vocab_unit_allowed(p_unit) then raise exception 'unit_locked'; end if;
  if not exists (select 1 from public.vocab_progress where student_id = me and unit_id = p_unit and step in ('match','test')) then raise exception 'step_locked'; end if;
  select count(*) into total from public.vocab_items where unit_id = p_unit;
  select count(*) filter (where is_correct) into got from (
    select distinct on (item_id) item_id, is_correct from public.vocab_answers
     where run_id = p_run and student_id = me and unit_id = p_unit and step = 'test'
     order by item_id, submitted_at) x;
  pctv := case when total > 0 then round(got * 100.0 / total) else 0 end;
  select book_id into bk from public.vocab_units where id = p_unit;
  select coalesce((settings->>'pass_pct')::int, 90) into pass from public.vocab_assignments where student_id = me and book_id = bk;
  passed := pctv >= coalesce(pass, 90);
  select * into st from public.vocab_unit_status where student_id = me and unit_id = p_unit;
  first_pass := passed and (not found or st.passed_at is null);
  insert into public.vocab_unit_status (student_id, unit_id, best_pct, last_pct, tests, passed_at)
  values (me, p_unit, pctv, pctv, 1, case when passed then now() end)
  on conflict (student_id, unit_id) do update set
    best_pct = greatest(vocab_unit_status.best_pct, excluded.best_pct), last_pct = excluded.last_pct,
    tests = vocab_unit_status.tests + 1, passed_at = coalesce(vocab_unit_status.passed_at, excluded.passed_at);
  insert into public.vocab_progress (student_id, unit_id, step, score, total, time_sec)
  values (me, p_unit, 'test', got, total, least(greatest(coalesce(p_time_sec,0),0), 3600))
  on conflict (student_id, unit_id, step) do update set
    score = greatest(vocab_progress.score, excluded.score), total = excluded.total, tries = vocab_progress.tries + 1,
    time_sec = vocab_progress.time_sec + excluded.time_sec, done_at = now();
  return jsonb_build_object('score', got, 'total', total, 'pct', pctv, 'pass_pct', coalesce(pass, 90), 'passed', passed, 'first_pass', first_pass);
end $$;

-- 오늘의 복습 한 묶음 마치기
drop function if exists public.vocab_review_done(int, int, int);
create or replace function public.vocab_review_done(p_run uuid, p_time_sec int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d date := public.vocab_kst_today(); nn int; ok int;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  -- 이 복습 묶음에서 실제로 저장된 답(단어마다 첫 답)으로 세요
  select count(*), count(*) filter (where is_correct) into nn, ok from (
    select distinct on (item_id) item_id, is_correct from public.vocab_answers
     where run_id = p_run and student_id = me and step = 'review' order by item_id, submitted_at) x;
  if nn = 0 then return jsonb_build_object('ok', false, 'n', 0); end if;
  -- 같은 묶음을 두 번 기록하지 않아요
  insert into public.vocab_review_runs (run_id, student_id) values (p_run, me) on conflict do nothing;
  if not found then return jsonb_build_object('ok', false, 'dup', true); end if;
  insert into public.vocab_review_log (student_id, day, sessions, n, correct, time_sec)
  values (me, d, 1, nn, ok, least(greatest(coalesce(p_time_sec,0),0), 3600))
  on conflict (student_id, day) do update set sessions = vocab_review_log.sessions + 1,
    n = vocab_review_log.n + excluded.n, correct = vocab_review_log.correct + excluded.correct,
    time_sec = vocab_review_log.time_sec + excluded.time_sec;
  return jsonb_build_object('ok', true, 'n', nn, 'correct', ok);
end $$;

-- 원장님: 한 유닛을 처음부터 다시 학습시키기 (답안 기록은 남겨요)
create or replace function public.vocab_reset_unit(p_student uuid, p_unit uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  delete from public.vocab_progress where student_id = p_student and unit_id = p_unit;
  delete from public.vocab_unit_status where student_id = p_student and unit_id = p_unit;
  return jsonb_build_object('ok', true);
end $$;

-- 원장님: 학생별 요약 + 자주 틀리는 단어 (한 번에 계산해서 화면이 빨라요)
create or replace function public.vocab_teacher_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare today date := public.vocab_kst_today(); res jsonb;
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'today', today,
    'students', coalesce((select jsonb_agg(x) from (
      select p.id as student_id,
        (select count(*) from vocab_srs s where s.student_id = p.id and s.due_on <= today) as due,
        (select count(*) from vocab_srs s where s.student_id = p.id and s.box >= 2) as learned,
        (select count(*) from vocab_srs s where s.student_id = p.id and s.box >= 6) as mastered,
        (select count(*) from vocab_answers a where a.student_id = p.id and (a.submitted_at at time zone 'Asia/Seoul')::date = today) as today_n,
        (select count(*) filter (where is_correct) from vocab_answers a where a.student_id = p.id and (a.submitted_at at time zone 'Asia/Seoul')::date = today) as today_ok,
        (select count(*) from vocab_answers a where a.student_id = p.id and a.submitted_at > now() - interval '7 days') as week_n,
        (select count(*) filter (where is_correct) from vocab_answers a where a.student_id = p.id and a.submitted_at > now() - interval '7 days') as week_ok,
        (select max(submitted_at) from vocab_answers a where a.student_id = p.id) as last_at,
        (select count(*) from vocab_unit_status u where u.student_id = p.id and u.passed_at is not null) as units_passed,
        (select count(distinct (a.submitted_at at time zone 'Asia/Seoul')::date) from vocab_answers a where a.student_id = p.id and a.submitted_at > now() - interval '7 days') as days7,
        (select coalesce(sum(time_sec),0) from vocab_progress g where g.student_id = p.id and g.done_at > now() - interval '7 days')
          + (select coalesce(sum(time_sec),0) from vocab_review_log r where r.student_id = p.id and r.day > today - 7) as sec7
      from profiles p where p.role = 'student' order by p.name) x), '[]'::jsonb),
    'weak', coalesce((select jsonb_agg(w) from (
      select i.id as item_id, i.word, i.meaning, count(*) as wrong, count(distinct a.student_id) as students
        from vocab_answers a join vocab_items i on i.id = a.item_id
       where not a.is_correct and a.step in ('write','test','review') and a.submitted_at > now() - interval '30 days'
       group by i.id, i.word, i.meaning order by count(*) desc, i.word limit 20) w), '[]'::jsonb)
  ) into res;
  return res;
end $$;

-- 원장님: 학생 한 명의 자주 틀린 단어
create or replace function public.vocab_student_weak(p_student uuid, p_days int default 60)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(w) from (
    select i.id as item_id, i.word, i.meaning, count(*) filter (where not a.is_correct) as wrong, count(*) as total,
           (select box from vocab_srs s where s.student_id = p_student and s.item_id = i.id) as box
      from vocab_answers a join vocab_items i on i.id = a.item_id
     where a.student_id = p_student and a.step in ('write','test','review') and a.submitted_at > now() - make_interval(days => p_days)
     group by i.id, i.word, i.meaning having count(*) filter (where not a.is_correct) > 0
     order by 4 desc, i.word limit 30) w), '[]'::jsonb);
end $$;

do $$ declare f text; begin
  foreach f in array array[
    'vocab_teacher_overview()', 'vocab_student_weak(uuid,int)',
    'vocab_submit(uuid,uuid,text,text,text,uuid)', 'vocab_step_done(uuid,text,int,int,int,int)',
    'vocab_finish_test(uuid,uuid,int)', 'vocab_review_done(uuid,int)', 'vocab_unit_allowed(uuid)', 'vocab_reset_unit(uuid,uuid)',
    'vocab_book_open(uuid)', 'vocab_unit_open(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

grant select, insert, update, delete on public.vocab_books, public.vocab_units, public.vocab_items, public.vocab_assignments to authenticated;
grant select, delete on public.vocab_progress, public.vocab_unit_status, public.vocab_answers, public.vocab_srs, public.vocab_review_log to authenticated;

-- 원장님 화면 실시간 갱신
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.vocab_answers; exception when others then null; end;
    begin alter publication supabase_realtime add table public.vocab_progress; exception when others then null; end;
  end if;
end $$;
