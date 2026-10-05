-- 2026-10-05 — Premier rangement clients / sites / lieux, validé par Charles dans le fil « Clients, sites et lieux à classer ».
-- À lancer UNE fois, après MIGRATION_2026-10-05_clients_sites.sql. Tout passe par site_fusionner / lieu_classer : rien n'est effacé,
-- chaque fusion est tracée dans sites_fusions et l'historique des feuilles de temps garde l'ancienne version.
begin;

insert into public.clients(id, nom, interne) values
  ('cl-ccnq', 'CCNQ', false),
  ('cl-ville-levis', 'Ville de Lévis', false),
  ('cl-ste-anne', 'Ville de Ste-Anne-de-Beaupré', false),
  ('cl-groupe-mach', 'Groupe Mach', false),
  ('cl-dion', 'Dion', false),
  ('cl-soucy', 'Soucy Aquatik', true)
on conflict (id) do nothing;

update public.sites set client_id = 'cl-ccnq' where id in ('mqttfx39nkcn','mqttf71do90m','mqttei25ulhm','mszypvyzq6cs','mt79zzynui1k','mszyr9e6acoe','mtd2jn5uc00a',
  'msxlpxhfmmpz','msqhu9s88s77','mszyoh2mv2pb','mszzz4c6rlop','mtbeitdvw5il','mssu58begd4b');
update public.sites set client_id = 'cl-ville-levis' where id in ('mqqnofkm0404','mtsn4cvr563b','mtms5p2dy0k7','mt1dszb3a1ro','mt044r6htt5o','msyv7b0s2o11');
update public.sites set client_id = 'cl-ste-anne' where id in ('mufl0qan03tj','mul407wrqsdj');
update public.sites set client_id = 'cl-groupe-mach' where id in ('mu2kf3kndmzb','mtu80un30vml','mtu6h12yrq7k');
update public.sites set client_id = 'cl-dion' where id in ('msrfxiqqotx8','mr221m2cx2gz');
update public.sites set client_id = 'cl-soucy' where id in ('msqeo8g472n9','mszzczm7zkdy','msx5nwwoqjxi');

-- CCNQ : doublons « CCNQ », Place des Canotiers, Quai des Flots, Station de la Plage (les Fontainiers deviennent une installation)
select public.site_fusionner('mqttf71do90m', 'mqttfx39nkcn', 'claude');
select public.site_fusionner('mqttei25ulhm', 'mqttfx39nkcn', 'claude');
select public.site_fusionner('mt79zzynui1k', 'mszypvyzq6cs', 'claude', 'Fontainiers');
select public.site_fusionner('msxlpxhfmmpz', 'mszyr9e6acoe', 'claude');
select public.site_fusionner('msqhu9s88s77', 'mszyr9e6acoe', 'claude');
select public.site_fusionner('mtd2jn5uc00a', 'mszyr9e6acoe', 'claude', 'Fontainiers');
select public.site_fusionner('mszzz4c6rlop', 'mszyoh2mv2pb', 'claude');
select public.site_fusionner('mtbeitdvw5il', 'mszyoh2mv2pb', 'claude', 'Fontainiers');
-- Ville de Lévis : Quai Paquet (le « Contrat 2026 » n'est pas un site à part)
select public.site_fusionner('mtsn4cvr563b', 'mqqnofkm0404', 'claude');
select public.site_fusionner('mtms5p2dy0k7', 'mqqnofkm0404', 'claude');
select public.site_fusionner('mt1dszb3a1ro', 'mqqnofkm0404', 'claude', 'Fontainiers');
-- Doublons simples
select public.site_fusionner('msrkiqpwpv5u', 'msrd8b8hv28e', 'claude');   -- Piscine desjardin → Résidence Desjardins
select public.site_fusionner('mt1dowrxbva3', 'mr22b1d4ni1v', 'claude');   -- Complexe L'Aventura → L'Aventura
select public.site_fusionner('mtbe2iu0dtj3', 'mr21xk5tnvjg', 'claude');   -- Résidence Robert Lepage (2 orthographes)
update public.sites set nom = 'Résidence Robert Lepage', updated_at = now() where id = 'mr21xk5tnvjg';
select public.site_fusionner('mszzczm7zkdy', 'msqeo8g472n9', 'claude');   -- Entrepot → Soucy Aquatik - Entrepôt

-- Lieux tapés à la main dont le site ne fait aucun doute ; les autres se classent dans sa-admin › Sites › Lieux à classer
select public.lieu_classer(array['ccnq'], 'mqttfx39nkcn', 'claude');
select public.lieu_classer(array['entrepot','entrepôt','soucy aquatik - entrepôt','entrpot','entrepots','entrepot - 925 av newton'], 'msqeo8g472n9', 'claude');
select public.lieu_classer(array['bureau'], 'msx5nwwoqjxi', 'claude');
select public.lieu_classer(array['quai paquet - ville de levis','quai paquet','ville de lévis - quai paquet','quai-paquet'], 'mqqnofkm0404', 'claude');
select public.lieu_classer(array['ville de lévis - parc jean-dumet'], 'mt044r6htt5o', 'claude');
select public.lieu_classer(array['desjardins','résidence desjardins','desjardin','residence desjardins'], 'msrd8b8hv28e', 'claude');
select public.lieu_classer(array['robert lepge','robert lepage','lepage'], 'mr21xk5tnvjg', 'claude');
select public.lieu_classer(array['nathalie dion'], 'mr221m2cx2gz', 'claude');
select public.lieu_classer(array['piscine michel dion','résidence michel dion'], 'msrfxiqqotx8', 'claude');
select public.lieu_classer(array['l''aventura','aventura','complexe locatif l''aventura','complexe aventura'], 'mr22b1d4ni1v', 'claude');
select public.lieu_classer(array['cobalt','complexe locatif cobalt','complexe cobalt','cobal'], 'msrd426h3xi6', 'claude');
select public.lieu_classer(array['sdc3','ccnq sdc3','ccnq / sdc3','ccnq - sdc3','ccnq-sdc3'], 'mssu58begd4b', 'claude');
select public.lieu_classer(array['champlain','boulevard champlain'], 'msrem3tt49ld', 'claude');
select public.lieu_classer(array['fleur de lys','place fleur de lys'], 'mu5x1n4tnxts', 'claude');
select public.lieu_classer(array['consolata'], 'mu2ysugo9mpz', 'claude');
select public.lieu_classer(array['canotier','cannotier','ccnq - place des canotiers','ccnq - place des canotier','place des cannotier','ccnq - place des  canotier'], 'mszypvyzq6cs', 'claude');
select public.lieu_classer(array['ccnq - station de la plage'], 'mszyoh2mv2pb', 'claude');
select public.lieu_classer(array['quai des flots','quai flo','qdf','ccnq / qdf','ccnq - quai des flots','ccnq — réparation qdf'], 'mszyr9e6acoe', 'claude');
select public.lieu_classer(array['aula','aula lévis'], 'msrdc3ajq2u1', 'claude');
select public.lieu_classer(array['quartier louis 14'], 'mr22ffbkrfdx', 'claude');
select public.lieu_classer(array['plaza laval'], 'mtw315i6gqay', 'claude');
select public.lieu_classer(array['diplomate','diplomates'], 'mu2kf3kndmzb', 'claude');
select public.lieu_classer(array['7 élement','7 éléments','7 elements','7 élément'], 'mtu6h12yrq7k', 'claude');
select public.lieu_classer(array['strom spa'], 'mtbhreb3o6zt', 'claude');
select public.lieu_classer(array['aloha'], 'msrddrw1gqxv', 'claude');
select public.lieu_classer(array['cité m'], 'mtdbk4dep1e0', 'claude');
select public.lieu_classer(array['circa','circa condo'], 'mu1k7ymboxkp', 'claude');
select public.lieu_classer(array['mérici','jardin mérici'], 'mr2290lkar6g', 'claude');
select public.lieu_classer(array['bonne entente'], 'mtlvh67fi1he', 'claude');
select public.lieu_classer(array['l’entourage sur le lac'], 'mu1es95ym0a8', 'claude');
select public.lieu_classer(array['labo mag'], 'msxk2x9ksadq', 'claude');

commit;
