<script setup lang="ts">
definePageMeta({ layout: "auth" });
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-xl flex-col justify-center p-8">
    <h1 class="text-2xl font-bold">Password recovery moved to Clerk</h1>
    <p class="mt-3 text-slate-600">
      Use the password recovery link on the DormEase sign-in form to reset your
      password securely.
    </p>
    <NuxtLink
      to="/login"
      class="mt-6 font-semibold text-brand-600 hover:text-brand-700"
    >
      Continue to sign in
    </NuxtLink>
  </main>
</template>
