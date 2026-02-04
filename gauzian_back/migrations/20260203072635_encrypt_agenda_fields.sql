-- Migration pour passer les champs agenda_events en mode crypté

-- 1. Ajouter le champ encrypted_data_key pour stocker la clé de chiffrement
-- Utilise BYTEA pour l'uniformité avec encrypted_folder_key et encrypted_file_key
ALTER TABLE agenda_events ADD COLUMN encrypted_data_key BYTEA NOT NULL DEFAULT ''::bytea;

-- 2. Ajouter le champ category (nom de catégorie crypté, distinct de category_id)
ALTER TABLE agenda_events ADD COLUMN category TEXT;

-- 3. Convertir les champs numériques qui seront cryptés en TEXT
-- Attention: Cette conversion supprimera les données existantes
-- Assurez-vous d'avoir une sauvegarde ou que la table est vide

-- Conversion de start_day_id
ALTER TABLE agenda_events ALTER COLUMN start_day_id TYPE TEXT USING start_day_id::TEXT;

-- Conversion de end_day_id
ALTER TABLE agenda_events ALTER COLUMN end_day_id TYPE TEXT USING end_day_id::TEXT;

-- Conversion de start_hour
ALTER TABLE agenda_events ALTER COLUMN start_hour TYPE TEXT USING start_hour::TEXT;

-- Conversion de end_hour
ALTER TABLE agenda_events ALTER COLUMN end_hour TYPE TEXT USING end_hour::TEXT;

-- Les champs title, description, color sont déjà TEXT donc pas de modification
-- Les champs day_id, is_all_day, is_multi_day restent tels quels (non cryptés)

-- 4. Ajouter encrypted_event_key dans agenda_event_participants
-- Cette clé permet à chaque participant de déchiffrer les données de l'événement
-- Pattern similaire à encrypted_folder_key pour le partage de fichiers/dossiers
ALTER TABLE agenda_event_participants ADD COLUMN encrypted_event_key BYTEA NOT NULL DEFAULT ''::bytea;
