PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orders (
  code TEXT PRIMARY KEY,
  tracking_token TEXT NOT NULL UNIQUE,
  customer TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  mode TEXT NOT NULL,
  street TEXT NOT NULL DEFAULT '',
  address_number TEXT NOT NULL DEFAULT '',
  neighborhood TEXT NOT NULL DEFAULT '',
  complement TEXT NOT NULL DEFAULT '',
  payment TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  items_json TEXT NOT NULL,
  total REAL NOT NULL,
  step_index INTEGER NOT NULL DEFAULT 0 CHECK (step_index BETWEEN 0 AND 4),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_step_index ON orders(step_index);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_code TEXT NOT NULL,
  step_index INTEGER NOT NULL CHECK (step_index BETWEEN 0 AND 4),
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_code) REFERENCES orders(code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_events_code ON order_events(order_code, created_at);
