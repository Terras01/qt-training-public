import { createRouter, createWebHistory } from 'vue-router';
import OrderView from './views/OrderView.vue';
import KitchenView from './views/KitchenView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: OrderView, meta: { title: 'Order for Pickup' } },
    { path: '/kitchen', component: KitchenView, meta: { title: 'Kitchen Orders' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.afterEach((to) => {
  document.title = `Neighborhood Pizza · ${to.meta.title ?? ''}`;
});
