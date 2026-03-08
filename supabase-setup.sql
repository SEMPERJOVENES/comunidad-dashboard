-- ========================================
-- SEMPER DASHBOARD - Full Database Setup
-- ========================================

-- 1. Tabla de ventas presenciales
CREATE TABLE IF NOT EXISTS ventas_presenciales (
  id TEXT PRIMARY KEY,
  date TIMESTAMPTZ DEFAULT NOW(),
  customer_name TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('bizum', 'efectivo', 'transferencia')),
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  items JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de transacciones bancarias (extracto)
CREATE TABLE IF NOT EXISTS bank_transactions (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  value_date DATE,
  concept TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  balance NUMERIC(10,2),
  auto_tag TEXT,
  manual_tag TEXT,
  is_diezmo BOOLEAN DEFAULT FALSE,
  member_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de comunidades para diezmos
CREATE TABLE IF NOT EXISTS diezmos_communities (
  id TEXT PRIMARY KEY DEFAULT 'com-' || extract(epoch from now())::text,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de miembros de diezmos
CREATE TABLE IF NOT EXISTS diezmos_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  community TEXT NOT NULL,
  email TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  stripe_subscription_id TEXT,
  stripe_amount NUMERIC(10,2),
  stripe_interval TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de pagos de diezmos
CREATE TABLE IF NOT EXISTS diezmos_payments (
  id TEXT PRIMARY KEY DEFAULT 'dp-' || extract(epoch from now())::text,
  member_id TEXT NOT NULL REFERENCES diezmos_members(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('stripe', 'banco', 'manual', 'ambos')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, month)
);

-- Habilitar RLS
ALTER TABLE ventas_presenciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE diezmos_communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE diezmos_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE diezmos_payments ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso público (anon key)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all ventas') THEN
    CREATE POLICY "Allow all ventas" ON ventas_presenciales FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all bank_transactions') THEN
    CREATE POLICY "Allow all bank_transactions" ON bank_transactions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all diezmos_communities') THEN
    CREATE POLICY "Allow all diezmos_communities" ON diezmos_communities FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all diezmos_members') THEN
    CREATE POLICY "Allow all diezmos_members" ON diezmos_members FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all diezmos_payments') THEN
    CREATE POLICY "Allow all diezmos_payments" ON diezmos_payments FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_ventas_date ON ventas_presenciales(date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_date ON bank_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_tag ON bank_transactions(auto_tag);
CREATE INDEX IF NOT EXISTS idx_bank_diezmo ON bank_transactions(is_diezmo) WHERE is_diezmo = TRUE;
CREATE INDEX IF NOT EXISTS idx_diezmos_members_community ON diezmos_members(community);
CREATE INDEX IF NOT EXISTS idx_diezmos_payments_member ON diezmos_payments(member_id);
CREATE INDEX IF NOT EXISTS idx_diezmos_payments_month ON diezmos_payments(month);

-- Comunidades por defecto
INSERT INTO diezmos_communities (id, name) VALUES
  ('com-san-pablo', 'San Pablo'),
  ('com-san-ignacio', 'San Ignacio'),
  ('com-p-pio', 'P. Pio')
ON CONFLICT (name) DO NOTHING;
