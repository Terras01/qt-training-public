<script setup>
import OrderItems from './OrderItems.vue';

defineProps({
  order: { type: Object, required: true },
  busy: { type: Boolean, default: false },
});
const emit = defineEmits(['set-status']);

const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
</script>

<template>
  <article class="card order-card" :data-order-id="order.id" :class="order.status === 'Ready' ? 'is-ready' : 'is-new'">
    <header class="order-card-head">
      <div>
        <div class="order-id">#{{ order.id }}</div>
        <div class="order-name">{{ order.customerName }}</div>
      </div>
      <div class="order-meta">
        <span class="badge" :class="order.status === 'Ready' ? 'badge-ready' : 'badge-new'">{{ order.status }}</span>
        <time :datetime="order.createdAt">Placed {{ formatTime(order.createdAt) }}</time>
      </div>
    </header>

    <OrderItems :order="order" />

    <button
      v-if="order.status === 'New'"
      type="button"
      class="btn primary block"
      :disabled="busy"
      @click="emit('set-status', order, 'Ready')"
    >
      {{ busy ? 'Saving…' : 'Mark Ready' }}
    </button>
    <button v-else type="button" class="link-btn" :disabled="busy" @click="emit('set-status', order, 'New')">
      Undo, move back to New
    </button>
  </article>
</template>
