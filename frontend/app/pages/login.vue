<script setup lang="ts">
import { dashboardRouteForRole } from "~/types/auth";

definePageMeta({
  layout: "auth",
});

const email = ref("");
const password = ref("");
const rememberMe = ref(false);
const showPassword = ref(false);
const isSubmitting = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const errors = reactive({
  email: "",
  password: "",
});
const authApi = useAuthApi();
const auth = useAuth();
const route = useRoute();

onMounted(() => {
  if (useRoute().query.registered === "1") {
    successMessage.value = "Account created successfully. You can now sign in.";
  }
});

function validate() {
  errors.email = "";
  errors.password = "";
  errorMessage.value = "";

  if (!email.value.trim()) {
    errors.email = "Email address is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    errors.email = "Enter a valid email address.";
  }

  if (!password.value) {
    errors.password = "Password is required.";
  }

  return !errors.email && !errors.password;
}

async function submitLogin() {
  successMessage.value = "";
  if (!validate()) return;

  const payload = authApi.createLoginPayload(email.value, password.value);
  isSubmitting.value = true;
  try {
    const response = await authApi.login(payload);
    auth.applySession(response, rememberMe.value);
    successMessage.value = "Login successful. Redirecting to your dashboard...";
    const requestedPath = route.query.redirect;
    const safeRedirect =
      typeof requestedPath === "string" &&
      requestedPath.startsWith("/") &&
      !requestedPath.startsWith("//") &&
      !requestedPath.includes("\\")
        ? requestedPath
        : dashboardRouteForRole(response.user.role);
    await navigateTo(safeRedirect, {
      replace: true,
    });
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Unable to sign in. Please check your credentials.";
  } finally {
    isSubmitting.value = false;
  }
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
        <div class="mb-10 flex items-center gap-3 lg:hidden">
          <span
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"
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
          <span class="text-xl font-bold text-slate-900">DormEase</span>
        </div>

        <div class="mb-8">
          <p class="mb-2 text-sm font-semibold text-brand-600">Welcome back</p>
          <h2 class="text-3xl font-bold tracking-tight text-slate-900">
            Sign in to your account
          </h2>
          <p class="mt-3 text-slate-500">
            Enter your details to access the admin dashboard.
          </p>
        </div>

        <div
          v-if="successMessage"
          role="status"
          class="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <svg
            class="mt-0.5 h-5 w-5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="m5 12 4 4L19 6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {{ successMessage }}
        </div>
        <div
          v-if="errorMessage"
          role="alert"
          class="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {{ errorMessage }}
        </div>

        <form class="space-y-5" novalidate @submit.prevent="submitLogin">
          <div>
            <label
              for="email"
              class="mb-2 block text-sm font-medium text-slate-700"
              >Email address</label
            >
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="you@dormease.com"
              :aria-invalid="!!errors.email"
              class="w-full rounded-xl border bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              :class="errors.email ? 'border-red-300' : 'border-slate-200'"
            />
            <p v-if="errors.email" class="mt-2 text-sm text-red-600">
              {{ errors.email }}
            </p>
          </div>

          <div>
            <div class="mb-2 flex items-center justify-between">
              <label
                for="password"
                class="block text-sm font-medium text-slate-700"
                >Password</label
              >
              <a
                href="#"
                class="text-sm font-medium text-brand-600 hover:text-brand-700"
                @click.prevent="
                  errorMessage = 'Password recovery is not available yet.'
                "
                >Forgot password?</a
              >
            </div>
            <div class="relative">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="Enter your password"
                :aria-invalid="!!errors.password"
                class="w-full rounded-xl border bg-white px-4 py-3 pr-12 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                :class="errors.password ? 'border-red-300' : 'border-slate-200'"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 px-4 text-slate-400 hover:text-slate-600"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                <svg
                  v-if="showPassword"
                  class="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg
                  v-else
                  class="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.7 10.7 0 0 1 12 4c6.5 0 10 8 10 8a18.3 18.3 0 0 1-3.1 4.4M6.6 6.6C3.6 8.5 2 12 2 12s3.5 8 10 8c1.7 0 3.2-.5 4.5-1.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>
            <p v-if="errors.password" class="mt-2 text-sm text-red-600">
              {{ errors.password }}
            </p>
          </div>

          <label class="flex items-center gap-3 text-sm text-slate-600">
            <input
              v-model="rememberMe"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Remember me on this device
          </label>

          <button
            type="submit"
            :disabled="isSubmitting"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <svg
              v-if="isSubmitting"
              class="h-5 w-5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z"
              />
            </svg>
            {{ isSubmitting ? "Signing in..." : "Sign in" }}
          </button>
        </form>

        <p class="mt-8 text-center text-sm text-slate-500">
          Don't have an account?
          <NuxtLink
            to="/register"
            class="font-semibold text-brand-600 hover:text-brand-700"
            >Create an account</NuxtLink
          >
        </p>
      </div>
    </section>
  </main>
</template>
