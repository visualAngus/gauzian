-- Normalisation des noms de colonnes en snake_case pour agenda_events
ALTER TABLE agenda_events RENAME COLUMN dayid TO day_id;
ALTER TABLE agenda_events RENAME COLUMN startdayid TO start_day_id;
ALTER TABLE agenda_events RENAME COLUMN enddayid TO end_day_id;
ALTER TABLE agenda_events RENAME COLUMN starthour TO start_hour;
ALTER TABLE agenda_events RENAME COLUMN endhour TO end_hour;
ALTER TABLE agenda_events RENAME COLUMN isallday TO is_all_day;
ALTER TABLE agenda_events RENAME COLUMN ismultiday TO is_multi_day;
ALTER TABLE agenda_events RENAME COLUMN createdat TO created_at;
ALTER TABLE agenda_events RENAME COLUMN updatedat TO updated_at;

-- Normalisation des noms de colonnes en snake_case pour agenda_categories
ALTER TABLE agenda_categories RENAME COLUMN createdat TO created_at;
ALTER TABLE agenda_categories RENAME COLUMN updatedat TO updated_at;

-- Normalisation des noms de colonnes en snake_case pour agenda_event_participants
ALTER TABLE agenda_event_participants RENAME COLUMN createdat TO created_at;
ALTER TABLE agenda_event_participants RENAME COLUMN updatedat TO updated_at;
