<script setup>
import { onMounted, ref } from 'vue';
import OrderItems from './OrderItems.vue';

defineProps({
  order: { type: Object, required: true },
});
const emit = defineEmits(['new-order']);

const heading = ref(null);
onMounted(() => heading.value?.focus());
</script>

<template>
  <section class="card confirmation" role="status" aria-labelledby="confirm-heading">
    <div class="check" aria-hidden="true">✓</div>
    <h2 id="confirm-heading" ref="heading" tabindex="-1">Thanks, {{ order.customerName }}! Your order is in.</h2>
    <p class="order-number">
      Order number <strong>#{{ order.id }}</strong>
    </p>
    <p>We've sent your order to the kitchen. Give the order number or your name at the counter when you pick up.</p>

    <OrderItems :order="order" />

    <p class="pay-note">Pay at the counter when you pick up.</p>
    <button type="button" class="btn primary" @click="emit('new-order')">Start a new order</button>
  </section>
</template>
