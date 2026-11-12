-- User alternate email, storage quota, and activation invitations
ALTER TABLE users ADD COLUMN alternate_email TEXT;
ALTER TABLE users ADD COLUMN storage_quota INTEGER;

CREATE TABLE IF NOT EXISTS user_invitations (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  recipient_email TEXT NOT NULL COLLATE NOCASE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'accepted', 'expired', 'failed')),
  error TEXT,
  sent_at INTEGER,
  expires_at INTEGER NOT NULL,
  accepted_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_user_id ON user_invitations (user_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token_hash ON user_invitations (token_hash);

