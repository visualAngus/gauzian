-- Add migration script here
ALTER TABLE agnenda_categories RENAME TO agenda_categories;
ALTER TABLE agnenda_events RENAME TO agenda_events;
ALTER TABLE agnenda_event_participants RENAME TO agenda_event_participants;