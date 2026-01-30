-- Function to generate a unique QR code for new users
CREATE OR REPLACE FUNCTION generate_user_qr_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o usuário é cliente (não admin e não employee), gera um QR code único
  IF NEW.is_admin = false AND NEW.is_employee = false THEN
    NEW.qr_code := gen_random_uuid()::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar QR code automaticamente quando um usuário é criado
DROP TRIGGER IF EXISTS trigger_generate_user_qr_code ON users;
CREATE TRIGGER trigger_generate_user_qr_code
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION generate_user_qr_code();
