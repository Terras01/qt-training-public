// Data access and business rules for the menu and orders.

export const ORDER_STATUSES = ['New', 'Ready'];
export const MAX_NAME_LENGTH = 60;
export const MAX_QUANTITY = 99;
export const MAX_LINES_PER_ORDER = 50;

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function createStore(db) {
  const stmt = {
    sizes: db.prepare('SELECT id, name, inches, price_cents FROM sizes ORDER BY sort_order'),
    toppings: db.prepare('SELECT id, name, price_cents, sort_order FROM toppings ORDER BY sort_order'),
    insertOrder: db.prepare(`
      INSERT INTO orders (customer_name, status, total_cents, created_at, updated_at)
      VALUES (?, 'New', ?, ?, ?)
    `),
    insertItem: db.prepare(`
      INSERT INTO order_items
        (order_id, size_id, size_name, size_inches, base_price_cents,
         unit_price_cents, quantity, line_total_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    insertItemTopping: db.prepare(`
      INSERT INTO order_item_toppings (order_item_id, topping_id, topping_name, price_cents, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `),
    orderById: db.prepare('SELECT * FROM orders WHERE id = ?'),
    allOrders: db.prepare('SELECT * FROM orders ORDER BY id'),
    ordersByStatus: db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id'),
    itemsForOrder: db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id'),
    toppingsForItem: db.prepare(
      'SELECT topping_id, topping_name, price_cents FROM order_item_toppings WHERE order_item_id = ? ORDER BY sort_order',
    ),
    updateStatus: db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?'),
  };

  function getMenu() {
    return {
      sizes: stmt.sizes.all().map((s) => ({
        id: s.id,
        name: s.name,
        inches: s.inches,
        priceCents: s.price_cents,
      })),
      toppings: stmt.toppings.all().map((t) => ({
        id: t.id,
        name: t.name,
        priceCents: t.price_cents,
      })),
    };
  }

  /**
   * Validates an order request and prices every line from the database menu.
   * Any prices sent by the browser are ignored, so totals can't be tampered with.
   */
  function priceOrder(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new ValidationError('Order details are missing.');
    }

    const customerName = typeof input.customerName === 'string' ? input.customerName.trim() : '';
    if (!customerName) throw new ValidationError('Please enter a name for the order.');
    if (customerName.length > MAX_NAME_LENGTH) {
      throw new ValidationError(`Name must be ${MAX_NAME_LENGTH} characters or fewer.`);
    }

    const items = input.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Your order is empty. Add at least one pizza.');
    }
    if (items.length > MAX_LINES_PER_ORDER) {
      throw new ValidationError(`An order can have at most ${MAX_LINES_PER_ORDER} different pizzas.`);
    }

    const sizes = new Map(stmt.sizes.all().map((s) => [s.id, s]));
    const toppings = new Map(stmt.toppings.all().map((t) => [t.id, t]));

    const lines = items.map((item, index) => {
      const label = `Pizza ${index + 1}`;
      if (!item || typeof item !== 'object') throw new ValidationError(`${label} is invalid.`);

      const size = sizes.get(item.sizeId);
      if (!size) throw new ValidationError(`${label} has an unknown size.`);

      const { quantity } = item;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
        throw new ValidationError(`${label} quantity must be a whole number from 1 to ${MAX_QUANTITY}.`);
      }

      const toppingIds = item.toppingIds ?? [];
      if (!Array.isArray(toppingIds)) throw new ValidationError(`${label} toppings are invalid.`);
      if (new Set(toppingIds).size !== toppingIds.length) {
        throw new ValidationError(`${label} lists the same topping more than once.`);
      }
      const chosen = toppingIds.map((id) => {
        const t = toppings.get(id);
        if (!t) throw new ValidationError(`${label} has an unknown topping.`);
        return t;
      });
      chosen.sort((a, b) => a.sort_order - b.sort_order);

      const unitPriceCents = size.price_cents + chosen.reduce((sum, t) => sum + t.price_cents, 0);
      return {
        size,
        toppings: chosen,
        quantity,
        unitPriceCents,
        lineTotalCents: unitPriceCents * quantity,
      };
    });

    const totalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
    return { customerName, lines, totalCents };
  }

  function createOrder(input) {
    const { customerName, lines, totalCents } = priceOrder(input);
    const now = new Date().toISOString();

    db.exec('BEGIN IMMEDIATE');
    let orderId;
    try {
      ({ lastInsertRowid: orderId } = stmt.insertOrder.run(customerName, totalCents, now, now));
      for (const line of lines) {
        const { lastInsertRowid: itemId } = stmt.insertItem.run(
          orderId,
          line.size.id,
          line.size.name,
          line.size.inches,
          line.size.price_cents,
          line.unitPriceCents,
          line.quantity,
          line.lineTotalCents,
        );
        line.toppings.forEach((t, i) => {
          stmt.insertItemTopping.run(itemId, t.id, t.name, t.price_cents, i);
        });
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    return getOrder(Number(orderId));
  }

  function hydrate(row) {
    const items = stmt.itemsForOrder.all(row.id).map((item) => ({
      id: item.id,
      size: { id: item.size_id, name: item.size_name, inches: item.size_inches },
      basePriceCents: item.base_price_cents,
      toppings: stmt.toppingsForItem.all(item.id).map((t) => ({
        id: t.topping_id,
        name: t.topping_name,
        priceCents: t.price_cents,
      })),
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
      lineTotalCents: item.line_total_cents,
    }));

    return {
      id: row.id,
      customerName: row.customer_name,
      status: row.status,
      totalCents: row.total_cents,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items,
    };
  }

  function getOrder(id) {
    const row = stmt.orderById.get(id);
    return row ? hydrate(row) : null;
  }

  function assertStatus(status) {
    if (!ORDER_STATUSES.includes(status)) {
      throw new ValidationError(`Status must be one of: ${ORDER_STATUSES.join(', ')}.`);
    }
  }

  function listOrders(status) {
    if (status === undefined) return stmt.allOrders.all().map(hydrate);
    assertStatus(status);
    return stmt.ordersByStatus.all(status).map(hydrate);
  }

  function setStatus(id, status) {
    assertStatus(status);
    const { changes } = stmt.updateStatus.run(status, new Date().toISOString(), id);
    return changes ? getOrder(id) : null;
  }

  return { getMenu, createOrder, getOrder, listOrders, setStatus };
}
