
<script setup lang="ts">
import type { RegistrationPayload } from "~/types/auth";
import { dashboardRouteForRole } from "~/types/auth";

definePageMeta({ layout: "auth" });

const storageKey = "dormease-registration";
const auth = useDormEaseAuth();

const isProvisioning = ref(true);
const isCompleted = ref(false);
const errorMessage = ref("");
const dashboardPath = ref("");

function getRegistrationChoice(): RegistrationPayload {
  const raw = window.sessionStorage.getItem(storageKey);

  if (!raw) return { accountType: "TENANT" };

  const value: unknown = JSON.parse(raw);

  if (
    typeof value !== "object" ||
    value === null ||
    !("accountType" in value)
  ) {
    throw new Error("Registration details are invalid. Please restart signup.");
  }

  if (
    value.accountType !== "TENANT" &&
    value.accountType !== "ADMIN"
  ) {
    throw new Error("Registration details are invalid. Please restart signup.");
  }

  let invitationCode: string | undefined;

  if ("invitationCode" in value) {
    if (typeof value.invitationCode !== "string") {
      throw new Error("Registration details are invalid. Please restart signup.");
    }

    invitationCode = value.invitationCode;
  }

  return {
    accountType: value.accountType,
    ...(invitationCode ? { invitationCode } : {}),
  };
}

async function completeRegistration() {
  isProvisioning.value = true;
  errorMessage.value = "";
  isCompleted.value = false;

  try {
    const restored = await auth.restoreSession(
      getRegistrationChoice()
    );

    if (!restored || !auth.role.value) {
      await navigateTo("/login", { replace: true });
      return;
    }

    // Determine the correct dashboard
    dashboardPath.value = dashboardRouteForRole(auth.role.value);

    // Remove temporary registration information
    window.sessionStorage.removeItem(storageKey);

    // Display success screen instead of redirecting immediately
    isCompleted.value = true;

  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Unable to link your DormEase account.";
  } finally {
    isProvisioning.value = false;
  }
}

onMounted(() => {
  void completeRegistration();
});
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-50 p-6">

    <div class="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">

      <!-- Loading -->
      <div v-if="isProvisioning" class="py-8">
        <div class="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>

        <h1 class="text-xl font-bold text-slate-900">
          Setting up your account
        </h1>

        <p class="mt-2 text-sm text-slate-500">
          Please wait while we finish your DormEase registration.
        </p>
      </div>

      <!-- Success -->
      <div v-else-if="isCompleted" class="py-6">

        <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <svg
            class="h-10 w-10 text-green-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path
              d="m5 12 4 4L19 6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>

        <p class="mb-2 text-sm font-semibold uppercase tracking-wider text-green-600">
          Registration Complete
        </p>

        <h1 class="text-3xl font-bold text-slate-900">
          Account Created Successfully!
        </h1>

        <p class="mt-4 leading-7 text-slate-500">
          Congratulations! Your DormEase account has been successfully
          created and verified. You can now access your account and
          start using DormEase.
        </p>

        <NuxtLink
          :to="dashboardPath"
          class="mt-8 flex w-full items-center justify-center rounded-xl bg-brand-700 px-6 py-3 font-semibold text-white transition hover:bg-brand-800"
        >
          Continue to Dashboard
        </NuxtLink>

        <p class="mt-5 text-xs text-slate-400">
          Thank you for joining DormEase!
        </p>
      </div>

      <!-- Error -->
      <div v-else-if="errorMessage" role="alert" class="py-6">

        <div class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <span class="text-3xl text-red-600">!</span>
        </div>

        <h1 class="text-2xl font-bold text-slate-900">
          Account Setup Needs Attention
        </h1>

        <p class="mt-3 text-sm text-red-600">
          {{ errorMessage }}
        </p>

        <button
          class="mt-6 font-semibold text-brand-600 hover:text-brand-700"
          @click="completeRegistration"
        >
          Try Again
        </button>

        <div class="mt-4">
          <NuxtLink
            to="/register"
            class="text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            Back to Registration
          </NuxtLink>
        </div>
      </div>

    </div>
  </main>
</template>
