<script setup lang="ts">
import { dashboardRouteForRole } from "~/types/auth";

definePageMeta({ layout: "auth" });

const route = useRoute();
const clerkAuth = useAuth();
const auth = useDormEaseAuth();
const isRestoring = ref(false);
const retryError = ref("");
const authError = computed(() =>
  route.query.authError === "verify-email"
    ? "Verify your primary email address with Clerk, then sign in again."
    : route.query.authError === "session"
      ? "We couldn't verify your DormEase session. Please try again."
      : "",
);

async function retryProfileRestoration() {
  isRestoring.value = true;
  retryError.value = "";
  try {
    const restored = await auth.restoreSession();
    if (!restored || !auth.role.value) {
      retryError.value =
        "Your DormEase account is not linked to this Clerk session.";
      return;
    }
    await navigateTo(dashboardRouteForRole(auth.role.value), {
      replace: true,
    });
  } catch (error) {
    retryError.value =
      getErrorStatus(error) === 403
        ? "Verify your primary email address with Clerk, then retry."
        : "We couldn't restore your DormEase profile. You can retry or sign out.";
  } finally {
    isRestoring.value = false;
  }
}

function getErrorStatus(error: unknown) {
  if (typeof error !== "object" || error === null) return undefined;
  if ("statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }
  if ("status" in error && typeof error.status === "number") {
    return error.status;
  }
  return undefined;
}

async function signOut() {
  await auth.logout();
}
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
              d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M9 9h.01M15 9h.01"
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
          Dormitory management, simplified
        </p>
        <h1 class="text-4xl font-bold leading-tight xl:text-5xl">
          A better way to run your residence.
        </h1>
        <p class="mt-6 text-lg leading-8 text-blue-100/80">
          Keep rooms, residents, payments, and maintenance in one clear,
          dependable workspace.
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
          <p class="mb-2 text-sm font-semibold text-brand-600">Welcome back</p>
          <h2 class="text-3xl font-bold tracking-tight text-slate-900">
            Sign in to DormEase
          </h2>
          <p class="mt-3 text-slate-500">
            Sign in securely to access your DormEase account.
          </p>
        </div>

        <div
          v-if="authError"
          role="alert"
          class="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          {{ authError }}
        </div>

        <ClientOnly>
          <div v-if="authError && clerkAuth.isSignedIn.value" class="space-y-4">
            <p v-if="retryError" role="alert" class="text-sm text-red-600">
              {{ retryError }}
            </p>
            <div class="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                :disabled="isRestoring"
                class="rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white disabled:opacity-60"
                @click="retryProfileRestoration"
              >
                {{ isRestoring ? "Retrying..." : "Retry profile restoration" }}
              </button>
              <button
                type="button"
                class="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700"
                @click="signOut"
              >
                Sign out
              </button>
            </div>
            <p
              v-if="auth.logoutError.value"
              role="alert"
              class="text-sm text-red-600"
            >
              {{ auth.logoutError.value }}
            </p>
          </div>
          <SignIn
            v-else
            :path="route.path"
            routing="path"
            sign-up-url="/register"
            force-redirect-url="/dashboard"
            fallback-redirect-url="/dashboard"
          />
          <template #fallback>
            <div class="min-h-[24rem]" aria-hidden="true" />
          </template>
        </ClientOnly>
      </div>
    </section>
  </main>
</template>
