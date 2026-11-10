// Kitchen requirements: section 4 (Managing kitchen orders).
import { test, expect, addPizza, orderCard } from './fixtures.js';

const newColumn = (page) => page.getByRole('region', { name: /^New/ });
const readyColumn = (page) => page.getByRole('region', { name: /^Ready for pickup/ });

test.describe('4. Managing kitchen orders', () => {
  test('AC-4.1 kitchen sees name, order number, pizza details, and total', async ({ page, app }) => {
    const order = await app.placeOrder({
      customerName: 'Morgan',
      items: [
        { sizeId: 'large', toppingIds: ['pepperoni', 'onions'], quantity: 2 },
        { sizeId: 'small', toppingIds: [], quantity: 1 },
      ],
    });

    await page.goto('/kitchen');
    const card = orderCard(page, order.id);
    await expect(card).toContainText(`#${order.id}`);
    await expect(card).toContainText('Morgan');

    const items = card.getByTestId('order-item');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('2×');
    await expect(items.nth(0)).toContainText('Large (14")');
    await expect(items.nth(0)).toContainText('Pepperoni, Onions');
    await expect(items.nth(0)).toContainText('$36.00');
    await expect(items.nth(1)).toContainText('1×');
    await expect(items.nth(1)).toContainText('Small (10")');
    await expect(items.nth(1)).toContainText('Cheese only');
    await expect(items.nth(1)).toContainText('$10.00');
    await expect(card.getByTestId('order-total')).toHaveText('$46.00');
  });

  test('AC-4.1 an order placed by a customer appears on an open kitchen board without a manual refresh', async ({
    page,
    context,
  }) => {
    await page.goto('/kitchen');
    await expect(page.getByRole('heading', { name: 'Kitchen orders' })).toBeVisible();

    // A customer orders in another tab while the kitchen board stays open.
    const customer = await context.newPage();
    await customer.goto('/');
    await addPizza(customer, { size: 'small', toppings: ['Green peppers'] });
    await customer.getByLabel('Name for pickup').fill('Riley');
    await customer.getByRole('button', { name: 'Place pickup order' }).click();
    const id = Number((await customer.getByTestId('order-number').textContent()).replace('#', ''));
    await customer.close();

    // The board polls every 5 seconds.
    const card = newColumn(page).locator(`[data-order-id="${id}"]`);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card).toContainText('Riley');
    await expect(card).toContainText('Green peppers');
    await expect(card.getByTestId('order-total')).toHaveText('$12.00');
  });

  test('AC-4.2 new orders are marked New and staff can change them to Ready', async ({ page, app }) => {
    const order = await app.placeOrder({
      customerName: 'Casey',
      items: [{ sizeId: 'small', toppingIds: ['mushrooms'], quantity: 1 }],
    });

    await page.goto('/kitchen');
    const inNew = newColumn(page).locator(`[data-order-id="${order.id}"]`);
    await expect(inNew).toBeVisible();
    await expect(inNew).toContainText('New');
    await expect(readyColumn(page).locator(`[data-order-id="${order.id}"]`)).toHaveCount(0);

    await inNew.getByRole('button', { name: 'Mark Ready' }).click();

    const inReady = readyColumn(page).locator(`[data-order-id="${order.id}"]`);
    await expect(inReady).toBeVisible();
    await expect(inReady).toContainText('Ready');
    await expect(newColumn(page).locator(`[data-order-id="${order.id}"]`)).toHaveCount(0);

    // The change is saved on the server, not just on screen.
    const saved = (await app.listOrders()).find((o) => o.id === order.id);
    expect(saved.status).toBe('Ready');

    // A mistaken "Ready" can be undone.
    await inReady.getByRole('button', { name: /Undo/ }).click();
    await expect(newColumn(page).locator(`[data-order-id="${order.id}"]`)).toBeVisible();
    await newColumn(page).locator(`[data-order-id="${order.id}"]`).getByRole('button', { name: 'Mark Ready' }).click();
    await expect(readyColumn(page).locator(`[data-order-id="${order.id}"]`)).toBeVisible();
  });

  test('AC-4.3 orders and statuses survive the app being closed and the server being killed', async ({
    browser,
    app,
  }) => {
    // Session 1: a customer places two orders through the UI, the kitchen marks one Ready.
    let context = await browser.newContext({ baseURL: app.url });
    let page = await context.newPage();
    const ids = [];
    for (const [name, toppings] of [
      ['Before Restart Ready', ['Pepperoni']],
      ['Before Restart New', ['Onions', 'Mushrooms']],
    ]) {
      await page.goto('/');
      await addPizza(page, { size: 'large', toppings });
      await page.getByLabel('Name for pickup').fill(name);
      await page.getByRole('button', { name: 'Place pickup order' }).click();
      ids.push(Number((await page.getByTestId('order-number').textContent()).replace('#', '')));
    }
    const [readyId, newId] = ids;

    await page.goto('/kitchen');
    await orderCard(page, readyId).getByRole('button', { name: 'Mark Ready' }).click();
    await expect(readyColumn(page).locator(`[data-order-id="${readyId}"]`)).toBeVisible();

    // Close the browser window and hard-kill the server (no graceful shutdown).
    await context.close();
    await app.kill();
    await app.start();

    // Session 2: a fresh browser opens the kitchen board.
    context = await browser.newContext({ baseURL: app.url });
    page = await context.newPage();
    await page.goto('/kitchen');

    const ready = readyColumn(page).locator(`[data-order-id="${readyId}"]`);
    await expect(ready).toContainText('Before Restart Ready');
    await expect(ready).toContainText('Pepperoni');
    await expect(ready.getByTestId('order-total')).toHaveText('$16.00');

    const stillNew = newColumn(page).locator(`[data-order-id="${newId}"]`);
    await expect(stillNew).toContainText('Before Restart New');
    await expect(stillNew).toContainText('Mushrooms, Onions');
    await expect(stillNew.getByTestId('order-total')).toHaveText('$18.00');

    // Work continues normally after the restart, and new order numbers don't repeat.
    await stillNew.getByRole('button', { name: 'Mark Ready' }).click();
    await expect(readyColumn(page).locator(`[data-order-id="${newId}"]`)).toBeVisible();
    const next = await app.placeOrder({ customerName: 'After', items: [{ sizeId: 'small', quantity: 1 }] });
    expect(next.id).toBeGreaterThan(newId);

    await context.close();
  });

  test('the kitchen board tells staff when the server cannot be reached, then recovers', async ({ page, app }) => {
    await page.goto('/kitchen');
    await expect(page.getByRole('heading', { name: 'Kitchen orders' })).toBeVisible();

    await app.kill();
    try {
      await page.getByRole('button', { name: 'Refresh now' }).click();
      await expect(page.getByRole('alert')).toContainText("couldn't reach");
    } finally {
      await app.start();
    }
    await page.getByRole('button', { name: 'Refresh now' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
