-- Add qr_code column to users table
ALTER TABLE users ADD COLUMN qr_code TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX idx_users_qr_code ON users(qr_code);
