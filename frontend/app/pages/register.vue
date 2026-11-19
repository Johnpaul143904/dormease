<script setup lang="ts">
import type { RegistrationPayload } from "~/types/auth";

definePageMeta({ layout: "auth" });

const storageKey = "dormease-registration";
const accountType = ref<"TENANT" | "ADMIN">("TENANT");
const invitationCode = ref("");

function saveRegistrationChoice() {
  if (!import.meta.client) return;
  const payload: RegistrationPayload = {
    accountType: accountType.value,
    ...(accountType.value === "ADMIN" && invitationCode.value
      ? { invitationCode: invitationCode.value }
      : {}),
  };
  window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
}

watch([accountType, invitationCode], saveRegistrationChoice, {
  immediate: true,
});
</script>

<template>
  <main class="flex min-h-screen">
    <section
      class="hidden w-[42%] flex-col justify-between bg-brand-900 p-10 text-white lg:flex xl:p-14"
    >
      <NuxtLink
        to="/login"
        class="flex items-center gap-3 text-lg font-bold tracking-tight"
      >
        <span
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-700 shadow-lg shadow-blue-950/20"
        >
          <svg
            class="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        DormEase
      </NuxtLink>
      <div class="max-w-md">
        <p
          class="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-blue-200"
        >
          Get started today
        </p>
        <h1 class="text-4xl font-bold leading-tight xl:text-5xl">
          Everything your dorm needs, in one place.
        </h1>
        <p class="mt-6 text-lg leading-8 text-blue-100/80">
          Create your DormEase account and bring clarity to your day-to-day
          operations.
        </p>
      </div>
      <p class="text-sm text-blue-200/70">
        © {{ new Date().getFullYear() }} DormEase. Built for better living.
      </p>
    </section>

    <section
      class="flex w-full items-center justify-center px-6 py-10 sm:px-10 lg:w-[58%] lg:px-16"
    >
      <div class="w-full max-w-md">
        <div class="mb-8">
          <p class="mb-2 text-sm font-semibold text-brand-600">
            Create your account
          </p>
          <h2 class="text-3xl font-bold tracking-tight text-slate-900">
            Join DormEase
          </h2>
          <p class="mt-3 text-slate-500">
            Clerk securely manages your sign-in and password.
          </p>
        </div>

        <fieldset class="mb-6 space-y-3">
          <legend class="mb-2 text-sm font-medium text-slate-700">
            Account type
          </legend>
          <label class="flex items-center gap-3 text-sm text-slate-700">
            <input
              v-model="accountType"
              type="radio"
              value="TENANT"
              class="text-brand-600 focus:ring-brand-500"
            />
            Tenant
          </label>
          <label class="flex items-center gap-3 text-sm text-slate-700">
            <input
              v-model="accountType"
              type="radio"
              value="ADMIN"
              class="text-brand-600 focus:ring-brand-500"
            />
            Admin (invitation code required)
          </label>
          <label v-if="accountType === 'ADMIN'" class="block text-sm font-medium">
            Admin invitation code
            <input
              v-model="invitationCode"
              type="password"
              autocomplete="off"
              class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
            />
          </label>
        </fieldset>

        <SignUp
          path="/register"
          routing="path"
          sign-in-url="/login"
          force-redirect-url="/auth/complete"
          fallback-redirect-url="/auth/complete"
        />
      </div>
    </section>
  </main>
</template>
