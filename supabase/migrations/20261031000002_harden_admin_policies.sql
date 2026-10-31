-- Keep the SECURITY DEFINER membership check outside PostgREST's exposed public schema.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.is_ect_admin()
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
revoke all on function private.is_ect_admin() from public;
grant execute on function private.is_ect_admin() to anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'site_settings', 'homepage_sections', 'products', 'services', 'destinations',
    'portfolio_projects', 'media_assets', 'seo_metadata'
  ] loop
    execute format('drop policy if exists "public reads published %1$s" on public.%1$I', table_name);
    execute format('drop policy if exists "admins manage %1$s" on public.%1$I', table_name);
    execute format('create policy "public reads published %1$s" on public.%1$I for select to anon using (is_published = true)', table_name);
    execute format('create policy "admins manage %1$s" on public.%1$I for all to authenticated using (private.is_ect_admin()) with check (private.is_ect_admin())', table_name);
  end loop;
end;
$$;

drop policy if exists "public reads published portfolio images" on public.portfolio_images;
create policy "public reads published portfolio images" on public.portfolio_images
  for select to anon using (
    is_published = true and exists (
      select 1 from public.portfolio_projects p
      where p.id = portfolio_images.project_id and p.is_published = true
    )
  );
drop policy if exists "admins manage portfolio images" on public.portfolio_images;
create policy "admins manage portfolio images" on public.portfolio_images
  for all to authenticated using (private.is_ect_admin()) with check (private.is_ect_admin());

drop policy if exists "admins read ECT media objects" on storage.objects;
drop policy if exists "admins upload ECT media" on storage.objects;
drop policy if exists "admins update ECT media" on storage.objects;
drop policy if exists "admins delete ECT media" on storage.objects;
create policy "admins read ECT media objects" on storage.objects
  for select to authenticated using (bucket_id = 'ect-media' and private.is_ect_admin());
create policy "admins upload ECT media" on storage.objects
  for insert to authenticated with check (bucket_id = 'ect-media' and private.is_ect_admin());
create policy "admins update ECT media" on storage.objects
  for update to authenticated using (bucket_id = 'ect-media' and private.is_ect_admin())
  with check (bucket_id = 'ect-media' and private.is_ect_admin());
create policy "admins delete ECT media" on storage.objects
  for delete to authenticated using (bucket_id = 'ect-media' and private.is_ect_admin());

drop policy if exists "admins read ECT category media" on storage.objects;
drop policy if exists "admins write ECT category media" on storage.objects;
create policy "admins manage ECT category media" on storage.objects
  for all to authenticated using (
    bucket_id in ('brand','homepage','products','services','destinations','portfolio') and private.is_ect_admin()
  ) with check (
    bucket_id in ('brand','homepage','products','services','destinations','portfolio') and private.is_ect_admin()
  );

drop function if exists public.is_ect_admin();

create index if not exists site_settings_updated_by_idx on public.site_settings(updated_by) where updated_by is not null;
create index if not exists homepage_sections_updated_by_idx on public.homepage_sections(updated_by) where updated_by is not null;
create index if not exists products_updated_by_idx on public.products(updated_by) where updated_by is not null;
create index if not exists services_updated_by_idx on public.services(updated_by) where updated_by is not null;
create index if not exists destinations_updated_by_idx on public.destinations(updated_by) where updated_by is not null;
create index if not exists portfolio_projects_updated_by_idx on public.portfolio_projects(updated_by) where updated_by is not null;
create index if not exists portfolio_images_updated_by_idx on public.portfolio_images(updated_by) where updated_by is not null;
create index if not exists portfolio_images_media_asset_idx on public.portfolio_images(media_asset_id) where media_asset_id is not null;
create index if not exists media_assets_created_by_idx on public.media_assets(created_by);
create index if not exists media_assets_updated_by_idx on public.media_assets(updated_by) where updated_by is not null;
create index if not exists seo_metadata_updated_by_idx on public.seo_metadata(updated_by) where updated_by is not null;
