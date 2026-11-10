<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { api } from '../api.js';
import OrderCard from '../components/OrderCard.vue';

const REFRESH_MS = 5000;

const orders = ref([]);
const loaded = ref(false);
const error = ref('');
const lastUpdated = ref(null);
const busyIds = ref(new Set());
let timer = null;
let inFlight = false;

const newOrders = computed(() => orders.value.filter((o) => o.status === 'New'));
// Most recently finished first, so the counter sees the latest ready orders at the top.
const readyOrders = computed(() =>
  orders.value.filter((o) => o.status === 'Ready').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
);

async function refresh() {
  if (inFlight) return;
  inFlight = true;
  try {
    orders.value = await api.listOrders();
    lastUpdated.value = new Date();
    error.value = '';
  } catch (err) {
    error.value = `${err.message} Retrying automatically.`;
  } finally {
    inFlight = false;
    loaded.value = true;
  }
}

async function setStatus(order, status) {
  busyIds.value = new Set(busyIds.value).add(order.id);
  try {
    const updated = await api.setStatus(order.id, status);
    orders.value = orders.value.map((o) => (o.id === updated.id ? updated : o));
    error.value = '';
  } catch (err) {
    error.value = `Couldn't update order #${order.id}. ${err.message}`;
  } finally {
    const next = new Set(busyIds.value);
    next.delete(order.id);
    busyIds.value = next;
  }
}

onMounted(() => {
  refresh();
  timer = setInterval(refresh, REFRESH_MS);
});
onUnmounted(() => clearInterval(timer));

const updatedText = computed(() =>
  lastUpdated.value ? lastUpdated.value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '',
);
</script>

<template>
  <div class="page-intro kitchen-intro">
    <div>
      <h1>Kitchen orders</h1>
      <p>New orders show up automatically. Mark each one Ready when it's done.</p>
    </div>
    <div class="refresh">
      <span v-if="lastUpdated" class="hint">Updated {{ updatedText }}</span>
      <button type="button" class="btn" @click="refresh">Refresh now</button>
    </div>
  </div>

  <div v-if="error" class="alert error" role="alert">{{ error }}</div>
  <p v-if="!loaded" class="loading">Loading orders…</p>

  <div v-else class="kitchen-board">
    <section aria-labelledby="new-heading">
      <h2 id="new-heading" class="column-heading">
        New <span class="count-pill">{{ newOrders.length }}</span>
      </h2>
      <p v-if="newOrders.length === 0" class="empty">No orders waiting. 🎉</p>
      <OrderCard
        v-for="order in newOrders"
        :key="order.id"
        :order="order"
        :busy="busyIds.has(order.id)"
        @set-status="setStatus"
      />
    </section>

    <section aria-labelledby="ready-heading">
      <h2 id="ready-heading" class="column-heading">
        Ready for pickup <span class="count-pill ready">{{ readyOrders.length }}</span>
      </h2>
      <p v-if="readyOrders.length === 0" class="empty">Nothing ready yet.</p>
      <OrderCard
        v-for="order in readyOrders"
        :key="order.id"
        :order="order"
        :busy="busyIds.has(order.id)"
        @set-status="setStatus"
      />
    </section>
  </div>
</template>
