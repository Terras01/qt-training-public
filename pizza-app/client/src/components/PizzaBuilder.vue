<script setup>
import { computed, ref } from 'vue';
import { formatCents } from '../money.js';
import { pizzaUnitPrice } from '../pricing.js';
import { MAX_QUANTITY } from '../cart.js';

const props = defineProps({
  menu: { type: Object, required: true },
});
const emit = defineEmits(['add']);

const sizeId = ref(props.menu.sizes[0]?.id);
const toppingIds = ref([]);
const quantity = ref(1);
const justAdded = ref(false);

const selectedSize = computed(() => props.menu.sizes.find((s) => s.id === sizeId.value));
const selectedToppings = computed(() => props.menu.toppings.filter((t) => toppingIds.value.includes(t.id)));
const unitPrice = computed(() => pizzaUnitPrice(props.menu, sizeId.value, toppingIds.value));

function changeQuantity(delta) {
  quantity.value = Math.min(MAX_QUANTITY, Math.max(1, quantity.value + delta));
}

function add() {
  emit('add', { sizeId: sizeId.value, toppingIds: [...toppingIds.value], quantity: quantity.value });
  toppingIds.value = [];
  quantity.value = 1;
  justAdded.value = true;
  setTimeout(() => (justAdded.value = false), 2000);
}
</script>

<template>
  <section class="card builder" aria-labelledby="builder-heading">
    <h2 id="builder-heading">Build your pizza</h2>

    <fieldset>
      <legend>1. Choose a size</legend>
      <div class="option-grid">
        <label v-for="size in menu.sizes" :key="size.id" class="option" :class="{ selected: sizeId === size.id }">
          <input v-model="sizeId" type="radio" name="size" :value="size.id" />
          <span class="option-name">{{ size.name }} ({{ size.inches }}")</span>
          <span class="option-price">{{ formatCents(size.priceCents) }}</span>
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend>2. Add toppings <span class="hint">(optional, +{{ formatCents(menu.toppings[0]?.priceCents ?? 0) }} each)</span></legend>
      <div class="option-grid">
        <label
          v-for="topping in menu.toppings"
          :key="topping.id"
          class="option"
          :class="{ selected: toppingIds.includes(topping.id) }"
        >
          <input v-model="toppingIds" type="checkbox" :value="topping.id" />
          <span class="option-name">{{ topping.name }}</span>
          <span class="option-price">+{{ formatCents(topping.priceCents) }}</span>
        </label>
      </div>
      <p class="hint">Leave all unchecked for a plain cheese pizza.</p>
    </fieldset>

    <div class="price-summary" aria-live="polite">
      <div class="breakdown">
        <div class="row">
          <span>{{ selectedSize?.name }} ({{ selectedSize?.inches }}") cheese pizza</span>
          <span>{{ formatCents(selectedSize?.priceCents ?? 0) }}</span>
        </div>
        <div v-for="t in selectedToppings" :key="t.id" class="row">
          <span>+ {{ t.name }}</span>
          <span>{{ formatCents(t.priceCents) }}</span>
        </div>
      </div>
      <div class="row total-row">
        <span>Price per pizza</span>
        <strong>{{ formatCents(unitPrice) }}</strong>
      </div>
    </div>

    <div class="add-row">
      <div class="stepper" role="group" aria-label="Quantity">
        <button type="button" :disabled="quantity <= 1" aria-label="Decrease quantity" @click="changeQuantity(-1)">−</button>
        <span class="qty" aria-live="polite">{{ quantity }}</span>
        <button type="button" :disabled="quantity >= MAX_QUANTITY" aria-label="Increase quantity" @click="changeQuantity(1)">+</button>
      </div>
      <button type="button" class="btn primary" @click="add">
        Add {{ quantity > 1 ? `${quantity} pizzas` : 'to order' }} · {{ formatCents(unitPrice * quantity) }}
      </button>
    </div>
    <p v-if="justAdded" class="added-msg" role="status">✓ Added to your order</p>
  </section>
</template>
