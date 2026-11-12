-- 17단계: 어휘 유닛 통과 / 불규칙동사 오늘 학습 완료 → 카톡 「나와의 채팅」 알림
-- 이미 쓰고 있는 「학습 제출 알림」 주소(archive_notify)와 켜기·끄기 스위치(submit_on)를 그대로 써요. 여러 번 실행해도 안전해요.
-- 시험 DB에는 _submit_notify가 없어서, 없을 때만 아무것도 안 하는 대체 함수를 만들어요.
do $$ begin
  if to_regprocedure('public._submit_notify(text)') is null then
    execute 'create function public._submit_notify(p_msg text) returns text language sql as $f$ select ''no_webhook''::text $f$';
  end if;
end $$;

create or replace function public.vocab_finish_test(p_unit uuid, p_run uuid, p_time_sec int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); total int; got int; pctv int; pass int; bk uuid; passed boolean; first_pass boolean := false;
  st public.vocab_unit_status%rowtype; nm text; bt text; ut text; uo int; mins int;
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
  -- 처음 통과한 순간에만 카톡 「나와의 채팅」으로 알려요 (알림이 실패해도 시험 제출에는 영향 없어요)
  if first_pass then
    begin
      select coalesce(nullif(p.name, ''), '학생') into nm from public.profiles p where p.id = me;
      select b2.title, u.title, u.ord into bt, ut, uo from public.vocab_units u join public.vocab_books b2 on b2.id = u.book_id where u.id = p_unit;
      select round(coalesce(sum(time_sec), 0) / 60.0)::int into mins from public.vocab_progress where student_id = me and unit_id = p_unit;
      perform public._submit_notify('[심쿵어휘] ' || coalesce(nm, '학생') || ' · ' || coalesce(bt, '') || ' · ' || coalesce(nullif(ut, ''), 'Unit ' || coalesce(uo::text, '')) || ' 통과 🎉 테스트 ' || pctv || '% · 학습 ' || greatest(mins, 1) || '분');
    exception when others then null;
    end;
  end if;
  return jsonb_build_object('score', got, 'total', total, 'pct', pctv, 'pass_pct', coalesce(pass, 90), 'passed', passed, 'first_pass', first_pass);
end $$;

-- 불규칙동사: 오늘 새 동사 학습을 처음 끝낸 순간에만 알려요 (하루 한 번)
create or replace function public.iv_day_add(p_new integer, p_rev integer, p_ok integer, p_total integer, p_sec integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); today date := (now() at time zone 'Asia/Seoul')::date; prev_new int; nm text; learned int;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  select new_n into prev_new from public.iv_day where student_id = me and day = today;
  insert into public.iv_day(student_id, day, new_n, rev_n, ok, total, sec)
  values (me, today, greatest(p_new,0), greatest(p_rev,0), greatest(p_ok,0), greatest(p_total,0), least(greatest(p_sec,0), 3600))
  on conflict (student_id, day) do update set
    new_n = iv_day.new_n + excluded.new_n, rev_n = iv_day.rev_n + excluded.rev_n,
    ok = iv_day.ok + excluded.ok, total = iv_day.total + excluded.total, sec = iv_day.sec + excluded.sec;
  if coalesce(prev_new, 0) = 0 and p_new > 0 then
    begin
      select coalesce(nullif(p.name, ''), '학생') into nm from public.profiles p where p.id = me;
      select count(*) into learned from public.iv_progress where student_id = me;
      perform public._submit_notify('[심쿵동사] ' || coalesce(nm, '학생') || ' · 오늘 새 불규칙동사 ' || p_new || '개 학습 완료 🎉' ||
        case when p_total > 0 then ' (정답 ' || p_ok || '/' || p_total || ')' else '' end ||
        ' · 학습 ' || greatest(round(least(greatest(p_sec,0), 3600) / 60.0)::int, 1) || '분 · 지금까지 외운 동사 ' || learned || '개');
    exception when others then null;
    end;
  end if;
  return jsonb_build_object('ok', true);
end $$;
