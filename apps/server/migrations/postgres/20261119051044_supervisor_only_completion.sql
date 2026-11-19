ALTER TABLE tasks ADD COLUMN supervisor_only_completion BIGINT NOT NULL DEFAULT 0 CHECK (supervisor_only_completion IN (0, 1));
