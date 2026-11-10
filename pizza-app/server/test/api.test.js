import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';

/** Starts the app on a random port and returns a small fetch helper. */
async function startServer(db) {
  const server = createApp(db).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;

  async function call(method, path, body, { raw } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  const close = () => new Promise((resolve) => server.close(resolve));
  return { call, close };
}

const pizza = (sizeId, toppingIds = [], quantity = 1) => ({ sizeId, toppingIds, quantity });

describe('API', () => {
  let db;
  let api;

  before(async () => {
    db = openDatabase(':memory:');
    api = await startServer(db);
  });

  after(async () => {
    await api.close();
    db.close();
  });

  test('menu lists both sizes and all four toppings at the published prices', async () => {
    const { status, body } = await api.call('GET', '/menu');
    assert.equal(status, 200);
    assert.deepEqual(
      body.sizes.map((s) => [s.id, s.inches, s.priceCents]),
      [
        ['small', 10, 1000],
        ['large', 14, 1400],
      ],
    );
    assert.deepEqual(
      body.toppings.map((t) => [t.id, t.priceCents]),
      [
        ['pepperoni', 200],
        ['mushrooms', 200],
        ['onions', 200],
        ['green-peppers', 200],
      ],
    );
  });

  test('prices pizzas from the menu: $2 per topping regardless of size, times quantity', async () => {
    const { status, body } = await api.call('POST', '/orders', {
      customerName: 'Pat',
      items: [
        pizza('small'), // plain cheese: 10.00
        pizza('small', ['pepperoni']), // 12.00
        pizza('large', ['pepperoni', 'mushrooms', 'onions', 'green-peppers'], 2), // 22.00 x 2
      ],
    });
    assert.equal(status, 201);
    assert.deepEqual(
      body.items.map((i) => [i.unitPriceCents, i.quantity, i.lineTotalCents]),
      [
        [1000, 1, 1000],
        [1200, 1, 1200],
        [2200, 2, 4400],
      ],
    );
    assert.equal(body.totalCents, 6600);
  });

  test('ignores any prices sent by the browser', async () => {
    const { body } = await api.call('POST', '/orders', {
      customerName: 'Sneaky',
      totalCents: 1,
      items: [{ ...pizza('large', ['onions']), unitPriceCents: 1, priceCents: 1 }],
    });
    assert.equal(body.items[0].unitPriceCents, 1600);
    assert.equal(body.totalCents, 1600);
  });

  test('confirmation includes order number, trimmed name, items, total, and New status', async () => {
    const { status, body } = await api.call('POST', '/orders', {
      customerName: '  Jordan  ',
      items: [pizza('large', ['green-peppers', 'pepperoni'])],
    });
    assert.equal(status, 201);
    assert.ok(Number.isInteger(body.id) && body.id > 0);
    assert.equal(body.customerName, 'Jordan');
    assert.equal(body.status, 'New');
    assert.equal(body.totalCents, 1800);
    assert.equal(body.items[0].size.name, 'Large');
    assert.equal(body.items[0].size.inches, 14);
    // Toppings come back in menu order, not the order they were clicked.
    assert.deepEqual(
      body.items[0].toppings.map((t) => t.name),
      ['Pepperoni', 'Green peppers'],
    );
  });

  describe('rejects invalid orders', () => {
    const cases = [
      ['empty item list', { customerName: 'A', items: [] }, /empty/i],
      ['missing items', { customerName: 'A' }, /empty/i],
      ['missing name', { items: [pizza('small')] }, /name/i],
      ['blank name', { customerName: '   ', items: [pizza('small')] }, /name/i],
      ['name too long', { customerName: 'x'.repeat(61), items: [pizza('small')] }, /60/],
      ['unknown size', { customerName: 'A', items: [pizza('medium')] }, /size/i],
      ['unknown topping', { customerName: 'A', items: [pizza('small', ['anchovies'])] }, /topping/i],
      ['duplicate topping', { customerName: 'A', items: [pizza('small', ['onions', 'onions'])] }, /more than once/i],
      ['quantity 0', { customerName: 'A', items: [pizza('small', [], 0)] }, /quantity/i],
      ['quantity 100', { customerName: 'A', items: [pizza('small', [], 100)] }, /quantity/i],
      ['fractional quantity', { customerName: 'A', items: [pizza('small', [], 1.5)] }, /quantity/i],
      ['quantity as string', { customerName: 'A', items: [pizza('small', [], '2')] }, /quantity/i],
    ];

    for (const [name, payload, message] of cases) {
      test(name, async () => {
        const { status, body } = await api.call('POST', '/orders', payload);
        assert.equal(status, 400);
        assert.match(body.error, message);
      });
    }

    test('malformed JSON', async () => {
      const { status, body } = await api.call('POST', '/orders', '{"customerName":', { raw: true });
      assert.equal(status, 400);
      assert.match(body.error, /JSON/);
    });

    test('a rejected order is not saved', async () => {
      const before = (await api.call('GET', '/orders')).body.length;
      await api.call('POST', '/orders', { customerName: 'A', items: [pizza('small'), pizza('nope')] });
      const afterCount = (await api.call('GET', '/orders')).body.length;
      assert.equal(afterCount, before);
    });
  });

  test('kitchen can list orders, mark one Ready, and filter by status', async () => {
    const { body: created } = await api.call('POST', '/orders', {
      customerName: 'Kitchen Test',
      items: [pizza('small', ['mushrooms'], 3)],
    });

    const { body: all } = await api.call('GET', '/orders');
    const listed = all.find((o) => o.id === created.id);
    assert.equal(listed.customerName, 'Kitchen Test');
    assert.equal(listed.status, 'New');
    assert.equal(listed.totalCents, 3600);
    assert.equal(listed.items[0].quantity, 3);

    const { status, body: updated } = await api.call('PATCH', `/orders/${created.id}/status`, { status: 'Ready' });
    assert.equal(status, 200);
    assert.equal(updated.status, 'Ready');

    const { body: ready } = await api.call('GET', '/orders?status=Ready');
    assert.ok(ready.some((o) => o.id === created.id));
    const { body: fresh } = await api.call('GET', '/orders?status=New');
    assert.ok(!fresh.some((o) => o.id === created.id));

    const { body: undone } = await api.call('PATCH', `/orders/${created.id}/status`, { status: 'New' });
    assert.equal(undone.status, 'New');
  });

  test('status changes and lookups validate input', async () => {
    const { body: created } = await api.call('POST', '/orders', { customerName: 'V', items: [pizza('small')] });

    assert.equal((await api.call('PATCH', `/orders/${created.id}/status`, { status: 'Done' })).status, 400);
    assert.equal((await api.call('PATCH', `/orders/${created.id}/status`, {})).status, 400);
    assert.equal((await api.call('PATCH', '/orders/999999/status', { status: 'Ready' })).status, 404);
    assert.equal((await api.call('GET', '/orders/999999')).status, 404);
    assert.equal((await api.call('GET', '/orders/abc')).status, 400);
    assert.equal((await api.call('GET', '/orders?status=Bogus')).status, 400);
    assert.equal((await api.call('GET', `/orders/${created.id}`)).body.customerName, 'V');
  });
});

describe('persistence', () => {
  test('orders and statuses survive closing and reopening the app', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pizza-test-'));
    const file = join(dir, 'pizza.db');
    try {
      // First "session": place two orders, mark one Ready, then shut down.
      let db = openDatabase(file);
      let api = await startServer(db);
      const { body: first } = await api.call('POST', '/orders', {
        customerName: 'Before Restart',
        items: [pizza('large', ['pepperoni'], 2)],
      });
      const { body: second } = await api.call('POST', '/orders', {
        customerName: 'Still Cooking',
        items: [pizza('small')],
      });
      await api.call('PATCH', `/orders/${first.id}/status`, { status: 'Ready' });
      await api.close();
      db.close();

      // Second "session": a brand-new app on the same file.
      db = openDatabase(file);
      api = await startServer(db);
      const { body: orders } = await api.call('GET', '/orders');
      assert.deepEqual(
        orders.map((o) => [o.id, o.customerName, o.status, o.totalCents]),
        [
          [first.id, 'Before Restart', 'Ready', 3200],
          [second.id, 'Still Cooking', 'New', 1000],
        ],
      );
      assert.deepEqual(orders[0].items, first.items);

      // New orders keep counting up instead of reusing numbers.
      const { body: third } = await api.call('POST', '/orders', { customerName: 'After', items: [pizza('small')] });
      assert.ok(third.id > second.id);

      await api.close();
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
