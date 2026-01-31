-- Criar tabela para armazenar a ordem das categorias
CREATE TABLE IF NOT EXISTS category_order (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida por posição
CREATE INDEX idx_category_order_position ON category_order(position);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_category_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar timestamp
CREATE TRIGGER update_category_order_timestamp
  BEFORE UPDATE ON category_order
  FOR EACH ROW
  EXECUTE FUNCTION update_category_order_timestamp();

-- Comentários
COMMENT ON TABLE category_order IS 'Armazena a ordem de exibição das categorias no cardápio';
COMMENT ON COLUMN category_order.category IS 'Nome da categoria';
COMMENT ON COLUMN category_order.position IS 'Posição da categoria (menor = aparece primeiro)';
