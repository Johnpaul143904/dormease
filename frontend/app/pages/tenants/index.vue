<script setup lang="ts">
import AdminShell from "~/components/layout/AdminShell.vue";
import GlobalSearchResults from "~/components/layout/GlobalSearchResults.vue";
import type { Tenant, TenantInput } from "~/types/tenant";

const data = useDormData();
const route = useRoute();
onMounted(() => {
  void data.loadFromApi();
});

const search = ref("");
watch(
  () => route.query.search,
  (value) => {
    search.value = typeof value === "string" ? value : "";
  },
  { immediate: true },
);
const status = ref("ALL");
const editingTenant = ref<Tenant | null>(null);
const modalOpen = ref(false);
const saving = ref(false);
const deletingTenantId = ref<number | null>(null);
const notice = ref("");
const errorMessage = ref("");
const emptyForm = () => ({
  fullName: "",
  email: "",
  contactNumber: "",
  address: "",
  emergencyContact: "",
});
const form = reactive(emptyForm());

const filtered = computed(() =>
  data.tenants.value.filter(
    (tenant) =>
      `${tenant.fullName} ${tenant.email}`
        .concat(
          ` ${tenant.contactNumber} ${tenant.address} ${tenant.emergencyContact} ${tenant.status}`,
        )
        .toLocaleLowerCase()
        .includes(search.value.trim().toLocaleLowerCase()) &&
      (status.value === "ALL" || tenant.status === status.value),
  ),
);

const roomName = (id: number | null) => {
  const room = data.rooms.value.find((item) => item.id === id);
  return room ? `${room.roomNumber} · ${room.building}` : "Unassigned";
};

function openCreate() {
  editingTenant.value = null;
  Object.assign(form, emptyForm());
  notice.value = "";
  errorMessage.value = "";
  modalOpen.value = true;
}

function openEdit(tenant: Tenant) {
  editingTenant.value = tenant;
  Object.assign(form, {
    fullName: tenant.fullName,
    email: tenant.email,
    contactNumber: tenant.contactNumber,
    address: tenant.address ?? "",
    emergencyContact: tenant.emergencyContact ?? "",
  });
  notice.value = "";
  errorMessage.value = "";
  modalOpen.value = true;
}

async function saveTenant() {
  saving.value = true;
  errorMessage.value = "";
  notice.value = "";
  try {
    const payload: TenantInput = { ...form };
    if (editingTenant.value) {
      await data.updateTenant(editingTenant.value.id, payload);
      notice.value = "Tenant details updated.";
    } else {
      await data.createTenant(payload);
      notice.value =
        "Tenant record created. They can sign up through Clerk with this verified email.";
    }
    modalOpen.value = false;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Unable to save tenant.";
  } finally {
    saving.value = false;
  }
}

async function removeTenant(tenant: Tenant) {
  if (deletingTenantId.value !== null) return;
  const confirmed = window.confirm(
    `Permanently delete ${tenant.fullName}, their login account, assignments, payments, maintenance requests, and invitations? This cannot be undone.`,
  );
  if (!confirmed) return;

  errorMessage.value = "";
  notice.value = "";
  deletingTenantId.value = tenant.id;
  try {
    await data.deleteTenant(tenant.id);
    if (editingTenant.value?.id === tenant.id) modalOpen.value = false;
    notice.value = `${tenant.fullName} and their linked records were deleted.`;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Unable to delete tenant.";
  } finally {
    deletingTenantId.value = null;
  }
}
</script>

<template>
  <AdminShell>
    <template #title>Tenants management</template>
    <div class="mx-auto max-w-7xl space-y-6">
      <header
        class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"
      >
        <div>
          <h2 class="text-2xl font-bold">Tenant directory</h2>
          <p class="mt-1 text-sm text-slate-500">
            Create accounts and manage resident profiles.
          </p>
        </div>
        <button
          class="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          @click="openCreate"
        >
          Add tenant
        </button>
      </header>

      <p
        v-if="notice"
        class="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        role="status"
      >
        {{ notice }}
      </p>
      <p
        v-if="errorMessage"
        class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        role="alert"
      >
        {{ errorMessage }}
      </p>
      <div
        v-if="data.error.value"
        class="flex flex-col justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center"
        role="alert"
      >
        <span>{{ data.error.value }}</span>
        <button class="font-semibold underline" @click="data.loadFromApi()">
          Retry loading tenants
        </button>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="stat in [
            { label: 'Total tenants', value: data.tenants.value.length },
            {
              label: 'Active tenants',
              value: data.tenants.value.filter(
                (item) => item.status === 'ACTIVE',
              ).length,
            },
            {
              label: 'Assigned rooms',
              value: data.tenants.value.filter((item) => item.assignedRoomId)
                .length,
            },
            {
              label: 'Unassigned',
              value: data.tenants.value.filter((item) => !item.assignedRoomId)
                .length,
            },
          ]"
          :key="stat.label"
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p class="text-sm text-slate-500">{{ stat.label }}</p>
          <p class="mt-2 text-2xl font-bold">{{ stat.value }}</p>
        </div>
      </div>

      <section
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div
          class="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row"
        >
          <div class="relative flex-1">
            <input
              v-model="search"
              type="search"
              aria-label="Search all modules or filter tenants"
              class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              placeholder="Search all modules or filter tenants..."
            />
            <GlobalSearchResults :query="search" />
          </div>
          <select
            v-model="status"
            class="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Unassigned</option>
          </select>
        </div>
        <div
          v-if="data.loading.value"
          class="p-8 text-center text-sm text-slate-500"
        >
          Loading tenants...
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[800px] text-left text-sm">
            <thead
              class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"
            >
              <tr>
                <th class="px-5 py-4">Tenant</th>
                <th class="px-5 py-4">Contact</th>
                <th class="px-5 py-4">Assigned room</th>
                <th class="px-5 py-4">Registered</th>
                <th class="px-5 py-4">Status</th>
                <th class="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="tenant in filtered"
                :key="tenant.id"
                class="hover:bg-slate-50"
              >
                <td class="px-5 py-4">
                  <strong class="block">{{ tenant.fullName }}</strong>
                  <span class="text-xs text-slate-500">{{ tenant.email }}</span>
                </td>
                <td class="px-5 py-4">{{ tenant.contactNumber || "—" }}</td>
                <td class="px-5 py-4">{{ roomName(tenant.assignedRoomId) }}</td>
                <td class="px-5 py-4">{{ tenant.registrationDate }}</td>
                <td class="px-5 py-4">
                  <span
                    class="rounded-full px-2.5 py-1 text-xs font-semibold"
                    :class="
                      tenant.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    "
                  >
                    {{ tenant.status === "ACTIVE" ? "Active" : "Unassigned" }}
                  </span>
                </td>
                <td class="space-x-3 px-5 py-4 text-right">
                  <button
                    class="font-semibold text-brand-600 hover:underline"
                    @click="openEdit(tenant)"
                  >
                    Edit
                  </button>
                  <button
                    class="font-semibold text-red-600 hover:underline"
                    @click="removeTenant(tenant)"
                  >
                    Delete
                  </button>
                </td>
              </tr>
              <tr v-if="!filtered.length && !data.error.value">
                <td colspan="6" class="px-5 py-10 text-center text-slate-500">
                  No tenants found.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div
        v-if="modalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        @click.self="!saving && (modalOpen = false)"
      >
        <form
          class="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          @submit.prevent="saveTenant"
        >
          <div class="flex items-start justify-between">
            <div>
              <p class="text-sm font-semibold text-brand-600">
                {{ editingTenant ? "Edit tenant" : "New tenant account" }}
              </p>
              <h3 class="mt-1 text-2xl font-bold">
                {{ editingTenant ? editingTenant.fullName : "Add tenant" }}
              </h3>
            </div>
            <button
              type="button"
              class="text-2xl text-slate-400 disabled:opacity-50"
              aria-label="Close"
              :disabled="saving"
              @click="modalOpen = false"
            >
              ×
            </button>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="space-y-1 text-sm font-medium"
              >Full name
              <input
                v-model.trim="form.fullName"
                required
                minlength="2"
                class="w-full rounded-xl border border-slate-200 px-3 py-2.5"
              />
            </label>
            <label class="space-y-1 text-sm font-medium"
              >Email
              <input
                v-model.trim="form.email"
                required
                type="email"
                class="w-full rounded-xl border border-slate-200 px-3 py-2.5"
              />
            </label>
            <p
              v-if="!editingTenant"
              class="text-xs text-slate-500 sm:col-span-2"
            >
              The tenant must create their account through Clerk using this
              verified email address.
            </p>
            <p v-else class="text-xs text-slate-500 sm:col-span-2">
              For linked accounts, the tenant must verify a new email address
              through Clerk before it can be saved here.
            </p>
            <label class="space-y-1 text-sm font-medium"
              >Contact number
              <input
                v-model.trim="form.contactNumber"
                class="w-full rounded-xl border border-slate-200 px-3 py-2.5"
              />
            </label>
            <label class="space-y-1 text-sm font-medium"
              >Emergency contact
              <input
                v-model.trim="form.emergencyContact"
                class="w-full rounded-xl border border-slate-200 px-3 py-2.5"
              />
            </label>
            <label class="space-y-1 text-sm font-medium sm:col-span-2"
              >Address
              <input
                v-model.trim="form.address"
                class="w-full rounded-xl border border-slate-200 px-3 py-2.5"
              />
            </label>
          </div>

          <p
            v-if="errorMessage"
            class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {{ errorMessage }}
          </p>
          <div class="flex flex-wrap justify-between gap-3 pt-2">
            <button
              v-if="editingTenant"
              type="button"
              :disabled="deletingTenantId !== null"
              class="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
              @click="removeTenant(editingTenant)"
            >
              {{
                deletingTenantId === editingTenant.id
                  ? "Deleting..."
                  : "Delete tenant"
              }}
            </button>
            <div class="ml-auto flex gap-3">
              <button
                type="button"
                :disabled="saving"
                class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                @click="modalOpen = false"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="saving"
                class="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {{ saving ? "Saving..." : "Save tenant" }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </AdminShell>
</template>
