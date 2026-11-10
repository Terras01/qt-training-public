<script setup>
// Read-only list of items on a placed order (used by the confirmation and the kitchen board).
import { formatCents } from '../money.js';

defineProps({
  order: { type: Object, required: true },
});
</script>

<template>
  <ul class="order-items">
    <li v-for="item in order.items" :key="item.id" data-testid="order-item">
      <span class="item-qty">{{ item.quantity }}×</span>
      <span class="item-desc">
        <strong>{{ item.size.name }} ({{ item.size.inches }}")</strong>
        <span class="item-toppings">{{ item.toppings.length ? item.toppings.map((t) => t.name).join(', ') : 'Cheese only' }}</span>
      </span>
      <span class="item-price">{{ formatCents(item.lineTotalCents) }}</span>
    </li>
  </ul>
  <div class="row order-total">
    <span>Total</span>
    <strong data-testid="order-total">{{ formatCents(order.totalCents) }}</strong>
  </div>
</template>
