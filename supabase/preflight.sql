-- Read-only preflight. Run before applying any CMS migration.
select table_schema, table_name
from information_schema.tables
where table_schema in ('public', 'storage')
  and table_type = 'BASE TABLE'
order by table_schema, table_name;

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'admin_profiles','site_settings','homepage_sections','products','services',
    'destinations','portfolio_projects','portfolio_images','media_assets','seo_metadata'
  )
order by table_name, ordinal_position;

select tc.table_name, tc.constraint_name, tc.constraint_type,
       kcu.column_name, ccu.table_name as referenced_table, ccu.column_name as referenced_column
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_schema = kcu.constraint_schema and tc.constraint_name = kcu.constraint_name
left join information_schema.constraint_column_usage ccu
  on tc.constraint_schema = ccu.constraint_schema and tc.constraint_name = ccu.constraint_name
where tc.constraint_schema = 'public'
  and tc.table_name in (
    'admin_profiles','site_settings','homepage_sections','products','services',
    'destinations','portfolio_projects','portfolio_images','media_assets','seo_metadata'
  )
order by tc.table_name, tc.constraint_name, kcu.ordinal_position;

select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'admin_profiles','site_settings','homepage_sections','products','services',
    'destinations','portfolio_projects','portfolio_images','media_assets','seo_metadata'
  )
order by tablename, indexname;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'admin_profiles','site_settings','homepage_sections','products','services',
    'destinations','portfolio_projects','portfolio_images','media_assets','seo_metadata'
  )
order by tablename;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public','storage')
  and (tablename in (
    'admin_profiles','site_settings','homepage_sections','products','services',
    'destinations','portfolio_projects','portfolio_images','media_assets','seo_metadata'
  ) or (schemaname = 'storage' and tablename = 'objects'))
order by schemaname, tablename, policyname;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('ect-media','brand','homepage','products','services','destinations','portfolio')
order by id;

select bucket_id, count(*) as object_count
from storage.objects
where bucket_id in ('ect-media','brand','homepage','products','services','destinations','portfolio')
group by bucket_id
order by bucket_id;
