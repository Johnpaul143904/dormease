<script setup lang="ts">
const route = useRoute();
interface SearchResult {
  title: string;
  detail: string;
  path: string;
  searchTerm: string;
  category: string;
}

const nav = [
  { label: "Overview", to: "/admin/dashboard", icon: "⌂" },
  { label: "Rooms", to: "/rooms", icon: "▦" },
  { label: "Tenants", to: "/tenants", icon: "♙" },
  { label: "Assignments", to: "/assignments", icon: "⇄" },
  { label: "Room invitations", to: "/invitations", icon: "⌁" },
  { label: "Payments", to: "/payments", icon: "₱" },
  { label: "Maintenance", to: "/maintenance", icon: "⚒" },
];
const auth = useDormEaseAuth();
const dormData = useDormData();
const operations = useOperations();
const isMenuOpen = ref(false);
const isProfileOpen = ref(false);
const globalSearch = ref("");
const searchResults = ref<SearchResult[]>([]);
const isSearching = ref(false);
const searchError = ref("");
const isSearchOpen = ref(false);
const searchDataLoaded = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let searchDataLoad: Promise<void> | null = null;
let searchGeneration = 0;
const displayName = computed(() => auth.user.value?.fullName || "Account");
const displayRole = computed(() =>
  auth.user.value?.role === "STAFF"
    ? "Staff"
    : auth.user.value?.role === "TENANT"
      ? "Tenant"
      : "Admin",
);
const initials = computed(
  () =>
    displayName.value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "A",
);

function findSearchResults(query: string): SearchResult[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  const results: SearchResult[] = [];
  const matches = (values: Array<string | number | null | undefined>) =>
    values.some((value) =>
      String(value ?? "")
        .toLocaleLowerCase()
        .includes(normalized),
    );
  const tenantName = (id: number) =>
    dormData.tenants.value.find((tenant) => tenant.id === id)?.fullName ??
    "Tenant unavailable";
  const roomLabel = (id: number) => {
    const room = dormData.rooms.value.find((item) => item.id === id);
    return room ? `${room.roomNumber} · ${room.building}` : "Room unavailable";
  };

  dormData.rooms.value.forEach((room) => {
    if (
      matches([
        room.roomNumber,
        room.building,
        room.floor,
        room.roomType,
        room.status,
      ])
    ) {
      results.push({
        title: `Room ${room.roomNumber}`,
        detail: `${room.building} · Floor ${room.floor} · ${room.status}`,
        path: "/rooms",
        searchTerm: query.trim(),
        category: "Room",
      });
    }
  });
  dormData.tenants.value.forEach((tenant) => {
    if (
      matches([
        tenant.fullName,
        tenant.email,
        tenant.contactNumber,
        tenant.status,
        tenant.address,
        tenant.assignedRoomId ? roomLabel(tenant.assignedRoomId) : "",
      ])
    ) {
      results.push({
        title: tenant.fullName,
        detail: `${tenant.email} · ${tenant.status}`,
        path: "/tenants",
        searchTerm: query.trim(),
        category: "Tenant",
      });
    }
  });
  dormData.assignments.value.forEach((assignment) => {
    const tenant = tenantName(assignment.tenantId);
    const room = roomLabel(assignment.roomId);
    if (
      matches([
        tenant,
        room,
        assignment.status,
        assignment.assignmentDate,
        assignment.moveInDate,
        assignment.moveOutDate,
      ])
    ) {
      results.push({
        title: tenant,
        detail: `${room} · ${assignment.status}`,
        path: "/assignments",
        searchTerm: query.trim(),
        category: "Assignment",
      });
    }
  });
  operations.payments.value.forEach((payment) => {
    const tenant = tenantName(payment.tenantId);
    if (
      matches([
        tenant,
        payment.description,
        payment.referenceNumber,
        payment.amount,
        payment.paymentMethod,
        payment.paymentDate,
        payment.dueDate,
        payment.status,
      ])
    ) {
      results.push({
        title: tenant,
        detail: `${payment.description} · ₱${payment.amount.toLocaleString()} · ${payment.status}`,
        path: "/payments",
        searchTerm: query.trim(),
        category: "Payment",
      });
    }
  });
  operations.maintenance.value.forEach((item) => {
    const tenant = tenantName(item.tenantId);
    if (
      matches([
        tenant,
        item.issue,
        roomLabel(item.roomId),
        item.priority,
        item.status,
        item.requestDate,
      ])
    ) {
      results.push({
        title: item.issue,
        detail: `${tenant} · Room ${roomLabel(item.roomId)} · ${item.status}`,
        path: "/maintenance",
        searchTerm: query.trim(),
        category: "Maintenance",
      });
    }
  });
  dormData.invitations.value.forEach((invitation) => {
    const room = roomLabel(invitation.roomId);
    if (
      matches([
        invitation.code,
        room,
        invitation.status,
        invitation.expirationDate,
      ])
    ) {
      results.push({
        title: invitation.code,
        detail: `${room} · ${invitation.status} · expires ${invitation.expirationDate}`,
        path: "/invitations",
        searchTerm: query.trim(),
        category: "Invitation",
      });
    }
  });
  return results.slice(0, 10);
}

watch(globalSearch, (value) => {
  const generation = ++searchGeneration;
  if (searchTimer) clearTimeout(searchTimer);
  const query = value.trim();
  searchError.value = "";
  if (query.length < 2) {
    searchResults.value = [];
    isSearching.value = false;
    return;
  }

  isSearching.value = true;
  isSearchOpen.value = true;
  searchTimer = setTimeout(async () => {
    try {
      if (!searchDataLoaded.value) {
        if (!searchDataLoad) {
          searchDataLoad = Promise.all([
            dormData.loadFromApi(),
            dormData.loadInvitations(),
            operations.loadFromApi(),
          ])
            .then(() => {
              searchDataLoaded.value = true;
            })
            .finally(() => {
              searchDataLoad = null;
            });
        }
        await searchDataLoad;
      }
      if (generation !== searchGeneration) return;
      const failures = [dormData.error.value, operations.error.value].filter(
        Boolean,
      );
      if (failures.length) {
        searchError.value = failures.join(" ");
        searchDataLoaded.value = false;
      }
      searchResults.value = findSearchResults(query);
    } catch (error) {
      if (generation !== searchGeneration) return;
      searchError.value =
        error instanceof Error ? error.message : "Unable to search records.";
      searchResults.value = [];
      searchDataLoaded.value = false;
    } finally {
      if (generation === searchGeneration) isSearching.value = false;
    }
  }, 250);
});

function openSearchResult(result: SearchResult) {
  isSearchOpen.value = false;
  void navigateTo({
    path: result.path,
    query: { search: result.searchTerm },
  });
}

function closeSearchResults() {
  window.setTimeout(() => {
    isSearchOpen.value = false;
  }, 150);
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <button
      v-if="isMenuOpen"
      class="admin-sidebar-overlay"
      type="button"
      aria-label="Close navigation"
      @click="isMenuOpen = false"
    ></button>
    <aside
      class="admin-sidebar"
      :class="{ 'admin-sidebar-open': isMenuOpen }"
      id="admin-navigation"
    >
      <NuxtLink
        to="/admin/dashboard"
        class="flex items-center gap-3 px-5 py-7 text-lg font-bold"
        @click="isMenuOpen = false"
      >
        <span
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand-700"
          >⌂</span
        >
        <span>Dormitory Management</span>
      </NuxtLink>
      <div
        class="px-5 pb-3 text-[11px] font-bold uppercase tracking-widest text-blue-200/60"
      >
        Administration
      </div>
      <nav class="space-y-1 px-3">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-blue-100/70 transition hover:bg-white/10 hover:text-white"
          :class="
            route.path === item.to
              ? 'bg-white text-brand-900 shadow-lg shadow-blue-950/20'
              : ''
          "
          @click="isMenuOpen = false"
        >
          <span class="w-5 text-center text-base">{{ item.icon }}</span
          >{{ item.label }}
        </NuxtLink>
      </nav>
      <div class="mt-auto border-t border-white/10 p-4">
        <div class="flex items-center gap-3 px-3 py-3 text-sm text-blue-100/70">
          <span
            class="flex h-9 w-9 items-center justify-center rounded-full bg-blue-700 text-xs font-bold"
            >{{ initials }}</span
          >
          <span
            ><strong class="block text-white">{{ displayName }}</strong
            ><small>{{ displayRole }} account</small></span
          >
        </div>
        <button
          class="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-blue-100/70 hover:bg-white/10 hover:text-white"
          @click="auth.logout()"
        >
          ↪ <span>Logout</span>
        </button>
      </div>
    </aside>
    <div class="admin-content">
      <header
        class="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur sm:gap-5 sm:px-8 sm:py-4"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
          <button
            class="admin-menu-button min-h-11 min-w-11 shrink-0 rounded-lg border border-slate-200 px-2.5 py-2 text-brand-700 lg:hidden sm:px-3"
            aria-label="Open navigation"
            aria-controls="admin-navigation"
            :aria-expanded="isMenuOpen"
            @click="isMenuOpen = true"
          >
            ☰
          </button>
          <div class="hidden sm:block">
            <p
              class="text-xs font-semibold uppercase tracking-widest text-brand-600"
            >
              Admin workspace
            </p>
            <h1 class="text-lg font-bold text-slate-900">
              <slot name="title">Dashboard overview</slot>
            </h1>
          </div>
          <label class="relative block min-w-0 w-full max-w-sm flex-1"
            ><span class="sr-only">Search</span
            ><span
              class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"
              >⌕</span
            ><input
              v-model="globalSearch"
              type="search"
              autocomplete="off"
              aria-label="Search across DormEase records"
              aria-controls="global-search-results"
              :aria-expanded="isSearchOpen && globalSearch.trim().length >= 2"
              @focus="globalSearch.trim().length >= 2 && (isSearchOpen = true)"
              @blur="closeSearchResults"
              @keydown.esc="isSearchOpen = false"
              @keydown.enter.prevent="
                searchResults[0] && openSearchResult(searchResults[0])
              "
              class="w-full rounded-xl border-0 bg-slate-100 py-2.5 pl-9 pr-4 text-sm outline-none ring-brand-100 placeholder:text-slate-400 focus:ring-4"
              placeholder="Search..."
          />
            <div
              v-if="isSearchOpen && globalSearch.trim().length >= 2"
              id="global-search-results"
              class="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
              role="listbox"
            >
              <p
                v-if="isSearching"
                class="px-3 py-4 text-sm text-slate-500"
                role="status"
              >
                Searching records...
              </p>
              <p
                v-else-if="searchError"
                class="px-3 py-3 text-sm text-rose-700"
                role="alert"
              >
                {{ searchError }}
              </p>
              <p
                v-else-if="!searchResults.length"
                class="px-3 py-4 text-sm text-slate-500"
              >
                No matching records found.
              </p>
              <button
                v-for="(result, index) in searchResults"
                :key="`${result.category}-${result.title}-${index}`"
                type="button"
                class="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                role="option"
                @mousedown.prevent="openSearchResult(result)"
              >
                <span
                  class="block text-xs font-semibold uppercase tracking-wide text-brand-600"
                  >{{ result.category }}</span
                >
                <span class="mt-0.5 block truncate text-sm font-semibold">{{
                  result.title
                }}</span>
                <span class="block truncate text-xs text-slate-500">{{
                  result.detail
                }}</span>
              </button>
            </div>
          </label>
        </div>
        <div class="relative flex shrink-0 items-center gap-3 sm:gap-4">
          <button
            class="relative text-xl text-slate-400"
            aria-label="Notifications"
          >
            ♢<span
              class="absolute right-0 top-0 h-2 w-2 rounded-full bg-rose-500"
            ></span></button
          ><button
            class="flex items-center gap-3"
            @click="isProfileOpen = !isProfileOpen"
          >
            <span class="hidden text-right sm:block"
              ><strong class="block text-sm">{{ displayName }}</strong
              ><small class="text-slate-500">{{ displayRole }}</small></span
            ><span
              class="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700"
              >{{ initials }}</span
            >
          </button>
          <div
            v-if="isProfileOpen"
            class="absolute right-0 top-14 w-48 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-xl"
          >
            <NuxtLink
              to="/profile"
              class="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50"
              >Account settings</NuxtLink
            ><button
              class="w-full rounded-lg px-3 py-2 text-left text-rose-600 hover:bg-rose-50"
              @click="auth.logout()"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main class="min-w-0 p-4 sm:p-6 lg:p-8"><slot /></main>
    </div>
  </div>
</template>
