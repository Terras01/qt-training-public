// Customer-facing requirements: sections 1 (Ordering), 2 (Reviewing), 3 (Placing), 5 (Additional expectations).
import { test, expect, addPizza, cartLine, SIZE_LABEL } from './fixtures.js';

const TOPPINGS = ['Pepperoni', 'Mushrooms', 'Onions', 'Green peppers'];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Order for pickup' })).toBeVisible();
});

test.describe('1. Ordering a pizza', () => {
  test('AC-1.1 customers can select either size and any combination of toppings', async ({ page }) => {
    const builder = page.getByRole('region', { name: 'Build your pizza' });

    for (const size of Object.values(SIZE_LABEL)) {
      const radio = builder.getByRole('radio', { name: size });
      await radio.check();
      await expect(radio).toBeChecked();
    }
    // Only one size at a time.
    await expect(builder.getByRole('radio', { name: SIZE_LABEL.small })).not.toBeChecked();

    // All four toppings can be on at once...
    for (const t of TOPPINGS) await builder.getByRole('checkbox', { name: t }).check();
    for (const t of TOPPINGS) await expect(builder.getByRole('checkbox', { name: t })).toBeChecked();

    // ...or any subset, including none (plain cheese).
    await builder.getByRole('checkbox', { name: 'Mushrooms' }).uncheck();
    await builder.getByRole('checkbox', { name: 'Green peppers' }).uncheck();
    await expect(builder.getByRole('checkbox', { name: 'Pepperoni' })).toBeChecked();
    await expect(builder.getByRole('checkbox', { name: 'Mushrooms' })).not.toBeChecked();
    for (const t of TOPPINGS) await builder.getByRole('checkbox', { name: t }).uncheck();
    await builder.getByRole('button', { name: /^Add / }).click();
    await expect(cartLine(page, 'large', 'Cheese only')).toBeVisible();
  });

  test('AC-1.2 customers see the price of the pizza before adding it', async ({ page }) => {
    const builder = page.getByRole('region', { name: 'Build your pizza' });
    const price = page.getByTestId('unit-price');

    // Menu prices are shown on the options themselves.
    await expect(builder.getByRole('radio', { name: SIZE_LABEL.small }).locator('..')).toContainText('$10.00');
    await expect(builder.getByRole('radio', { name: SIZE_LABEL.large }).locator('..')).toContainText('$14.00');
    for (const t of TOPPINGS) {
      await expect(builder.getByRole('checkbox', { name: t }).locator('..')).toContainText('+$2.00');
    }

    // The pizza's own price is visible while building, before it's in the cart.
    await expect(price).toHaveText('$10.00');
    await builder.getByRole('radio', { name: SIZE_LABEL.large }).check();
    await expect(price).toHaveText('$14.00');
    await expect(builder.getByRole('button', { name: /^Add / })).toContainText('$14.00');
    await expect(page.getByTestId('cart-line')).toHaveCount(0);
  });

  test('AC-1.3 price updates correctly as toppings are added and removed ($2 each, any size)', async ({ page }) => {
    const builder = page.getByRole('region', { name: 'Build your pizza' });
    const price = page.getByTestId('unit-price');
    const toggle = (name) => builder.getByRole('checkbox', { name });

    // Small: 10 + 2 per topping
    const smallSteps = [
      ['Pepperoni', '$12.00'],
      ['Mushrooms', '$14.00'],
      ['Onions', '$16.00'],
      ['Green peppers', '$18.00'],
    ];
    for (const [t, expected] of smallSteps) {
      await toggle(t).check();
      await expect(price).toHaveText(expected);
    }
    // Switching size keeps toppings and still adds $2 each: 14 + 8
    await builder.getByRole('radio', { name: SIZE_LABEL.large }).check();
    await expect(price).toHaveText('$22.00');

    // Removing toppings lowers the price
    await toggle('Onions').uncheck();
    await expect(price).toHaveText('$20.00');
    await toggle('Pepperoni').uncheck();
    await expect(price).toHaveText('$18.00');
    await toggle('Mushrooms').uncheck();
    await toggle('Green peppers').uncheck();
    await expect(price).toHaveText('$14.00');

    // Quantity in the builder multiplies the "Add" price
    await toggle('Pepperoni').check();
    await builder.getByRole('button', { name: 'Increase quantity' }).click();
    await expect(builder.getByRole('button', { name: /^Add / })).toContainText('$32.00');
  });
});

test.describe('2. Reviewing an order', () => {
  test('AC-2.1 / AC-2.2 multiple different pizzas show details, prices, and the total', async ({ page }) => {
    await addPizza(page, { size: 'small' });
    await addPizza(page, { size: 'small', toppings: ['Pepperoni'] });
    await addPizza(page, { size: 'large', toppings: TOPPINGS, quantity: 2 });

    await expect(page.getByTestId('cart-line')).toHaveCount(3);

    const cheese = cartLine(page, 'small', 'Cheese only');
    await expect(cheese).toContainText('$10.00 each');
    await expect(cheese.getByTestId('line-total')).toHaveText('$10.00');

    const pepperoni = cartLine(page, 'small', 'Pepperoni');
    await expect(pepperoni).toContainText('$12.00 each');
    await expect(pepperoni.getByTestId('line-total')).toHaveText('$12.00');

    const supreme = cartLine(page, 'large', 'Pepperoni, Mushrooms, Onions, Green peppers');
    await expect(supreme).toContainText('$22.00 each');
    await expect(supreme.getByTestId('line-total')).toHaveText('$44.00');

    await expect(page.getByTestId('cart-total')).toHaveText('$66.00');
    await expect(page.getByRole('heading', { name: /Your order/ })).toContainText('4 pizzas');
  });

  test('adding an identical pizza again increases that line instead of duplicating it', async ({ page }) => {
    await addPizza(page, { size: 'large', toppings: ['Onions', 'Pepperoni'] });
    await addPizza(page, { size: 'large', toppings: ['Pepperoni', 'Onions'] });
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
    await expect(cartLine(page, 'large', 'Pepperoni, Onions').getByTestId('line-total')).toHaveText('$36.00');
  });

  test('AC-2.3 changing quantities and removing pizzas updates the total', async ({ page }) => {
    await addPizza(page, { size: 'small', toppings: ['Mushrooms'] }); // 12
    await addPizza(page, { size: 'large' }); // 14
    const total = page.getByTestId('cart-total');
    await expect(total).toHaveText('$26.00');

    const mushroom = cartLine(page, 'small', 'Mushrooms');
    await mushroom.getByRole('button', { name: 'Increase quantity' }).click();
    await mushroom.getByRole('button', { name: 'Increase quantity' }).click();
    await expect(mushroom.getByTestId('line-total')).toHaveText('$36.00');
    await expect(total).toHaveText('$50.00');

    await mushroom.getByRole('button', { name: 'Decrease quantity' }).click();
    await expect(mushroom.getByTestId('line-total')).toHaveText('$24.00');
    await expect(total).toHaveText('$38.00');

    // Quantity can't drop below 1; use Remove instead.
    await mushroom.getByRole('button', { name: 'Decrease quantity' }).click();
    await expect(mushroom.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();

    await cartLine(page, 'large', 'Cheese only').getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
    await expect(total).toHaveText('$12.00');

    await mushroom.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByTestId('cart-line')).toHaveCount(0);
    await expect(total).toHaveText('$0.00');
    await expect(page.getByText('Your order is empty.')).toBeVisible();
  });

  test('the cart survives a page refresh', async ({ page }) => {
    await addPizza(page, { size: 'large', toppings: ['Onions'], quantity: 3 });
    await page.reload();
    await expect(cartLine(page, 'large', 'Onions').getByTestId('line-total')).toHaveText('$48.00');
  });
});

test.describe('3. Placing an order', () => {
  test('AC-3.1 an empty order cannot be submitted', async ({ page, app }) => {
    const before = (await app.listOrders()).length;
    await page.getByLabel('Name for pickup').fill('Empty Cart');
    await page.getByRole('button', { name: 'Place pickup order' }).click();

    await expect(page.getByText('Add at least one pizza before placing your order.')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Your order is in/ })).toHaveCount(0);
    expect((await app.listOrders()).length).toBe(before);
  });

  test('AC-3.1 an order without a name cannot be submitted (blank or spaces only)', async ({ page, app }) => {
    const before = (await app.listOrders()).length;
    await addPizza(page, { size: 'small' });

    await page.getByRole('button', { name: 'Place pickup order' }).click();
    await expect(page.getByText('Enter your name so we know whose order it is.')).toBeVisible();

    await page.getByLabel('Name for pickup').fill('    ');
    await page.getByRole('button', { name: 'Place pickup order' }).click();
    await expect(page.getByText('Enter your name so we know whose order it is.')).toBeVisible();

    await expect(page.getByRole('heading', { name: /Your order is in/ })).toHaveCount(0);
    expect((await app.listOrders()).length).toBe(before);
  });

  test('AC-3.2 / AC-3.3 confirmation shows number, name, items, and total; kitchen receives it', async ({ page, app }) => {
    await addPizza(page, { size: 'small', toppings: ['Pepperoni'] });
    await addPizza(page, { size: 'large', toppings: ['Mushrooms', 'Green peppers'], quantity: 2 });
    await page.getByLabel('Name for pickup').fill('  Avery  ');
    await page.getByRole('button', { name: 'Place pickup order' }).click();

    // AC-3.2: confirmation
    await expect(page.getByRole('heading', { name: 'Thanks, Avery! Your order is in.' })).toBeVisible();
    const numberText = await page.getByTestId('order-number').textContent();
    const orderId = Number(numberText.replace('#', ''));
    expect(orderId).toBeGreaterThan(0);

    const items = page.getByTestId('order-item');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('1×');
    await expect(items.nth(0)).toContainText('Small (10")');
    await expect(items.nth(0)).toContainText('Pepperoni');
    await expect(items.nth(0)).toContainText('$12.00');
    await expect(items.nth(1)).toContainText('2×');
    await expect(items.nth(1)).toContainText('Large (14")');
    await expect(items.nth(1)).toContainText('Mushrooms, Green peppers');
    await expect(items.nth(1)).toContainText('$36.00');
    await expect(page.getByTestId('order-total')).toHaveText('$48.00');
    await expect(page.getByText('Pay at the counter when you pick up.')).toBeVisible();

    // AC-3.3: saved as New and visible to the kitchen
    const saved = (await app.listOrders()).find((o) => o.id === orderId);
    expect(saved).toMatchObject({ customerName: 'Avery', status: 'New', totalCents: 4800 });

    await page.getByRole('link', { name: 'Kitchen' }).click();
    const card = page.locator(`[data-order-id="${orderId}"]`);
    await expect(card).toContainText('Avery');
    await expect(card).toContainText('New');

    // Starting over gives an empty cart.
    await page.getByRole('link', { name: 'Order', exact: true }).click();
    await expect(page.getByText('Your order is empty.')).toBeVisible();
  });
});

test.describe('5. Additional expectations', () => {
  test('prices are shown as plain dollar amounts with no taxes or fees added', async ({ page }) => {
    await addPizza(page, { size: 'large', toppings: ['Pepperoni'] });
    const cart = page.getByRole('region', { name: /Your order/ });
    await expect(cart).not.toContainText(/tax|fee|delivery|coupon/i);
    await expect(page.getByTestId('cart-total')).toHaveText('$16.00');
    await expect(cart).toContainText("No payment now. You'll pay at the counter.");
  });

  test('if the order cannot be submitted, the customer is told and keeps their cart', async ({ page, app }) => {
    await addPizza(page, { size: 'small', toppings: ['Onions'] });
    await page.getByLabel('Name for pickup').fill('Offline');

    await app.kill();
    try {
      await page.getByRole('button', { name: 'Place pickup order' }).click();
      await expect(page.getByRole('alert')).toContainText('Your order was not placed.');
      await expect(page.getByRole('heading', { name: /Your order is in/ })).toHaveCount(0);
      await expect(cartLine(page, 'small', 'Onions')).toBeVisible();
    } finally {
      await app.start();
    }

    // Once the shop is reachable again, the same cart submits fine.
    await page.getByRole('button', { name: 'Place pickup order' }).click();
    await expect(page.getByRole('heading', { name: 'Thanks, Offline! Your order is in.' })).toBeVisible();
  });
});
