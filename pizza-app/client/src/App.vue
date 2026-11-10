<script setup>
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <header class="site-header">
    <div class="container header-inner">
      <RouterLink to="/" class="brand">🍕 Neighborhood Pizza</RouterLink>
      <nav aria-label="Main">
        <RouterLink to="/" class="nav-link" exact-active-class="active">Order</RouterLink>
        <RouterLink to="/kitchen" class="nav-link" active-class="active">Kitchen</RouterLink>
      </nav>
    </div>
  </header>
  <main class="container">
    <RouterView />
  </main>
</template>
