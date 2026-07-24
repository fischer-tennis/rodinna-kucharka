-- Spusťte jednou v SQL Editoru pro okamžité aktualizace mezi telefony.
do $$ begin
  alter publication supabase_realtime add table public.recipes;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.recipe_confirmations;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.recipe_images;
exception when duplicate_object then null; end $$;

-- Uživatel může upravit své jméno, ale nesmí si sám změnit roli na admina.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));
