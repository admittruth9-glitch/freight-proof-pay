create type public.app_role as enum ('admin', 'transporter');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  company_name text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "Read own role" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "Admins read roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Admins read profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id text not null check (char_length(trip_id) between 1 and 60),
  category text not null check (char_length(category) between 1 and 60),
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null,
  paid_to text not null check (char_length(paid_to) between 1 and 120),
  payment_method text not null check (char_length(payment_method) between 1 and 40),
  description text check (description is null or char_length(description) <= 1000),
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
create policy "Transporters read own" on public.expenses for select to authenticated using (user_id = auth.uid());
create policy "Transporters add own" on public.expenses for insert to authenticated with check (user_id = auth.uid() and status = 'Pending' and admin_note is null);
create policy "Transporters delete own pending" on public.expenses for delete to authenticated using (user_id = auth.uid() and status = 'Pending');
create policy "Admins read all" on public.expenses for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins update" on public.expenses for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, company_name, phone)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name'),
    new.raw_user_meta_data->>'company_name', new.raw_user_meta_data->>'phone');
  perform pg_advisory_xact_lock(424242);
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'transporter');
  end if;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();