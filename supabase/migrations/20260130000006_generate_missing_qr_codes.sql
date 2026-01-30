-- Update existing users without QR codes
UPDATE users
SET qr_code = gen_random_uuid()::text
WHERE qr_code IS NULL
  AND is_admin = false
  AND is_employee = false;
