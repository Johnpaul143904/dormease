<script setup lang="ts">
const route = useRoute();
const data = useDormData();
const auth = useDormEaseAuth();
const code = computed(() =>
  typeof route.params.code === "string" ? route.params.code : "",
);
const result = ref<Awaited<ReturnType<typeof data.joinWithInvitation>> | null>(
  null,
);
const isLoading = ref(true);
const isAccepting = ref(false);
const notice = ref("");

definePageMeta({ layout: "auth" });

onMounted(async () => {
  try {
    await auth.restoreSession();
  } catch (error) {
    notice.value =
      error instanceof Error
        ? error.message
        : "Unable to verify your DormEase account.";
  }
  result.value = await data.joinWithInvitation(code.value);
  isLoading.value = false;
});

async function continueInvitation() {
  if (!result.value?.ok) return;
  if (!auth.isAuthenticated.value || !auth.role.value) {
    await navigateTo({
      path: "/login",
      query: { redirect: route.fullPath },
    });
    return;
  }
  if (auth.role.value !== "TENANT") {
    notice.value = "Sign in with a tenant account to accept this invitation.";
    return;
  }

  isAccepting.value = true;
  notice.value = "";
  try {
    await data.acceptInvitation(result.value.code);
    notice.value = "Invitation accepted. You have joined the room.";
  } catch (error) {
    notice.value =
      error instanceof Error ? error.message : "Unable to accept invitation.";
    result.value = await data.joinWithInvitation(code.value);
  } finally {
    isAccepting.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-50 p-4">
    <section
      class="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <NuxtLink to="/" class="text-sm font-bold text-brand-700">DormEase</NuxtLink>
      <h1 class="mt-5 text-2xl font-bold text-slate-900">
        Room invitation
      </h1>
      <p class="mt-2 text-sm text-slate-600">
        Review the room details before choosing whether to join.
      </p>

      <div
        v-if="isLoading"
        class="mt-6 rounded-xl bg-slate-50 p-5 text-sm text-slate-600"
        role="status"
      >
        Checking invitation…
      </div>
      <div
        v-else-if="!result?.ok"
        class="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900"
        role="status"
      >
        {{ result?.message || "Invalid invitation link." }}
      </div>
      <template v-else>
        <div class="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p class="text-sm font-semibold text-emerald-800">
            Active invitation · {{ result.status }}
          </p>
          <h2 class="mt-2 text-xl font-bold text-slate-900">
            Room {{ result.room.roomNumber }} · {{ result.room.building }}
          </h2>
          <p class="mt-1 text-sm text-slate-600">
            {{ result.room.roomType }} · {{ result.room.currentOccupants }} of
            {{ result.room.capacity }} occupants · ₱{{
              result.room.monthlyRate.toLocaleString()
            }}/month
          </p>
          <p class="mt-4 text-sm text-slate-600">
            Invitation <span class="font-mono">{{ result.code }}</span>
          </p>
          <p class="mt-1 text-sm text-slate-600">
            Expires {{ new Date(result.expiresAt).toLocaleDateString() }}
          </p>
        </div>

        <p
          v-if="notice"
          class="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800"
          role="status"
        >
          {{ notice }}
        </p>
        <button
          v-if="notice.startsWith('Invitation accepted')"
          class="mt-5 w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white"
          @click="navigateTo('/tenant/dashboard')"
        >
          Go to tenant dashboard
        </button>
        <button
          v-else
          class="mt-5 w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
          :disabled="isAccepting"
          @click="continueInvitation"
        >
          {{
            isAccepting
              ? "Accepting…"
              : auth.isAuthenticated.value && auth.role.value === "TENANT"
                ? "Accept invitation"
                : "Sign in to continue"
          }}
        </button>
      </template>
    </section>
  </main>
</template>
