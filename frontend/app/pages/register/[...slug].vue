
<script setup lang="ts">
definePageMeta({
  layout: "auth",
});
</script>

<template>
  <main class="flex min-h-screen items-center justify-center p-6">
    <SignUp
      path="/register"
      routing="path"
      sign-in-url="/login"
      force-redirect-url="/auth/complete"
      fallback-redirect-url="/auth/complete"
    />
  </main>
</template>
