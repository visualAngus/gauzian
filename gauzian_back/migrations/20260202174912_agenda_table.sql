-- Add migration script here
CREATE TABLE agnenda_categories (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    description TEXT,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    owner_id UUID NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE agnenda_events (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    dayID NUMERIC NOT NULL,
    startDayId NUMERIC NOT NULL,
    endDayId NUMERIC NOT NULL,
    startHour NUMERIC NOT NULL,
    endHour NUMERIC NOT NULL,
    isAllDay BOOLEAN NOT NULL,
    isMultiDay BOOLEAN NOT NULL,
    category_id UUID,
    color TEXT,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    owner_id UUID NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES agnenda_categories(id) ON DELETE SET NULL
);

CREATE TABLE agnenda_event_participants (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL,
    participant_id UUID NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES agnenda_events(id) ON DELETE CASCADE,
    FOREIGN KEY (participant_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE INDEX idx_agnenda_events_owner_id ON agnenda_events(owner_id);
CREATE INDEX idx_agnenda_categories_owner_id ON agnenda_categories(owner_id);
CREATE INDEX idx_agnenda_event_participants_event_id ON agnenda_event_participants(event_id);
CREATE INDEX idx_agnenda_event_participants_participant_id ON agnenda_event_participants(participant_id);
