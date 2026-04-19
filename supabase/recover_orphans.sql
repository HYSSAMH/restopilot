-- ============================================================
-- RestoPilot — Récupération des produits orphelins
-- À exécuter dans Supabase SQL Editor
--
-- CONTEXTE : l'import a créé des produits mais les tarifs
-- correspondants ont échoué (colonnes badge / ancien_prix
-- manquantes au moment de l'import). Résultat : des produits
-- orphelins non rattachés à aucun fournisseur.
-- ============================================================

-- ── 1. Diagnostic : combien d'orphelins et de tarifs cassés ? ──
select
  (select count(*) from produits p
     where not exists (select 1 from tarifs t where t.produit_id = p.id))
    as produits_orphelins,
  (select count(*) from tarifs where fournisseur_id is null)
    as tarifs_sans_fournisseur,
  (select count(*) from produits)   as total_produits,
  (select count(*) from tarifs)     as total_tarifs;

-- ── 2. Rattacher les tarifs qui auraient fournisseur_id NULL ──
-- (par sécurité — ne devrait normalement pas exister)
update tarifs
   set fournisseur_id = 'f1000000-0000-0000-0000-000000000001'
 where fournisseur_id is null;

-- ── 3. Choix A (recommandé) : supprimer les produits orphelins ──
-- Ils seront recréés proprement au prochain import (avec les tarifs OK)
-- Décommente ce bloc si tu préfères repartir propre :
--
--   delete from produits p
--    where not exists (select 1 from tarifs t where t.produit_id = p.id);

-- ── 3. Choix B : créer des tarifs à 0 € pour les orphelins ──
-- Les produits seront visibles côté fournisseur avec prix=0 et actif=false
-- afin que le fournisseur les édite manuellement avant de les rendre actifs.
insert into tarifs (produit_id, fournisseur_id, prix, unite, actif)
select
  p.id,
  'f1000000-0000-0000-0000-000000000001',
  0,
  'kg',
  false     -- désactivés → invisibles côté restaurateur jusqu'à correction
from produits p
where not exists (select 1 from tarifs t where t.produit_id = p.id)
on conflict (produit_id, fournisseur_id) do nothing;

-- ── 4. Vérification finale ──────────────────────────────────
select
  (select count(*) from produits p
     where not exists (select 1 from tarifs t where t.produit_id = p.id))
    as orphelins_restants,
  (select count(*) from tarifs where fournisseur_id is null)
    as tarifs_sans_fournisseur,
  (select count(*) from tarifs
     where fournisseur_id = 'f1000000-0000-0000-0000-000000000001')
    as tarifs_profrais;
