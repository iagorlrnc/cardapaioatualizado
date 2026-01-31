-- Add slug column to users table
ALTER TABLE users ADD COLUMN slug text UNIQUE;

-- Generate slugs based on username (URL-friendly version)
UPDATE users SET slug = lower(regexp_replace(username, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(id::text, 1, 8)
WHERE slug IS NULL;

-- Make slug NOT NULL after populating
ALTER TABLE users ALTER COLUMN slug SET NOT NULL;

-- Create index for slug lookups
CREATE INDEX idx_users_slug ON users(slug);
