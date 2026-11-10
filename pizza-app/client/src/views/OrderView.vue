<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '../api.js';
import { cart, addPizza, setQuantity, removeLine, clearCart, pruneCart } from '../cart.js';
import { cartTotal } from '../pricing.js';
import PizzaBuilder from '../components/PizzaBuilder.vue';
import CartList from '../components/CartList.vue';
import OrderConfirmation from '../components/OrderConfirmation.vue';

const MAX_NAME_LENGTH = 60;

const menu = ref(null);
const loadError = ref('');
const submitting = ref(false);
const submitError = ref('');
const triedSubmit = ref(false);
const confirmedOrder = ref(null);

const total = computed(() => (menu.value ? cartTotal(menu.value, cart.lines) : 0));
const pizzaCount = computed(() => cart.lines.reduce((n, l) => n + l.quantity, 0));
const nameMissing = computed(() => cart.customerName.trim() === '');
const cartEmpty = computed(() => cart.lines.length === 0);
const canSubmit = computed(() => !nameMissing.value && !cartEmpty.value && !submitting.value);

async function loadMenu() {
  loadError.value = '';
  try {
    menu.value = await api.getMenu();
    pruneCart(menu.value);
  } catch (err) {
    loadError.value = err.message;
  }
}
onMounted(loadMenu);

function onAdd({ sizeId, toppingIds, quantity }) {
  addPizza(menu.value, sizeId, toppingIds, quantity);
  submitError.value = '';
}

async function placeOrder() {
  triedSubmit.value = true;
  submitError.value = '';
  if (!canSubmit.value) return;

  submitting.value = true;
  try {
    const order = await api.placeOrder({
      customerName: cart.customerName.trim(),
      items: cart.lines.map(({ sizeId, toppingIds, quantity }) => ({ sizeId, toppingIds, quantity })),
    });
    confirmedOrder.value = order;
    clearCart();
    triedSubmit.value = false;
    window.scrollTo({ top: 0 });
  } catch (err) {
    submitError.value = `Your order was not placed. ${err.message}`;
  } finally {
    submitting.value = false;
  }
}

function startNewOrder() {
  confirmedOrder.value = null;
}
</script>

<template>
  <OrderConfirmation v-if="confirmedOrder" :order="confirmedOrder" @new-order="startNewOrder" />

  <template v-else>
    <div class="page-intro">
      <h1>Order for pickup</h1>
      <p>Build your pizzas, review your order, and we'll have it ready. Pay at the counter when you arrive.</p>
    </div>

    <div v-if="loadError" class="alert error" role="alert">
      {{ loadError }}
      <button type="button" class="btn" @click="loadMenu">Try again</button>
    </div>
    <p v-else-if="!menu" class="loading">Loading menu…</p>

    <div v-else class="order-layout">
      <PizzaBuilder :menu="menu" @add="onAdd" />

      <section class="card cart" aria-labelledby="cart-heading">
        <h2 id="cart-heading">
          Your order
          <span v-if="pizzaCount" class="count">({{ pizzaCount }} {{ pizzaCount === 1 ? 'pizza' : 'pizzas' }})</span>
        </h2>

        <CartList
          :menu="menu"
          :lines="cart.lines"
          :total="total"
          :disabled="submitting"
          @set-quantity="setQuantity"
          @remove="removeLine"
        />

        <form class="checkout" novalidate @submit.prevent="placeOrder">
          <label for="customer-name">Name for pickup</label>
          <input
            id="customer-name"
            v-model="cart.customerName"
            type="text"
            autocomplete="given-name"
            :maxlength="MAX_NAME_LENGTH"
            placeholder="Your name"
            :disabled="submitting"
            :aria-invalid="triedSubmit && nameMissing"
            aria-describedby="checkout-help"
          />

          <div id="checkout-help" class="field-help" aria-live="polite">
            <p v-if="triedSubmit && cartEmpty" class="field-error">Add at least one pizza before placing your order.</p>
            <p v-if="triedSubmit && nameMissing" class="field-error">Enter your name so we know whose order it is.</p>
          </div>

          <div v-if="submitError" class="alert error" role="alert">{{ submitError }}</div>

          <!-- Stays clickable when the order is incomplete: clicking shows what's missing (see field-help). -->
          <button type="submit" class="btn primary block" :disabled="submitting">
            {{ submitting ? 'Placing order…' : 'Place pickup order' }}
          </button>
          <p class="hint center">No payment now. You'll pay at the counter.</p>
        </form>
      </section>
    </div>
  </template>
</template>
