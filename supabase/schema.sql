-- =====================================================================
-- Kid School System ERP - database schema (Supabase / Postgres)
-- Run this whole file once in Supabase: SQL Editor > New query > Run.
-- All money values are whole Pakistani Rupees (integers).
-- =====================================================================

-- ---------- Settings (single row) -----------------------------------
create table if not exists settings (
  id              int primary key default 1 check (id = 1),
  school_name     text not null default 'Kid School System',
  due_day         int  not null default 10 check (due_day between 1 and 28),
  fine_per_day    int  not null default 200 check (fine_per_day >= 0),
  max_fine        int  not null default 2000 check (max_fine >= 0),
  voucher_notice  text not null default 'This is a computer generated fee voucher. No manual corrections will be accepted.',
  updated_at      timestamptz not null default now()
);
insert into settings (id) values (1) on conflict do nothing;

-- ---------- Campuses -------------------------------------------------
create table if not exists campuses (
  id       serial primary key,
  name     text not null unique,
  address  text not null default '',
  phone    text not null default ''
);
insert into campuses (name) values
  ('Kid School System Boys Branch'),
  ('Kid School System Girls Branch')
on conflict do nothing;

-- ---------- Classes (monthly fee is per class, same for both campuses)
create table if not exists classes (
  id          serial primary key,
  name        text not null unique,
  sort_order  int  not null default 0,
  monthly_fee int  not null default 0 check (monthly_fee >= 0)
);
insert into classes (name, sort_order) values
  ('Playgroup',1),('Nursery',2),('Prep',3),
  ('Class 1',4),('Class 2',5),('Class 3',6),('Class 4',7),('Class 5',8),
  ('Class 6',9),('Class 7',10),('Class 8',11),('Class 9',12),('Class 10',13),
  ('First Year (11th)',14),('Second Year (12th)',15)
on conflict do nothing;

-- ---------- Staff profiles (one per login) ---------------------------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text not null default '',
  role       text not null default 'pending'
             check (role in ('owner','principal','accountant','pending')),
  created_at timestamptz not null default now()
);

-- New logins start as 'pending' (no access) until the owner assigns a role.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create or replace function my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()), 'none')
$$;

create or replace function is_staff() returns boolean
language sql stable as $$ select my_role() in ('owner','principal','accountant') $$;

-- ---------- Students -------------------------------------------------
create table if not exists students (
  id                   bigserial primary key,
  admission_no         text not null unique,
  name                 text not null,
  father_name          text not null default '',
  phone                text not null default '',
  cnic                 text not null default '',
  campus_id            int  not null references campuses(id),
  class_id             int  not null references classes(id),
  family_code          text,              -- reserved for family challans later
  monthly_fee_override int  check (monthly_fee_override >= 0), -- null = class fee
  status               text not null default 'active' check (status in ('active','left')),
  notes                text not null default '',
  created_at           timestamptz not null default now()
);
create index if not exists students_campus_idx on students(campus_id);
create index if not exists students_class_idx  on students(class_id);

-- ---------- Payments (receipts) --------------------------------------
create table if not exists payments (
  id           bigserial primary key,
  student_id   bigint not null references students(id),
  paid_on      date   not null default current_date,
  fees_total   int    not null,
  fine_total   int    not null,
  total        int    not null,
  collected_by uuid   references profiles(id),
  voided       boolean not null default false,
  void_reason  text,
  created_at   timestamptz not null default now()
);
create index if not exists payments_paid_on_idx on payments(paid_on);
create index if not exists payments_student_idx on payments(student_id);

-- ---------- Dues: one row per student, per month, per fee head -------
-- Unpaid dues roll forward automatically: every new challan includes all
-- unpaid dues as "Previous dues", and each keeps accruing its own late fine.
create table if not exists dues (
  id           bigserial primary key,
  student_id   bigint not null references students(id),
  month        date   not null check (extract(day from month) = 1),
  head         text   not null default 'tuition', -- more fee heads can be added later
  description  text   not null,
  amount       int    not null check (amount >= 0),
  due_date     date   not null,
  fine_waived  int    not null default 0 check (fine_waived >= 0),
  payment_id   bigint references payments(id),
  fine_charged int,                       -- fine actually collected (set on payment)
  created_at   timestamptz not null default now(),
  unique (student_id, month, head)
);
create index if not exists dues_unpaid_idx on dues(student_id) where payment_id is null;

-- ---------- Challans (printed vouchers, a frozen snapshot) -----------
create table if not exists challans (
  id          bigserial primary key,
  challan_no  text   not null unique,
  student_id  bigint not null references students(id),
  month       date   not null,
  issue_date  date   not null default current_date,
  due_date    date   not null,
  created_at  timestamptz not null default now(),
  unique (student_id, month)
);
create table if not exists challan_lines (
  id          bigserial primary key,
  challan_id  bigint not null references challans(id) on delete cascade,
  sort        int    not null,
  description text   not null,
  amount      int    not null
);

-- ---------- Fine waivers log ------------------------------------------
create table if not exists fine_waivers (
  id         bigserial primary key,
  due_id     bigint not null references dues(id),
  amount     int    not null,
  reason     text   not null default '',
  waived_by  uuid   references profiles(id),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Fee logic (the single source of truth for money calculations)
-- =====================================================================

-- Late fine for one due as of a date: fine_per_day for each day after the
-- due date, capped at max_fine, minus anything the owner waived.
create or replace function calc_fine(p_due_date date, p_as_of date, p_waived int)
returns int language sql stable as $$
  select greatest(0,
           least(s.max_fine, s.fine_per_day * greatest(0, p_as_of - p_due_date))
           - coalesce(p_waived, 0))
  from settings s where s.id = 1
$$;

-- All unpaid dues of a student with the fine as of a date.
create or replace function student_outstanding(p_student_id bigint, p_as_of date default current_date)
returns table (due_id bigint, month date, description text, amount int,
               due_date date, fine int, fine_waived int)
language sql stable security definer set search_path = public as $$
  select d.id, d.month, d.description, d.amount, d.due_date,
         calc_fine(d.due_date, p_as_of, d.fine_waived), d.fine_waived
  from dues d
  where d.student_id = p_student_id and d.payment_id is null and is_staff()
  order by d.month, d.head
$$;

-- Create the month's tuition due and challan for every active student
-- (optionally one campus). Students that already have a challan for that
-- month are skipped, so running it twice is safe.
create or replace function generate_challans(p_month date, p_campus_id int default null,
                                             p_due_date date default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_due   date;
  v_count int := 0;
  st      record;
  v_cid   bigint;
  r       record;
  v_sort  int;
  v_fine  int;
begin
  if not is_staff() then raise exception 'Not allowed'; end if;
  select coalesce(p_due_date, v_month + (s.due_day - 1)) into v_due from settings s where id = 1;

  for st in
    select s.id, coalesce(s.monthly_fee_override, c.monthly_fee) as fee
    from students s join classes c on c.id = s.class_id
    where s.status = 'active' and (p_campus_id is null or s.campus_id = p_campus_id)
      and not exists (select 1 from challans ch where ch.student_id = s.id and ch.month = v_month)
    order by s.id
  loop
    insert into dues (student_id, month, head, description, amount, due_date)
    values (st.id, v_month, 'tuition',
            'Monthly Fee - ' || to_char(v_month, 'Mon YYYY'), st.fee, v_due)
    on conflict (student_id, month, head) do nothing;

    insert into challans (challan_no, student_id, month, due_date)
    values (to_char(v_month, 'YYMM') || '-' || lpad(st.id::text, 5, '0'), st.id, v_month, v_due)
    returning id into v_cid;

    v_sort := 0; v_fine := 0;
    for r in select * from dues d where d.student_id = st.id and d.payment_id is null
             and d.month <= v_month order by d.month, d.head loop
      v_sort := v_sort + 1;
      insert into challan_lines (challan_id, sort, description, amount)
      values (v_cid, v_sort,
              case when r.month < v_month then 'Previous dues - ' || to_char(r.month, 'Mon YYYY')
                   else r.description end,
              r.amount);
      if r.month < v_month then
        v_fine := v_fine + calc_fine(r.due_date, v_due, r.fine_waived);
      end if;
    end loop;
    if v_fine > 0 then
      insert into challan_lines (challan_id, sort, description, amount)
      values (v_cid, v_sort + 1, 'Late fine on previous dues', v_fine);
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Collect the full outstanding amount of a student (no partial payments).
-- Only owner/principal may enter a date other than today.
create or replace function collect_payment(p_student_id bigint, p_paid_on date default current_date)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_fees int; v_fine int; v_pid bigint;
begin
  if not is_staff() then raise exception 'Not allowed'; end if;
  if p_paid_on <> current_date and my_role() not in ('owner','principal') then
    raise exception 'Only the owner or principal can record a payment for another date';
  end if;
  perform 1 from dues where student_id = p_student_id and payment_id is null for update;
  select coalesce(sum(amount),0), coalesce(sum(calc_fine(due_date, p_paid_on, fine_waived)),0)
    into v_fees, v_fine
  from dues where student_id = p_student_id and payment_id is null;
  if v_fees + v_fine = 0 then raise exception 'Nothing outstanding for this student'; end if;

  insert into payments (student_id, paid_on, fees_total, fine_total, total, collected_by)
  values (p_student_id, p_paid_on, v_fees, v_fine, v_fees + v_fine, auth.uid())
  returning id into v_pid;

  update dues set payment_id = v_pid, fine_charged = calc_fine(due_date, p_paid_on, fine_waived)
  where student_id = p_student_id and payment_id is null;
  return v_pid;
end $$;

-- Owner only: cancel a wrong payment; its dues become unpaid again.
create or replace function void_payment(p_payment_id bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_role() <> 'owner' then raise exception 'Only the owner can void a payment'; end if;
  update payments set voided = true, void_reason = p_reason
  where id = p_payment_id and not voided;
  if not found then raise exception 'Payment not found or already voided'; end if;
  update dues set payment_id = null, fine_charged = null where payment_id = p_payment_id;
end $$;

-- Owner only: waive (part of) the late fine on an unpaid due.
create or replace function waive_fine(p_due_id bigint, p_amount int, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_role() <> 'owner' then raise exception 'Only the owner can waive fines'; end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  update dues set fine_waived = fine_waived + p_amount
  where id = p_due_id and payment_id is null;
  if not found then raise exception 'Due not found or already paid'; end if;
  insert into fine_waivers (due_id, amount, reason, waived_by)
  values (p_due_id, p_amount, p_reason, auth.uid());
end $$;

-- Defaulters: active students with unpaid dues past their due date.
create or replace function defaulters(p_campus_id int default null, p_as_of date default current_date)
returns table (student_id bigint, admission_no text, name text, father_name text, phone text,
               campus_id int, class_id int, months int, fees int, fine int, total int)
language sql stable security definer set search_path = public as $$
  select s.id, s.admission_no, s.name, s.father_name, s.phone, s.campus_id, s.class_id,
         count(*)::int, sum(d.amount)::int,
         sum(calc_fine(d.due_date, p_as_of, d.fine_waived))::int,
         (sum(d.amount) + sum(calc_fine(d.due_date, p_as_of, d.fine_waived)))::int
  from dues d join students s on s.id = d.student_id
  where d.payment_id is null and d.due_date < p_as_of and is_staff()
    and (p_campus_id is null or s.campus_id = p_campus_id)
  group by s.id
  order by s.campus_id, s.class_id, s.name
$$;

-- =====================================================================
-- Row level security
-- =====================================================================
alter table settings      enable row level security;
alter table campuses      enable row level security;
alter table classes       enable row level security;
alter table profiles      enable row level security;
alter table students      enable row level security;
alter table payments      enable row level security;
alter table dues          enable row level security;
alter table challans      enable row level security;
alter table challan_lines enable row level security;
alter table fine_waivers  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','campuses','classes','students','payments','dues',
                           'challans','challan_lines','fine_waivers'] loop
    execute format('drop policy if exists staff_read on %I', t);
    execute format('create policy staff_read on %I for select using (is_staff())', t);
  end loop;
end $$;

-- Students: any staff can add/edit.
drop policy if exists staff_write on students;
create policy staff_write on students for all using (is_staff()) with check (is_staff());
-- Classes & campuses: owner and principal.
drop policy if exists admin_write on classes;
create policy admin_write on classes for all
  using (my_role() in ('owner','principal')) with check (my_role() in ('owner','principal'));
drop policy if exists admin_write on campuses;
create policy admin_write on campuses for all
  using (my_role() in ('owner','principal')) with check (my_role() in ('owner','principal'));
-- Settings: owner only.
drop policy if exists owner_write on settings;
create policy owner_write on settings for update
  using (my_role() = 'owner') with check (my_role() = 'owner');
-- Profiles: staff can see names (for receipts); only the owner edits roles.
drop policy if exists own_read on profiles;
create policy own_read on profiles for select using (id = auth.uid() or is_staff());
drop policy if exists owner_write on profiles;
create policy owner_write on profiles for update
  using (my_role() = 'owner') with check (my_role() = 'owner');
-- Dues, challans and payments are only changed through the functions above.
