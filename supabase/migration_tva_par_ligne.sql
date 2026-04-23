-- ============================================================
-- RestoPilot — TVA par ligne de facture + récap TVA
--
-- Ajoute :
--   • lignes_commande.tva_taux       : taux TVA individuel de chaque ligne
--   • commandes.tva_recap             : tableau JSON des bases / TVA / TTC
--                                       par taux, tel qu'imprimé en pied
--                                       de facture
--
-- Exemple tva_recap :
--   [
--     { "taux": 5.5, "base_ht": 113.80, "montant_tva": 6.26, "ttc": 120.06 },
--     { "taux": 20,  "base_ht": 13.50,  "montant_tva": 2.70, "ttc": 16.20  }
--   ]
-- ============================================================

alter table lignes_commande
  add column if not exists tva_taux numeric(5,2)
    check (tva_taux is null or (tva_taux >= 0 and tva_taux <= 30));

comment on column lignes_commande.tva_taux is
  'Taux de TVA applicable à cette ligne (en %). Extrait de la facture d''origine. Null si inconnu.';

alter table commandes
  add column if not exists tva_recap jsonb default '[]'::jsonb;

comment on column commandes.tva_recap is
  'Récapitulatif TVA par taux : [{taux, base_ht, montant_tva, ttc}]. Issu du pied de la facture importée.';

-- ── Diagnostic ────────────────────────────────────────────────────
select 'Colonnes ajoutées :' as info;
select table_name, column_name, data_type, numeric_precision, numeric_scale
  from information_schema.columns
 where table_schema='public'
   and ((table_name='lignes_commande' and column_name='tva_taux')
     or (table_name='commandes' and column_name='tva_recap'));
