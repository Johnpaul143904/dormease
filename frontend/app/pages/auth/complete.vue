<script setup lang="ts">
import type { RegistrationPayload } from "~/types/auth";
import { dashboardRouteForRole } from "~/types/auth";

definePageMeta({ layout: "auth" });

const storageKey = "dormease-registration";
const auth = useDormEaseAuth();
const isProvisioning = ref(true);
const errorMessage = ref("");

function getRegistrationChoice(): RegistrationPayload {
  const raw = window.sessionStorage.getItem(storageKey);
  if (!raw) return { accountType: "TENANT" };

  const value: unknown = JSON.parse(raw);
  if (typeof value !== "object" || value === null || !("accountType" in value)) {
    throw new Error("Registration details are invalid. Please restart signup.");
  }
  if (value.accountType !== "TENANT" && value.accountType !== "ADMIN") {
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
  try {
    const restored = await auth.restoreSession(getRegistrationChoice());
    if (!restored || !auth.role.value) {
      await navigateTo("/login", { replace: true });
      return;
    }
    window.sessionStorage.removeItem(storageKey);
    await navigateTo(dashboardRouteForRole(auth.role.value), {
      replace: true,
    });
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
  <main class="mx-auto flex min-h-screen max-w-xl flex-col justify-center p-8">
    <p v-if="isProvisioning" role="status" class="text-slate-600">
      Finishing your DormEase account setup…
    </p>
    <div v-else-if="errorMessage" role="alert">
      <h1 class="text-2xl font-bold">Account setup needs attention</h1>
      <p class="mt-3 text-rose-700">{{ errorMessage }}</p>
      <div class="mt-6 flex gap-4">
        <button
          class="font-semibold text-brand-600 hover:text-brand-700"
          @click="completeRegistration"
        >
          Try again
        </button>
        <NuxtLink
          to="/register"
          class="font-semibold text-brand-600 hover:text-brand-700"
        >
          Review registration details
        </NuxtLink>
      </div>
    </div>
  </main>
</template>
