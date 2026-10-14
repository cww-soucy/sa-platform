-- sa-admin › Sondages clients : liste complète (actifs et fermés) et création / modification.
-- Même clé que sondage_stats. Additif : aucune donnée existante n'est modifiée.

create or replace function public.sondages_liste(p_cle text)
returns table(slug text, titre text, client text, actif boolean, created_at timestamptz, reponses bigint)
language plpgsql security definer set search_path to 'public' as $$
begin
  if p_cle is distinct from 'CW-Soucy-9421-Stats' then raise exception 'accès refusé'; end if;
  return query select s.slug, s.titre, s.client, s.actif, s.created_at,
    (select count(*) from public.sondage_reponses r where r.sondage_slug = s.slug)
    from public.sondages s order by s.created_at desc;
end; $$;

create or replace function public.sondage_enregistrer(p_cle text, p_slug text, p_titre text, p_client text, p_actif boolean)
returns public.sondages
language plpgsql security definer set search_path to 'public' as $$
declare r public.sondages;
begin
  if p_cle is distinct from 'CW-Soucy-9421-Stats' then raise exception 'accès refusé'; end if;
  if coalesce(trim(p_slug), '') = '' or coalesce(trim(p_titre), '') = '' then raise exception 'titre requis'; end if;
  insert into public.sondages(slug, titre, client, actif)
    values (trim(p_slug), trim(p_titre), nullif(trim(coalesce(p_client, '')), ''), coalesce(p_actif, true))
  on conflict (slug) do update set titre = excluded.titre, client = excluded.client, actif = excluded.actif
  returning * into r;
  return r;
end; $$;

grant execute on function public.sondages_liste(text) to anon, authenticated;
grant execute on function public.sondage_enregistrer(text, text, text, text, boolean) to anon, authenticated;
