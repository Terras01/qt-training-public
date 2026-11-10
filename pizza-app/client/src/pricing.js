// Pricing used for on-screen display. The server recalculates every price from
// the same menu when the order is placed, so the two must stay in agreement.

/** Toppings in menu order, so "Pepperoni, Onions" always reads the same way. */
export function sortToppingIds(menu, toppingIds) {
  const order = new Map(menu.toppings.map((t, i) => [t.id, i]));
  return [...toppingIds].sort((a, b) => order.get(a) - order.get(b));
}

/** Identical pizzas (same size and toppings) share a key so they merge into one cart line. */
export function pizzaKey(menu, sizeId, toppingIds) {
  return [sizeId, ...sortToppingIds(menu, toppingIds)].join('|');
}

export function pizzaUnitPrice(menu, sizeId, toppingIds) {
  const size = menu.sizes.find((s) => s.id === sizeId);
  if (!size) return 0;
  return toppingIds.reduce((sum, id) => {
    const topping = menu.toppings.find((t) => t.id === id);
    return sum + (topping ? topping.priceCents : 0);
  }, size.priceCents);
}

export function lineTotal(menu, line) {
  return pizzaUnitPrice(menu, line.sizeId, line.toppingIds) * line.quantity;
}

export function cartTotal(menu, lines) {
  return lines.reduce((sum, line) => sum + lineTotal(menu, line), 0);
}

/** "Large 14" · Pepperoni, Mushrooms" or "Small 10" · Cheese only" */
export function describePizza(menu, sizeId, toppingIds) {
  const size = menu.sizes.find((s) => s.id === sizeId);
  const names = sortToppingIds(menu, toppingIds).map((id) => menu.toppings.find((t) => t.id === id)?.name);
  return {
    size: size ? `${size.name} (${size.inches}")` : 'Unknown size',
    toppings: names.length ? names.join(', ') : 'Cheese only',
  };
}
