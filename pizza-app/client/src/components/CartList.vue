<script setup>
import { formatCents } from '../money.js';
import { describePizza, pizzaUnitPrice, lineTotal } from '../pricing.js';
import { MAX_QUANTITY } from '../cart.js';

defineProps({
  menu: { type: Object, required: true },
  lines: { type: Array, required: true },
  total: { type: Number, required: true },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['set-quantity', 'remove']);
</script>

<template>
  <div>
    <p v-if="lines.length === 0" class="empty">Your order is empty. Build a pizza and add it to get started.</p>

    <ul v-else class="cart-lines">
      <li v-for="line in lines" :key="line.key" class="cart-line">
        <div class="line-info">
          <div class="line-title">{{ describePizza(menu, line.sizeId, line.toppingIds).size }}</div>
          <div class="line-toppings">{{ describePizza(menu, line.sizeId, line.toppingIds).toppings }}</div>
          <div class="line-unit">{{ formatCents(pizzaUnitPrice(menu, line.sizeId, line.toppingIds)) }} each</div>
        </div>
        <div class="line-controls">
          <div class="stepper small" role="group" aria-label="Quantity">
            <button
              type="button"
              :disabled="disabled || line.quantity <= 1"
              aria-label="Decrease quantity"
              @click="emit('set-quantity', line.key, line.quantity - 1)"
            >
              −
            </button>
            <span class="qty">{{ line.quantity }}</span>
            <button
              type="button"
              :disabled="disabled || line.quantity >= MAX_QUANTITY"
              aria-label="Increase quantity"
              @click="emit('set-quantity', line.key, line.quantity + 1)"
            >
              +
            </button>
          </div>
          <strong class="line-total">{{ formatCents(lineTotal(menu, line)) }}</strong>
          <button type="button" class="link-btn" :disabled="disabled" @click="emit('remove', line.key)">Remove</button>
        </div>
      </li>
    </ul>

    <div class="row order-total" aria-live="polite">
      <span>Total</span>
      <strong>{{ formatCents(total) }}</strong>
    </div>
  </div>
</template>
