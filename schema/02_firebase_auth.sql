-- =====================================================
-- Firebase Authentication Integration
-- =====================================================

-- Add firebase_uid to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(255) UNIQUE;

-- Create index for fast lookups by firebase_uid
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- Update password_hash to be nullable (since Firebase handles passwords)
ALTER TABLE users
ALTER COLUMN password_hash DROP NOT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN users.firebase_uid IS 'Unique identifier from Firebase Authentication';
