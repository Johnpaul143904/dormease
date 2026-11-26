<script setup lang="ts">
const auth = useDormEaseAuth();

definePageMeta({
  layout: 'default',
})
</script>

<template>
  <main class="min-h-screen bg-slate-50 p-4 sm:p-8">
    <div class="mx-auto max-w-5xl">
      <header class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 sm:text-3xl">
            Staff dashboard
          </h1>
          <p class="mt-2 text-slate-500">
            Welcome to your authorized staff workspace.
          </p>
        </div>
        <button
          type="button"
          class="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          @click="auth.logout()"
        >
          Logout
        </button>
      </header>
      <p
        v-if="auth.logoutError.value"
        class="mt-4 text-sm text-rose-700"
        role="alert"
      >
        {{ auth.logoutError.value }}
      </p>
    </div>
  </main>
</template>
