<script setup lang="ts">
definePageMeta({ layout: "auth" });
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-3xl justify-center p-8">
    <UserProfile path="/account" routing="path" />
  </main>
</template>
