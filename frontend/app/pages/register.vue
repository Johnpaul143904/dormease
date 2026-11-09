<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  accountType: 'TENANT' as 'ADMIN' | 'TENANT',
  invitationCode: '',
  terms: false,
})
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isSubmitting = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const errors = reactive<Record<string, string>>({})
const authApi = useAuthApi()

function validate() {
  Object.keys(errors).forEach((key) => delete errors[key])
  errorMessage.value = ''

  if (!form.name.trim()) errors.name = 'Full name is required.'
  if (!form.email.trim()) errors.email = 'Email address is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address.'
  if (form.password.length < 8) errors.password = 'Use at least 8 characters.'
  if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match.'
  if (form.accountType === 'ADMIN' && !form.invitationCode.trim()) errors.invitationCode = 'An admin invitation code is required.'
  if (!form.terms) errors.terms = 'Please accept the terms to continue.'

  return Object.keys(errors).length === 0
}

async function submitRegistration() {
  successMessage.value = ''
  if (!validate()) return

  const payload = authApi.createRegistrationPayload(form.name, form.email, form.password, form.accountType, form.invitationCode)
  isSubmitting.value = true
  try {
    await authApi.register(payload)
    successMessage.value = 'Account created successfully. Please sign in to continue.'
    await navigateTo('/login?registered=1')
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to create your account.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="flex min-h-screen">
    <section class="hidden w-[42%] flex-col justify-between bg-brand-900 p-10 text-white lg:flex xl:p-14">
      <NuxtLink to="/login" class="flex items-center gap-3 text-lg font-bold tracking-tight">
        <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-700 shadow-lg shadow-blue-950/20">
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M9 9h.01M15 9h.01" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </span>
        DormEase
      </NuxtLink>
      <div class="max-w-md">
        <p class="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">Get started today</p>
        <h1 class="text-4xl font-bold leading-tight xl:text-5xl">Everything your dorm needs, in one place.</h1>
        <p class="mt-6 text-lg leading-8 text-blue-100/80">Create your DormEase account and bring clarity to your day-to-day operations.</p>
      </div>
      <p class="text-sm text-blue-200/70">© {{ new Date().getFullYear() }} DormEase. Built for better living.</p>
    </section>

    <section class="flex w-full items-center justify-center px-6 py-10 sm:px-10 lg:w-[58%] lg:px-16">
      <div class="w-full max-w-md">
        <div class="mb-8 flex items-center gap-3 lg:hidden">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"><svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
          <span class="text-xl font-bold text-slate-900">DormEase</span>
        </div>

        <div class="mb-7">
          <p class="mb-2 text-sm font-semibold text-brand-600">Create your account</p>
          <h2 class="text-3xl font-bold tracking-tight text-slate-900">Join DormEase</h2>
          <p class="mt-3 text-slate-500">Set up your profile to get started. Access is assigned according to your account role.</p>
        </div>

        <div v-if="successMessage" role="status" class="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{{ successMessage }} <NuxtLink to="/login" class="font-semibold underline">Sign in</NuxtLink></div>
        <div v-if="errorMessage" role="alert" class="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{{ errorMessage }}</div>

        <form class="space-y-4" novalidate @submit.prevent="submitRegistration">
          <div>
            <label for="name" class="mb-2 block text-sm font-medium text-slate-700">Full name</label>
            <input id="name" v-model="form.name" type="text" autocomplete="name" placeholder="Juan Dela Cruz" class="w-full rounded-xl border bg-white px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100" :class="errors.name ? 'border-red-300' : 'border-slate-200'" />
            <p v-if="errors.name" class="mt-1.5 text-sm text-red-600">{{ errors.name }}</p>
          </div>
          <div>
            <label for="register-email" class="mb-2 block text-sm font-medium text-slate-700">Email address</label>
            <input id="register-email" v-model="form.email" type="email" autocomplete="email" placeholder="you@dormease.com" class="w-full rounded-xl border bg-white px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100" :class="errors.email ? 'border-red-300' : 'border-slate-200'" />
            <p v-if="errors.email" class="mt-1.5 text-sm text-red-600">{{ errors.email }}</p>
          </div>
          <div>
            <label for="register-password" class="mb-2 block text-sm font-medium text-slate-700">Password</label>
            <div class="relative"><input id="register-password" v-model="form.password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="At least 8 characters" class="w-full rounded-xl border bg-white px-4 py-3 pr-12 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100" :class="errors.password ? 'border-red-300' : 'border-slate-200'" /><button type="button" class="absolute inset-y-0 right-0 px-4 text-slate-400" :aria-label="showPassword ? 'Hide password' : 'Show password'" @click="showPassword = !showPassword"><span aria-hidden="true">{{ showPassword ? 'Hide' : 'Show' }}</span></button></div>
            <p v-if="errors.password" class="mt-1.5 text-sm text-red-600">{{ errors.password }}</p>
          </div>
          <div>
            <label for="confirm-password" class="mb-2 block text-sm font-medium text-slate-700">Confirm password</label>
            <div class="relative"><input id="confirm-password" v-model="form.confirmPassword" :type="showConfirmPassword ? 'text' : 'password'" autocomplete="new-password" placeholder="Repeat your password" class="w-full rounded-xl border bg-white px-4 py-3 pr-12 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100" :class="errors.confirmPassword ? 'border-red-300' : 'border-slate-200'" /><button type="button" class="absolute inset-y-0 right-0 px-4 text-sm text-slate-400" @click="showConfirmPassword = !showConfirmPassword">{{ showConfirmPassword ? 'Hide' : 'Show' }}</button></div>
            <p v-if="errors.confirmPassword" class="mt-1.5 text-sm text-red-600">{{ errors.confirmPassword }}</p>
          </div>
          <fieldset>
            <legend class="mb-2 block text-sm font-medium text-slate-700">Account type</legend>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="cursor-pointer rounded-xl border p-4 transition" :class="form.accountType === 'TENANT' ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 bg-white'">
                <input v-model="form.accountType" class="sr-only" type="radio" value="TENANT" />
                <strong class="block text-slate-900">User (Tenant)</strong>
                <span class="mt-1 block text-xs text-slate-500">For residents and room applicants.</span>
              </label>
              <label class="cursor-pointer rounded-xl border p-4 transition" :class="form.accountType === 'ADMIN' ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 bg-white'">
                <input v-model="form.accountType" class="sr-only" type="radio" value="ADMIN" />
                <strong class="block text-slate-900">Admin</strong>
                <span class="mt-1 block text-xs text-slate-500">Requires an authorized invitation code.</span>
              </label>
            </div>
          </fieldset>
          <div v-if="form.accountType === 'ADMIN'">
            <label for="invitation-code" class="mb-2 block text-sm font-medium text-slate-700">Admin invitation code</label>
            <input id="invitation-code" v-model="form.invitationCode" type="password" autocomplete="off" placeholder="Enter invitation code" class="w-full rounded-xl border bg-white px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100" :class="errors.invitationCode ? 'border-red-300' : 'border-slate-200'" />
            <p v-if="errors.invitationCode" class="mt-1.5 text-sm text-red-600">{{ errors.invitationCode }}</p>
          </div>
          <label class="flex items-start gap-3 pt-1 text-sm text-slate-600">
            <input v-model="form.terms" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            <span>I agree to the <a href="#" class="font-medium text-brand-600 hover:text-brand-700" @click.prevent>terms and privacy policy</a>.</span>
          </label>
          <p v-if="errors.terms" class="text-sm text-red-600">{{ errors.terms }}</p>
          <button type="submit" :disabled="isSubmitting" class="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70">
            <svg v-if="isSubmitting" class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" /></svg>
            {{ isSubmitting ? 'Creating account...' : 'Create account' }}
          </button>
        </form>
        <p class="mt-7 text-center text-sm text-slate-500">Already have an account? <NuxtLink to="/login" class="font-semibold text-brand-600 hover:text-brand-700">Sign in</NuxtLink></p>
      </div>
    </section>
  </main>
</template>
