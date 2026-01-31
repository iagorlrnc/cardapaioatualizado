-- Allow users without email
ALTER TABLE users
ALTER COLUMN email DROP NOT NULL;
