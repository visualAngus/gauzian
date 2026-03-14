-- Migration: correction de is_root_anchor pour les sous-dossiers
-- Problème: lors de la création d'un dossier, is_root_anchor était mis à TRUE pour tous les dossiers,
-- y compris les sous-dossiers. Cela causait un retour de TOUS les dossiers quand on listait la racine.
-- Fix: is_root_anchor doit être TRUE uniquement pour les dossiers à la racine (parent_folder_id IS NULL)
-- Les dossiers partagés acceptés gardent is_root_anchor = TRUE (voir accept_share_handler).

UPDATE folder_access fa
SET is_root_anchor = FALSE
FROM folders f
WHERE fa.folder_id = f.id
  AND f.parent_folder_id IS NOT NULL
  AND fa.access_level = 'owner';
