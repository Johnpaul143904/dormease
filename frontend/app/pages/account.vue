<script setup lang="ts">
definePageMeta({ layout: "auth" });
</script>

<template>
  <main
    class="mx-auto flex min-h-screen max-w-3xl justify-center p-4 sm:p-8"
  >
    <div class="w-full min-w-0 max-w-full">
      <UserProfile path="/account" routing="path" />
    </div>
  </main>
</template>
