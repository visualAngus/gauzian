-- Migration: Ajout du système d'acceptation pour les partages
-- Les éléments partagés n'apparaissent pas dans le drive principal
-- jusqu'à ce que le destinataire les accepte.

-- file_access : colonne is_accepted
ALTER TABLE file_access ADD COLUMN is_accepted BOOLEAN NOT NULL DEFAULT FALSE;

-- folder_access : colonnes is_accepted et is_root_anchor
ALTER TABLE folder_access ADD COLUMN is_accepted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE folder_access ADD COLUMN is_root_anchor BOOLEAN NOT NULL DEFAULT FALSE;
-- is_root_anchor = TRUE : ce dossier partagé est ancré à la racine du destinataire
-- (distinct des sous-dossiers d'un partage, qui sont auto-acceptés en cascade)
