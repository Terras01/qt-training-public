import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Menu from the business requirements. Prices are stored in cents to avoid
// floating-point rounding errors.
const SIZES = [
  { id: 'small', name: 'Small', inches: 10, priceCents: 1000, sortOrder: 1 },
  { id: 'large', name: 'Large', inches: 14, priceCents: 1400, sortOrder: 2 },
];

const TOPPINGS = [
  { id: 'pepperoni', name: 'Pepperoni', priceCents: 200, sortOrder: 1 },
  { id: 'mushrooms', name: 'Mushrooms', priceCents: 200, sortOrder: 2 },
  { id: 'onions', name: 'Onions', priceCents: 200, sortOrder: 3 },
  { id: 'green-peppers', name: 'Green peppers', priceCents: 200, sortOrder: 4 },
];

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sizes (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    inches      INTEGER NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    sort_order  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS toppings (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    sort_order  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Ready')),
    total_cents   INTEGER NOT NULL CHECK (total_cents >= 0),
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );

  -- Size, topping names, and prices are copied onto each line so past orders
  -- keep showing what the customer was charged, even if the menu changes later.
  CREATE TABLE IF NOT EXISTS order_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    size_id          TEXT NOT NULL,
    size_name        TEXT NOT NULL,
    size_inches      INTEGER NOT NULL,
    base_price_cents INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    quantity         INTEGER NOT NULL CHECK (quantity > 0),
    line_total_cents INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_item_toppings (
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    topping_id    TEXT NOT NULL,
    topping_name  TEXT NOT NULL,
    price_cents   INTEGER NOT NULL,
    sort_order    INTEGER NOT NULL,
    PRIMARY KEY (order_item_id, topping_id)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`;

/**
 * Opens (or creates) the SQLite database and makes sure the schema and menu exist.
 * Pass ':memory:' for a throwaway database (used by tests).
 */
export function openDatabase(filename) {
  const inMemory = filename === ':memory:';
  if (!inMemory) mkdirSync(dirname(filename), { recursive: true });

  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  if (!inMemory) {
    // WAL + FULL sync: committed orders survive the app closing or the computer restarting.
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = FULL;');
  }
  db.exec(SCHEMA);
  seedMenu(db);
  return db;
}

function seedMenu(db) {
  const upsertSize = db.prepare(`
    INSERT INTO sizes (id, name, inches, price_cents, sort_order)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, inches = excluded.inches,
      price_cents = excluded.price_cents, sort_order = excluded.sort_order
  `);
  const upsertTopping = db.prepare(`
    INSERT INTO toppings (id, name, price_cents, sort_order)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, price_cents = excluded.price_cents,
      sort_order = excluded.sort_order
  `);

  db.exec('BEGIN');
  try {
    for (const s of SIZES) upsertSize.run(s.id, s.name, s.inches, s.priceCents, s.sortOrder);
    for (const t of TOPPINGS) upsertTopping.run(t.id, t.name, t.priceCents, t.sortOrder);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
