-- ========================================
-- MIGRATIONS 2026-05-03 — POS regalo + excluded_orders
-- ========================================

-- 1. Permitir 'regalo' como payment_method en ventas_presenciales
ALTER TABLE ventas_presenciales
  DROP CONSTRAINT IF EXISTS ventas_presenciales_payment_method_check;

ALTER TABLE ventas_presenciales
  ADD CONSTRAINT ventas_presenciales_payment_method_check
  CHECK (payment_method IN ('bizum', 'efectivo', 'transferencia', 'regalo'));

-- 2. Añadir columnas opcionales a ventas_presenciales para tracking de pérdida (regalos)
ALTER TABLE ventas_presenciales
  ADD COLUMN IF NOT EXISTS cost_loss NUMERIC(10,2) DEFAULT 0;

ALTER TABLE ventas_presenciales
  ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'venta'
  CHECK (sale_type IN ('venta', 'regalo'));

-- 3. Tabla excluded_orders — pedidos Shopify a ocultar del dashboard (fakes, tests)
CREATE TABLE IF NOT EXISTS excluded_orders (
  order_id BIGINT PRIMARY KEY,
  order_name TEXT,
  reason TEXT,
  excluded_by TEXT,
  excluded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE excluded_orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all excluded_orders') THEN
    CREATE POLICY "Allow all excluded_orders" ON excluded_orders FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_excluded_orders_name ON excluded_orders(order_name);

-- 4. Tabla shopify_refund_events — log de refunds via webhook (auto-update dashboard)
CREATE TABLE IF NOT EXISTS shopify_refund_events (
  id TEXT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  order_name TEXT,
  refund_amount NUMERIC(10,2) NOT NULL,
  refund_currency TEXT DEFAULT 'EUR',
  refund_note TEXT,
  refund_payload JSONB,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shopify_refund_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all shopify_refund_events') THEN
    CREATE POLICY "Allow all shopify_refund_events" ON shopify_refund_events FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_refund_events_order ON shopify_refund_events(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_events_received ON shopify_refund_events(received_at DESC);
