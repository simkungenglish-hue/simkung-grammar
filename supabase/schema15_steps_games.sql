-- ============================================================
-- 스텔라의 심쿵영어 · 15단계: 학생별 학습 단계 고르기 + 유닛 테스트 통과하면 게임 열기
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run 하세요. 11 → 13 → 14 단계 뒤에 실행해요. 여러 번 실행해도 안전해요.
-- ============================================================

-- 1) 원장님이 단계를 골라 주므로 앞 단계를 건너뛸 수 있어요. 순서는 앱 화면이 지켜요.
create or replace function public.vocab_step_done(
  p_unit uuid, p_step text, p_score int default null, p_total int default null, p_time_sec int default 0, p_best_ms int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if p_step not in ('look','memorize','check','write','match','prev','pos','sent') then raise exception 'bad_step'; end if;
  if not public.vocab_unit_allowed(p_unit) then raise exception 'unit_locked'; end if;
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

-- 2) 유닛 테스트: 앞 단계를 고르지 않은 학생도 바로 볼 수 있어요 (유닛이 열려 있으면 돼요).
create or replace function public.vocab_finish_test(p_unit uuid, p_run uuid, p_time_sec int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); total int; got int; pctv int; pass int; bk uuid; passed boolean; first_pass boolean := false;
  st public.vocab_unit_status%rowtype;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if not public.vocab_unit_allowed(p_unit) then raise exception 'unit_locked'; end if;
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

-- 3) 게임: 오늘 복습을 끝냈거나(또는 30개 이상 복습) 오늘 유닛 테스트를 통과했으면 열려요.
create or replace function public.vocab_games_open(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vocab_srs where student_id = p_student)
     and (public.vocab_due_count(p_student) = 0
          or coalesce((select n from public.vocab_review_log where student_id = p_student and day = public.vocab_kst_today()), 0) >= 30
          or exists (select 1 from public.vocab_unit_status where student_id = p_student and passed_at is not null
                      and (passed_at at time zone 'Asia/Seoul')::date = public.vocab_kst_today()));
$$;
revoke all on function public.vocab_games_open(uuid) from public, anon, authenticated;
revoke all on function public.vocab_step_done(uuid,text,int,int,int,int) from public, anon;
grant execute on function public.vocab_step_done(uuid,text,int,int,int,int) to authenticated;
revoke all on function public.vocab_finish_test(uuid,uuid,int) from public, anon;
grant execute on function public.vocab_finish_test(uuid,uuid,int) to authenticated;
