ALTER TABLE tasks ADD COLUMN supervisor_only_completion INTEGER NOT NULL DEFAULT 0 CHECK (supervisor_only_completion IN (0, 1));
