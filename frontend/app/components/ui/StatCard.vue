<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  value: string | number
  detail?: string
  tone?: 'blue' | 'green' | 'amber' | 'rose' | 'violet'
}>(), { tone: 'blue' })
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-sm font-medium text-slate-500">{{ label }}</p>
        <p class="mt-3 text-3xl font-bold tracking-tight text-slate-900">{{ value }}</p>
        <p v-if="detail" class="mt-1 text-xs text-slate-400">{{ detail }}</p>
      </div>
      <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold" :class="{
        'bg-blue-50 text-blue-700': tone === 'blue',
        'bg-emerald-50 text-emerald-700': tone === 'green',
        'bg-amber-50 text-amber-700': tone === 'amber',
        'bg-rose-50 text-rose-700': tone === 'rose',
        'bg-violet-50 text-violet-700': tone === 'violet',
      }">●</span>
    </div>
  </div>
</template>
