<script setup lang="ts">
defineProps<{ value: string }>()
</script>

<template>
  <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" :class="{
    'bg-emerald-50 text-emerald-700': ['ACTIVE', 'PAID', 'AVAILABLE', 'APPROVED', 'RESOLVED', 'COMPLETED'].includes(value),
    'bg-amber-50 text-amber-700': ['PENDING', 'PARTIAL', 'IN_PROGRESS', 'IN PROGRESS', 'OCCUPIED'].includes(value),
    'bg-rose-50 text-rose-700': ['OVERDUE', 'FULL', 'URGENT', 'CANCELLED', 'REJECTED'].includes(value),
    'bg-slate-100 text-slate-600': ['INACTIVE', 'MAINTENANCE', 'REVOKED'].includes(value),
  }">{{ value.replace('_', ' ') }}</span>
</template>
