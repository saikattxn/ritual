-- =============================================================================
-- Ritual RLS test suite. Two users (Ash and Ifsia) each create a full set of
-- records; the tests then prove neither can read, change, delete or attach to
-- the other's data, that anonymous visitors see nothing, and that account
-- deletion removes only the caller's data.
-- =============================================================================
\set ON_ERROR_STOP 1
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'A', 'ash@example.com',   '{"display_name":"Ash"}'),
  (:'B', 'ifsia@example.com', '{}');

do $$ begin
  assert (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Ash',
    'profile trigger should use display_name metadata';
  assert (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 'ifsia',
    'profile trigger should fall back to email local-part';
  raise notice 'PASS  sign-up trigger creates profiles';
end $$;

-- Helper run as superuser: switch the simulated JWT subject.
create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
$$;

-- ---------------------------------------------------------------------------
-- Each user creates one of everything
-- ---------------------------------------------------------------------------
create or replace function pg_temp.seed_everything(tag text) returns void language plpgsql as $$
declare
  prod uuid; item uuid; habit uuid; ex uuid; tpl uuid; plan uuid; sess uuid; sx uuid;
begin
  insert into public.care_products (area, category, name, actives) values ('skin','retinoid', tag || ' retinol', '{retinoid}') returning id into prod;
  insert into public.routine_items (area, product_id, slot, days) values ('skin', prod, 'evening', '{1,3,5}') returning id into item;
  insert into public.routine_completions (routine_item_id, on_date) values (item, current_date);
  insert into public.routine_items (area, label, activity, slot, days) values ('hair', tag || ' scalp massage', 'scalp', 'anytime', '{0}');
  insert into public.habits (name) values (tag || ' drink water') returning id into habit;
  insert into public.habit_completions (habit_id, on_date) values (habit, current_date);
  insert into public.fitness_profiles (goal) values ('strength');
  insert into public.exercises (name, muscle_group) values (tag || ' custom move', 'core') returning id into ex;
  insert into public.workout_templates (name) values (tag || ' plan') returning id into tpl;
  insert into public.workout_template_exercises (template_id, exercise_id) values (tpl, ex);
  insert into public.planned_workouts (on_date, title, template_id) values (current_date, tag || ' session', tpl) returning id into plan;
  insert into public.workout_sessions (title, on_date, template_id, planned_workout_id) values (tag || ' session', current_date, tpl, plan) returning id into sess;
  insert into public.workout_session_exercises (session_id, exercise_id, exercise_name) values (sess, ex, tag || ' custom move') returning id into sx;
  insert into public.workout_sets (session_exercise_id, set_number, reps, weight_kg, completed) values (sx, 1, 8, 40, true);
  insert into public.fitness_goals (title, kind, target_value) values (tag || ' goal', 'custom', 10);
  insert into public.body_measurements (measured_on, kind, value) values (current_date, 'weight', 70);
  insert into public.progress_photos (taken_on, storage_path) values (current_date, auth.uid()::text || '/front.jpg');
  insert into storage.objects (bucket_id, name) values ('progress-photos', auth.uid()::text || '/front.jpg');
  update public.profiles set display_name = tag || ' updated' where id = auth.uid();
end $$;

select pg_temp.login(:'A');
set role authenticated;
select pg_temp.seed_everything('A');
reset role;

select pg_temp.login(:'B');
set role authenticated;
select pg_temp.seed_everything('B');
reset role;

do $$ begin raise notice 'PASS  both users can create every kind of record'; end $$;

-- ---------------------------------------------------------------------------
-- B cannot see A's rows (and sees exactly their own)
-- ---------------------------------------------------------------------------
select pg_temp.login(:'B');
set role authenticated;
do $$
declare
  t text; n_other int; n_own int;
  owned text[] := array['care_products','routine_items','routine_completions','habits','habit_completions',
    'fitness_profiles','planned_workouts','workout_sessions','workout_session_exercises','workout_sets',
    'fitness_goals','body_measurements','progress_photos'];
begin
  foreach t in array owned loop
    execute format('select count(*) from public.%I where user_id = %L', t, '11111111-1111-1111-1111-111111111111') into n_other;
    execute format('select count(*) from public.%I', t) into n_own;
    assert n_other = 0, format('%s: B can see %s of A''s rows', t, n_other);
    assert n_own > 0, format('%s: B cannot see their own rows', t);
  end loop;
  assert (select count(*) from public.profiles) = 1, 'B should see only their own profile';
  assert (select count(*) from public.exercises where user_id = '11111111-1111-1111-1111-111111111111') = 0, 'B sees A custom exercise';
  assert (select count(*) from public.exercises where user_id is null) >= 50, 'library exercises should be readable';
  assert (select count(*) from public.workout_templates where user_id = '11111111-1111-1111-1111-111111111111') = 0, 'B sees A template';
  assert (select count(*) from public.workout_templates where user_id is null) = 10, 'starter templates should be readable';
  assert (select count(*) from public.workout_template_exercises where user_id is null) > 40, 'starter template exercises readable';
  assert (select count(*) from public.workout_template_exercises where user_id = '11111111-1111-1111-1111-111111111111') = 0, 'B sees A template rows';
  assert (select count(*) from storage.objects) = 1, 'B should see only their own stored photo';
  raise notice 'PASS  user B sees none of user A''s data (13 private tables + exercises, templates, storage)';
end $$;

-- ---------------------------------------------------------------------------
-- B cannot change or delete A's rows
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  update public.care_products set name = 'hacked' where user_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count; assert n = 0, 'B updated A product';
  delete from public.workout_sets where user_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count; assert n = 0, 'B deleted A sets';
  delete from public.body_measurements where user_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count; assert n = 0, 'B deleted A measurements';
  update public.profiles set display_name = 'hacked' where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count; assert n = 0, 'B updated A profile';
  update public.exercises set name = 'hacked' where user_id is null;
  get diagnostics n = row_count; assert n = 0, 'B edited the shared library';
  delete from public.workout_templates where user_id is null;
  get diagnostics n = row_count; assert n = 0, 'B deleted starter templates';
  delete from storage.objects where name like '11111111-1111-1111-1111-111111111111/%';
  get diagnostics n = row_count; assert n = 0, 'B deleted A storage object';
  raise notice 'PASS  user B cannot update or delete user A''s data, the library or starters';
end $$;

-- ---------------------------------------------------------------------------
-- B cannot write rows that belong to A or attach to A's parents
-- ---------------------------------------------------------------------------
create or replace function pg_temp.must_fail(label text, stmt text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'PASS  blocked: %  (%)', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL  was allowed: %', label;
end $$;

reset role;
-- Grab A's ids as superuser for the attack statements.
select id as a_prod from public.care_products where user_id = :'A' \gset
select id as a_item from public.routine_items where user_id = :'A' and product_id is not null \gset
select id as a_habit from public.habits where user_id = :'A' \gset
select id as a_ex from public.exercises where user_id = :'A' \gset
select id as a_tpl from public.workout_templates where user_id = :'A' \gset
select id as a_plan from public.planned_workouts where user_id = :'A' \gset
select id as a_sess from public.workout_sessions where user_id = :'A' \gset
select id as a_sx from public.workout_session_exercises where user_id = :'A' \gset
select id as starter_tpl from public.workout_templates where user_id is null limit 1 \gset
select id as b_sess from public.workout_sessions where user_id = :'B' \gset
select id as b_tpl from public.workout_templates where user_id = :'B' \gset
select id as b_prod from public.care_products where user_id = :'B' \gset
select id as lib_ex from public.exercises where user_id is null limit 1 \gset

select pg_temp.login(:'B');
set role authenticated;
select pg_temp.must_fail('insert product owned by A', format($q$insert into public.care_products (user_id, area, category, name) values (%L,'skin','toner','x')$q$, :'A'));
select pg_temp.must_fail('schedule A''s product', format($q$insert into public.routine_items (area, product_id, days) values ('skin', %L, '{1}')$q$, :'a_prod'));
select pg_temp.must_fail('tick A''s routine item', format($q$insert into public.routine_completions (routine_item_id, on_date) values (%L, current_date)$q$, :'a_item'));
select pg_temp.must_fail('tick A''s habit', format($q$insert into public.habit_completions (habit_id, on_date) values (%L, current_date)$q$, :'a_habit'));
select pg_temp.must_fail('add exercise to A''s template', format($q$insert into public.workout_template_exercises (template_id, exercise_id) values (%L, %L)$q$, :'a_tpl', :'lib_ex'));
select pg_temp.must_fail('add exercise to a starter template', format($q$insert into public.workout_template_exercises (template_id, exercise_id) values (%L, %L)$q$, :'starter_tpl', :'lib_ex'));
select pg_temp.must_fail('use A''s custom exercise in own template', format($q$insert into public.workout_template_exercises (template_id, exercise_id) values (%L, %L)$q$, :'b_tpl', :'a_ex'));
select pg_temp.must_fail('plan a workout from A''s template', format($q$insert into public.planned_workouts (on_date, title, template_id) values (current_date, 'x', %L)$q$, :'a_tpl'));
select pg_temp.must_fail('link own session to A''s plan', format($q$insert into public.workout_sessions (title, on_date, planned_workout_id) values ('x', current_date, %L)$q$, :'a_plan'));
select pg_temp.must_fail('add exercise to A''s session', format($q$insert into public.workout_session_exercises (session_id, exercise_name) values (%L, 'x')$q$, :'a_sess'));
select pg_temp.must_fail('log a set in A''s session', format($q$insert into public.workout_sets (session_exercise_id, set_number) values (%L, 9)$q$, :'a_sx'));
select pg_temp.must_fail('use A''s custom exercise in own session', format($q$insert into public.workout_session_exercises (session_id, exercise_id, exercise_name) values (%L, %L, 'x')$q$, :'b_sess', :'a_ex'));
select pg_temp.must_fail('create a shared library exercise', $q$insert into public.exercises (user_id, name, muscle_group) values (null, 'x', 'core')$q$);
select pg_temp.must_fail('create a starter template', $q$insert into public.workout_templates (user_id, name) values (null, 'x')$q$);
select pg_temp.must_fail('hand own product over to A', format($q$update public.care_products set user_id = %L where id = %L$q$, :'A', :'b_prod'));
select pg_temp.must_fail('insert a second profile', format($q$insert into public.profiles (id) values (%L)$q$, :'A'));
select pg_temp.must_fail('photo row pointing into A''s folder', format($q$insert into public.progress_photos (taken_on, storage_path) values (current_date, %L)$q$, :'A' || '/x.jpg'));
select pg_temp.must_fail('upload into A''s storage folder', format($q$insert into storage.objects (bucket_id, name) values ('progress-photos', %L)$q$, :'A' || '/evil.jpg'));
do $$
declare hp uuid;
begin
  insert into public.care_products (area, category, name) values ('hair','shampoo','B shampoo') returning id into hp;
  begin
    insert into public.routine_items (area, product_id, days) values ('skin', hp, '{1}');
    raise exception 'FAIL  hair product was scheduled in a skin routine';
  exception when insufficient_privilege then
    raise notice 'PASS  blocked: hair product scheduled in skin routine';
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Anonymous visitors see nothing and cannot call account deletion
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '', false);
set role anon;
do $$
declare t text;
begin
  foreach t in array array['profiles','care_products','routine_items','habits','exercises','workout_templates',
                           'workout_sessions','workout_sets','body_measurements','progress_photos'] loop
    begin
      execute format('select count(*) from public.%I', t);
      raise exception 'FAIL  anon could query %', t;
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin
    perform public.delete_my_account();
    raise exception 'FAIL  anon could call delete_my_account';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS  anonymous role has no access to any table or to account deletion';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Constraint sanity
-- ---------------------------------------------------------------------------
select pg_temp.login(:'B');
set role authenticated;
select pg_temp.must_fail('empty weekday list', $q$insert into public.habits (name, days) values ('x', '{}')$q$);
select pg_temp.must_fail('weekday out of range', $q$insert into public.habits (name, days) values ('x', '{7}')$q$);
select pg_temp.must_fail('hair category on skin product', $q$insert into public.care_products (area, category, name) values ('skin','shampoo','x')$q$);
select pg_temp.must_fail('negative weight', $q$insert into public.body_measurements (measured_on, kind, value) values (current_date, 'weight', -5)$q$);
select pg_temp.must_fail('completed session without end time', $q$insert into public.workout_sessions (title, on_date, status) values ('x', current_date, 'completed')$q$);
select pg_temp.must_fail('non-https demo link', $q$insert into public.exercises (name, muscle_group, demo_url) values ('x','core','javascript:alert(1)')$q$);
reset role;

-- ---------------------------------------------------------------------------
-- Account deletion removes only the caller's data
-- ---------------------------------------------------------------------------
delete from storage.objects where name like :'A' || '/%';   -- the app removes files first
select pg_temp.login(:'A');
set role authenticated;
select public.delete_my_account();
reset role;
do $$
declare t text; n int;
begin
  assert not exists (select 1 from auth.users where id = '11111111-1111-1111-1111-111111111111'), 'A auth user still exists';
  foreach t in array array['profiles','care_products','routine_items','routine_completions','habits','habit_completions',
     'fitness_profiles','exercises','workout_templates','workout_template_exercises','planned_workouts','workout_sessions',
     'workout_session_exercises','workout_sets','fitness_goals','body_measurements','progress_photos'] loop
    execute format('select count(*) from public.%I where %s = %L', t,
                   case when t = 'profiles' then 'id' else 'user_id' end,
                   '11111111-1111-1111-1111-111111111111') into n;
    assert n = 0, format('%s still has %s rows for deleted user A', t, n);
  end loop;
  assert (select count(*) from public.care_products where user_id = '22222222-2222-2222-2222-222222222222') = 2, 'B lost data';
  assert (select count(*) from public.exercises where user_id is null) >= 50, 'library was affected';
  raise notice 'PASS  delete_my_account removes every row for that user and nothing else';
end $$;

\echo
\echo ALL RLS TESTS PASSED
