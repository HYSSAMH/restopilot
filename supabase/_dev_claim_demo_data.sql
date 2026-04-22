-- ============================================================
-- RestoPilot — Rattacher les produits démo à un compte réel
--
-- Usage : après avoir créé un compte fournisseur via /register,
-- récupère son user_id dans Supabase (Authentication > Users)
-- et remplace <VOTRE_USER_ID> ci-dessous. Exécute ensuite.
-- ============================================================

-- 1. Transférer tous les tarifs du fournisseur démo vers l'utilisateur connecté
update tarifs
   set fournisseur_id = 938e30c3-e63b-4646-8f74-c196998189fe
 where fournisseur_id = f1000000-0000-0000-0000-000000000001 ;

-- 2. (Optionnel) Transférer la fiche fournisseur démo à l'utilisateur
--    Si l'inscription a déjà créé une fiche fournisseur, le conflit sera ignoré.
update fournisseurs
   set id = 938e30c3-e63b-4646-8f74-c196998189fe
 where id = f1000000-0000-0000-0000-000000000001
   and not exists (select 1 from fournisseurs where id = 938e30c3-e63b-4646-8f74-c196998189fe);

-- 3. Vérification
select
  (select count(*) from tarifs where fournisseur_id = 938e30c3-e63b-4646-8f74-c196998189fe) as mes_tarifs,
  (select count(*) from tarifs where fournisseur_id = f1000000-0000-0000-0000-000000000001) as tarifs_demo_restants;
