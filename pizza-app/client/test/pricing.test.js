// The client shows prices before the order is placed; the server recalculates them.
// These tests pin the client math to the published menu so the two agree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pizzaUnitPrice, cartTotal, pizzaKey, describePizza } from '../src/pricing.js';
import { formatCents } from '../src/money.js';

const menu = {
  sizes: [
    { id: 'small', name: 'Small', inches: 10, priceCents: 1000 },
    { id: 'large', name: 'Large', inches: 14, priceCents: 1400 },
  ],
  toppings: [
    { id: 'pepperoni', name: 'Pepperoni', priceCents: 200 },
    { id: 'mushrooms', name: 'Mushrooms', priceCents: 200 },
    { id: 'onions', name: 'Onions', priceCents: 200 },
    { id: 'green-peppers', name: 'Green peppers', priceCents: 200 },
  ],
};
const all = menu.toppings.map((t) => t.id);

test('plain cheese pizzas cost the base size price', () => {
  assert.equal(pizzaUnitPrice(menu, 'small', []), 1000);
  assert.equal(pizzaUnitPrice(menu, 'large', []), 1400);
});

test('each topping adds $2.00 regardless of size, and removing one lowers the price', () => {
  assert.equal(pizzaUnitPrice(menu, 'small', ['pepperoni']), 1200);
  assert.equal(pizzaUnitPrice(menu, 'large', ['pepperoni']), 1600);
  assert.equal(pizzaUnitPrice(menu, 'small', all), 1800);
  assert.equal(pizzaUnitPrice(menu, 'large', all), 2200);
  assert.equal(pizzaUnitPrice(menu, 'large', ['pepperoni', 'onions']), 1800);
});

test('order total sums each line times its quantity', () => {
  const lines = [
    { sizeId: 'small', toppingIds: ['pepperoni'], quantity: 1 },
    { sizeId: 'large', toppingIds: all, quantity: 2 },
  ];
  assert.equal(cartTotal(menu, lines), 1200 + 4400);
  assert.equal(cartTotal(menu, []), 0);
});

test('the same pizza with toppings picked in a different order is treated as identical', () => {
  assert.equal(pizzaKey(menu, 'large', ['onions', 'pepperoni']), pizzaKey(menu, 'large', ['pepperoni', 'onions']));
  assert.notEqual(pizzaKey(menu, 'small', ['onions']), pizzaKey(menu, 'large', ['onions']));
});

test('pizza descriptions and money formatting', () => {
  assert.deepEqual(describePizza(menu, 'small', []), { size: 'Small (10")', toppings: 'Cheese only' });
  assert.deepEqual(describePizza(menu, 'large', ['onions', 'pepperoni']), {
    size: 'Large (14")',
    toppings: 'Pepperoni, Onions',
  });
  assert.equal(formatCents(5600), '$56.00');
  assert.equal(formatCents(1250), '$12.50');
});
