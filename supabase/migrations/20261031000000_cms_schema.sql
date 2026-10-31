create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_published boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.homepage_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique,
  title text not null default '',
  description text not null default '',
  content jsonb not null default '{}'::jsonb,
  image_url text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null default '',
  description text not null default '',
  duration text not null default '',
  destination_names text[] not null default '{}',
  categories text[] not null default '{}',
  price_amount numeric(14,2),
  price_label text not null default 'Harga melalui penawaran',
  image_url text not null default '',
  image_path text not null default '',
  inclusions text[] not null default '{}',
  exclusions text[] not null default '{}',
  is_featured boolean not null default false,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  icon text not null default '',
  description text not null default '',
  image_url text not null default '',
  image_path text not null default '',
  inclusions text[] not null default '{}',
  suitable text not null default '',
  activities text not null default '',
  is_featured boolean not null default false,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.destinations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null default '',
  description text not null default '',
  image_url text not null default '',
  image_path text not null default '',
  activities text not null default '',
  recommended_duration text not null default '',
  gallery_urls text[] not null default '{}',
  is_featured boolean not null default false,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null default '',
  description text not null default '',
  cover_image_url text not null default '',
  cover_image_path text not null default '',
  project_date date,
  date_verified boolean not null default false,
  is_concept boolean not null default true,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.portfolio_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  media_asset_id uuid,
  image_url text not null,
  storage_path text not null default '',
  alt_text text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_bucket text not null default 'ect-media',
  storage_path text not null unique,
  public_url text not null,
  category text not null default 'uncategorized',
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  alt_text text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'portfolio_images_media_asset_fk') then
    alter table public.portfolio_images
      add constraint portfolio_images_media_asset_fk
      foreign key (media_asset_id) references public.media_assets(id) on delete set null;
  end if;
end;
$$;

create table if not exists public.seo_metadata (
  id uuid primary key default gen_random_uuid(),
  page_path text not null unique,
  page_title text not null default '',
  meta_description text not null default '',
  open_graph_image text not null default '',
  canonical_url text not null default '',
  is_published boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists products_published_order_idx on public.products (is_published, sort_order);
create index if not exists services_published_order_idx on public.services (is_published, sort_order);
create index if not exists destinations_published_order_idx on public.destinations (is_published, sort_order);
create index if not exists portfolio_published_order_idx on public.portfolio_projects (is_published, sort_order);
create index if not exists portfolio_images_project_order_idx on public.portfolio_images (project_id, sort_order);
create index if not exists media_assets_category_created_idx on public.media_assets (category, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'admin_profiles', 'site_settings', 'homepage_sections', 'products', 'services',
    'destinations', 'portfolio_projects', 'portfolio_images', 'media_assets', 'seo_metadata'
  ] loop
    execute format('drop trigger if exists touch_updated_at on public.%I', table_name);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name);
  end loop;
end;
$$;

create or replace function public.is_ect_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true
  );
$$;
revoke all on function public.is_ect_admin() from public, anon;
grant execute on function public.is_ect_admin() to authenticated;
grant execute on function public.is_ect_admin() to anon;

alter table public.admin_profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.homepage_sections enable row level security;
alter table public.products enable row level security;
alter table public.services enable row level security;
alter table public.destinations enable row level security;
alter table public.portfolio_projects enable row level security;
alter table public.portfolio_images enable row level security;
alter table public.media_assets enable row level security;
alter table public.seo_metadata enable row level security;

grant select on public.admin_profiles to authenticated;
grant select on public.site_settings, public.homepage_sections, public.products, public.services,
  public.destinations, public.portfolio_projects, public.portfolio_images, public.media_assets,
  public.seo_metadata to anon, authenticated;
grant insert, update, delete on public.site_settings, public.homepage_sections, public.products,
  public.services, public.destinations, public.portfolio_projects, public.portfolio_images,
  public.media_assets, public.seo_metadata to authenticated;

drop policy if exists "admins read own profile" on public.admin_profiles;
create policy "admins read own profile" on public.admin_profiles
  for select to authenticated using ((select auth.uid()) = user_id);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'site_settings', 'homepage_sections', 'products', 'services', 'destinations',
    'portfolio_projects', 'media_assets', 'seo_metadata'
  ] loop
    execute format('drop policy if exists "public reads published %1$s" on public.%1$I', table_name);
    execute format('drop policy if exists "admins manage %1$s" on public.%1$I', table_name);
    execute format('create policy "public reads published %1$s" on public.%1$I for select to anon, authenticated using (is_published = true or public.is_ect_admin())', table_name);
    execute format('create policy "admins manage %1$s" on public.%1$I for all to authenticated using (public.is_ect_admin()) with check (public.is_ect_admin())', table_name);
  end loop;
end;
$$;

drop policy if exists "public reads published portfolio images" on public.portfolio_images;
drop policy if exists "admins manage portfolio images" on public.portfolio_images;
create policy "public reads published portfolio images"
  on public.portfolio_images for select to anon, authenticated
  using (
    is_published = true and exists (
      select 1 from public.portfolio_projects p
      where p.id = portfolio_images.project_id and p.is_published = true
    )
  );
create policy "admins manage portfolio images"
  on public.portfolio_images for all to authenticated
  using (public.is_ect_admin()) with check (public.is_ect_admin());

insert into public.site_settings (key, value, is_published) values
  ('homepage', '{"hero_eyebrow":"Your 360° Travel & Event Management Partner","hero_title":"WE MAKE EVERY JOURNEY & EVENT MEANINGFUL.","hero_description":"Setiap perjalanan punya cerita. Setiap acara punya tujuan. Bersama Easy Creative Tours, kami membantu mewujudkannya melalui perencanaan kreatif, layanan profesional, dan pengalaman yang berkesan.","primary_cta_label":"Jelajahi Layanan","primary_cta_href":"/services","secondary_cta_label":"Konsultasikan Acara","secondary_cta_href":"/contact","hero_image_url":""}'::jsonb, true),
  ('about', '{"description":"Easy Creative Tours membantu perusahaan dan individu merencanakan perjalanan serta acara melalui konsep yang cermat, koordinasi terpadu, dan layanan personal.","vision":"","mission":[],"values":[],"positioning":"Perencanaan yang menyatukan banyak detail."}'::jsonb, true),
  ('contact', '{"whatsapp_number":"6281510309977","email":"easycreativetours@gmail.com","instagram_url":"https://www.instagram.com/easycreativetours/","address":"","social_links":[]}'::jsonb, true)
on conflict (key) do nothing;

insert into public.homepage_sections (section_key, title, description, content, sort_order, is_published) values
  ('experience', 'We Create Experiences.', 'Kami membantu perusahaan, institusi, komunitas, dan keluarga menyederhanakan rencana yang kompleks menjadi perjalanan dan acara yang terasa menyatu—dari gagasan awal hingga hari pelaksanaan.', '{"enabled":true}', 10, true),
  ('services', 'Satu partner untuk setiap rencana.', 'Dukungan perjalanan dan event yang fleksibel, untuk kebutuhan perusahaan maupun perjalanan privat.', '{"featured_slugs":[]}', 20, true),
  ('destinations', 'Tempat baru, cerita yang berarti.', 'Contoh cakupan perjalanan yang dapat menjadi titik awal untuk merancang program Anda.', '{"featured_slugs":[]}', 30, true),
  ('programs', 'Mulai dari kebutuhan, berkembang jadi pengalaman.', 'Katalog awal ini adalah inspirasi yang dapat disesuaikan. Harga, destinasi, kapasitas, dan detail program dibahas melalui penawaran.', '{"featured_slugs":[]}', 40, true)
on conflict (section_key) do nothing;

-- These named buckets hold public website photography only. Keep private documents elsewhere.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select bucket_id, bucket_id, true, 10485760, array['image/jpeg','image/png','image/webp']
from unnest(array['brand','homepage','products','services','destinations','portfolio']) as bucket_id
on conflict (id) do nothing;

-- Retain the legacy bucket without changing its access configuration or existing files.
drop policy if exists "admins upload ECT media" on storage.objects;
drop policy if exists "admins read ECT media objects" on storage.objects;
drop policy if exists "admins update ECT media" on storage.objects;
drop policy if exists "admins delete ECT media" on storage.objects;
create policy "admins read ECT media objects" on storage.objects
  for select to authenticated using (bucket_id = 'ect-media' and public.is_ect_admin());
create policy "admins upload ECT media" on storage.objects
  for insert to authenticated with check (bucket_id = 'ect-media' and public.is_ect_admin());
create policy "admins update ECT media" on storage.objects
  for update to authenticated using (bucket_id = 'ect-media' and public.is_ect_admin())
  with check (bucket_id = 'ect-media' and public.is_ect_admin());
create policy "admins delete ECT media" on storage.objects
  for delete to authenticated using (bucket_id = 'ect-media' and public.is_ect_admin());

drop policy if exists "admins read ECT category media" on storage.objects;
drop policy if exists "admins write ECT category media" on storage.objects;
create policy "admins read ECT category media" on storage.objects
  for select to authenticated using (bucket_id in ('brand','homepage','products','services','destinations','portfolio') and public.is_ect_admin());
create policy "admins write ECT category media" on storage.objects
  for all to authenticated using (bucket_id in ('brand','homepage','products','services','destinations','portfolio') and public.is_ect_admin())
  with check (bucket_id in ('brand','homepage','products','services','destinations','portfolio') and public.is_ect_admin());
