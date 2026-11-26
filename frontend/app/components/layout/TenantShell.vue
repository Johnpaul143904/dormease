<script setup lang="ts">
const route = useRoute();
const nav = [
  { label: "My dashboard", to: "/tenant/dashboard", icon: "⌂" },
  { label: "My assigned room", to: "/tenant/room", icon: "▦" },
  { label: "Join a room", to: "/tenant/join-room", icon: "⌁" },
  { label: "My payments", to: "/tenant/payments", icon: "₱" },
  { label: "Maintenance", to: "/tenant/maintenance", icon: "⚒" },
  { label: "My profile", to: "/profile", icon: "♙" },
];
const auth = useDormEaseAuth();
const isMenuOpen = ref(false);
const displayName = computed(() => auth.user.value?.fullName || "Account");
const initials = computed(
  () =>
    displayName.value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "T",
);
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <button
      v-if="isMenuOpen"
      type="button"
      class="tenant-sidebar-overlay"
      aria-label="Close navigation"
      @click="isMenuOpen = false"
    ></button>
    <aside
      id="tenant-navigation"
      class="tenant-sidebar"
      :class="{ 'tenant-sidebar-open': isMenuOpen }"
    >
      <NuxtLink
        to="/tenant/dashboard"
        class="flex items-center gap-3 border-b border-white/10 px-6 py-6 text-lg font-bold"
        @click="isMenuOpen = false"
        ><span
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500"
          >⌂</span
        >
        DormEase</NuxtLink
      >
      <div
        class="px-6 pb-3 pt-7 text-[11px] font-bold uppercase tracking-widest text-slate-500"
      >
        My residence
      </div>
      <nav class="space-y-1 px-3">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/10 hover:text-white"
          :class="route.path === item.to ? 'bg-brand-600 text-white' : ''"
          @click="isMenuOpen = false"
          ><span class="w-5 text-center">{{ item.icon }}</span
          >{{ item.label }}</NuxtLink
        >
      </nav>
      <div class="mt-auto border-t border-white/10 p-4">
        <div class="flex items-center gap-3 px-3 py-3 text-sm text-slate-400">
          <span
            class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-xs font-bold"
            >{{ initials }}</span
          >
          <span
            ><strong class="block text-white">{{ displayName }}</strong
            ><small>Tenant account</small></span
          >
        </div>
        <button
          class="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-400 hover:bg-white/10 hover:text-white"
          @click="auth.logout()"
        >
          ↪ <span>Logout</span>
        </button>
        <p
          v-if="auth.logoutError.value"
          class="px-3 pt-2 text-xs text-rose-300"
          role="alert"
        >
          {{ auth.logoutError.value }}
        </p>
      </div>
    </aside>
    <div class="tenant-content">
      <header
        class="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-3 py-3 backdrop-blur sm:px-8 sm:py-4"
      >
        <div class="flex min-w-0 items-center gap-3">
          <button
            type="button"
            class="tenant-menu-button min-h-11 min-w-11 shrink-0 rounded-lg border border-slate-200 px-2.5 py-2 text-brand-700 lg:hidden sm:px-3"
            aria-label="Open navigation"
            aria-controls="tenant-navigation"
            :aria-expanded="isMenuOpen"
            @click="isMenuOpen = true"
          >
            ☰
          </button>
          <div class="min-w-0">
            <p
              class="text-xs font-semibold uppercase tracking-widest text-brand-600"
            >
              Tenant portal
            </p>
            <h1 class="truncate text-lg font-bold">
              <slot name="title">My dashboard</slot>
            </h1>
          </div>
        </div>
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700"
        >
          {{ initials }}
        </div>
      </header>
      <main class="min-w-0 p-4 sm:p-6 lg:p-8"><slot /></main>
    </div>
  </div>
</template>
