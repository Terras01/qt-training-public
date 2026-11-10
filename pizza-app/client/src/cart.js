import { reactive, watch } from 'vue';
import { pizzaKey, sortToppingIds } from './pricing.js';

export const MAX_QUANTITY = 99;
const STORAGE_KEY = 'neighborhood-pizza-cart';

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

// Kept in localStorage so refreshing the page doesn't empty the customer's cart.
export const cart = reactive({ lines: load(), customerName: '' });

watch(
  () => cart.lines,
  (lines) => localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)),
  { deep: true },
);

const clampQuantity = (q) => Math.min(MAX_QUANTITY, Math.max(1, Math.floor(q)));

export function addPizza(menu, sizeId, toppingIds, quantity) {
  const key = pizzaKey(menu, sizeId, toppingIds);
  const existing = cart.lines.find((l) => l.key === key);
  if (existing) {
    existing.quantity = clampQuantity(existing.quantity + quantity);
  } else {
    cart.lines.push({
      key,
      sizeId,
      toppingIds: sortToppingIds(menu, toppingIds),
      quantity: clampQuantity(quantity),
    });
  }
}

export function setQuantity(key, quantity) {
  const line = cart.lines.find((l) => l.key === key);
  if (line && Number.isFinite(quantity)) line.quantity = clampQuantity(quantity);
}

export function removeLine(key) {
  cart.lines = cart.lines.filter((l) => l.key !== key);
}

export function clearCart() {
  cart.lines = [];
  cart.customerName = '';
}

/** Drops saved lines that no longer match the menu (e.g. a topping was removed). */
export function pruneCart(menu) {
  const sizes = new Set(menu.sizes.map((s) => s.id));
  const toppings = new Set(menu.toppings.map((t) => t.id));
  cart.lines = cart.lines.filter(
    (l) =>
      l &&
      sizes.has(l.sizeId) &&
      Array.isArray(l.toppingIds) &&
      l.toppingIds.every((id) => toppings.has(id)) &&
      Number.isInteger(l.quantity) &&
      l.quantity >= 1,
  );
}
