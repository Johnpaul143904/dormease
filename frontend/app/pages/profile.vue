<script setup lang="ts">
import AdminShell from "~/components/layout/AdminShell.vue";
import TenantShell from "~/components/layout/TenantShell.vue";

const auth = useAuth();
const authApi = useAuthApi();
const shell = computed(() =>
  auth.role.value === "TENANT" ? TenantShell : AdminShell,
);
const isSaving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const form = reactive({
  fullName: "",
  email: "",
  contactNumber: "",
  address: "",
  emergencyContact: "",
});

onMounted(async () => {
  try {
    const response = await authApi.profile();
    auth.user.value = response.user;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Unable to load your profile.";
  }
  const user = auth.user.value;
  if (!user) return;
  form.fullName = user.fullName;
  form.email = user.email;
  form.contactNumber = user.contactNumber || "";
  form.address = user.address || "";
  form.emergencyContact = user.emergencyContact || "";
});

async function saveProfile() {
  errorMessage.value = "";
  successMessage.value = "";
  isSaving.value = true;
  try {
    const response = await authApi.updateProfile(form);
    auth.user.value = response.user;
    successMessage.value = "Profile updated.";
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Unable to update your profile.";
  } finally {
    isSaving.value = false;
  }
}

function cancelChanges() {
  const user = auth.user.value;
  if (!user) return;
  form.fullName = user.fullName;
  form.email = user.email;
  form.contactNumber = user.contactNumber || "";
  form.address = user.address || "";
  form.emergencyContact = user.emergencyContact || "";
  errorMessage.value = "";
  successMessage.value = "";
}
</script>

<template>
  <component :is="shell">
    <template #title>My profile</template>
    <div class="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 class="text-2xl font-bold">My profile</h2>
        <p class="mt-1 text-sm text-slate-500">
          Update your account information.
        </p>
      </div>
      <div
        v-if="successMessage"
        role="status"
        class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
      >
        {{ successMessage }}
      </div>
      <div
        v-if="errorMessage"
        role="alert"
        class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
      >
        {{ errorMessage }}
      </div>
      <form
        class="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        @submit.prevent="saveProfile"
      >
        <div class="grid gap-5 sm:grid-cols-2">
          <label class="text-sm font-medium"
            >Full name<input
              v-model.trim="form.fullName"
              required
              minlength="2"
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
          /></label>
          <label class="text-sm font-medium"
            >Email address<input
              v-model.trim="form.email"
              required
              type="email"
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
          /></label>
          <label class="text-sm font-medium"
            >Phone number<input
              v-model.trim="form.contactNumber"
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
          /></label>
          <label class="text-sm font-medium"
            >Emergency contact<input
              v-model.trim="form.emergencyContact"
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
          /></label>
          <label class="text-sm font-medium sm:col-span-2"
            >Address<textarea
              v-model.trim="form.address"
              rows="3"
              class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5"
            />
          </label>
        </div>
        <p class="text-sm text-slate-500">
          Account role: {{ auth.user.value?.role || "—" }}. Roles can’t be
          changed from your profile.
        </p>
        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-700"
            @click="cancelChanges"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60"
            :disabled="isSaving"
          >
            {{ isSaving ? "Saving…" : "Save changes" }}
          </button>
        </div>
      </form>
    </div>
  </component>
</template>
