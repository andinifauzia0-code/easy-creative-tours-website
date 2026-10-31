-- 1. In Supabase Dashboard > Authentication > Users, invite the owner by email.
--    The owner sets their own password from Supabase's secure invite flow.
-- 2. Replace owner@example.com below with that invited account's email, then run
--    this statement in the Supabase SQL Editor. It grants no public registration.
insert into public.admin_profiles (user_id, email, display_name, is_active)
select id, email, 'Easy Creative Tours Admin', true
from auth.users
where lower(email) = lower('owner@example.com')
on conflict (user_id) do update set
  email = excluded.email,
  is_active = true,
  updated_at = now();

-- Verify exactly one active profile was provisioned:
-- select email, is_active from public.admin_profiles;
