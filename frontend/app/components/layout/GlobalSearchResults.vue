<script setup lang="ts">
const props = defineProps<{ query: string }>();
const { searchRecords } = useRecordSearch();
const results = ref<Awaited<ReturnType<typeof searchRecords>>>([]);
const error = ref("");
const isSearching = ref(false);
const isOpen = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;

watch(
  () => props.query,
  (value) => {
    const currentGeneration = ++generation;
    if (timer) clearTimeout(timer);
    error.value = "";
    const query = value.trim();
    if (query.length < 2) {
      results.value = [];
      isSearching.value = false;
      isOpen.value = false;
      return;
    }

    isOpen.value = true;
    isSearching.value = true;
    timer = setTimeout(async () => {
      try {
        const found = await searchRecords(query);
        if (currentGeneration === generation) results.value = found;
      } catch (caught) {
        if (currentGeneration === generation) {
          error.value =
            caught instanceof Error
              ? caught.message
              : "Unable to search records.";
          results.value = [];
        }
      } finally {
        if (currentGeneration === generation) isSearching.value = false;
      }
    }, 250);
  },
  { immediate: true },
);

function openResult(result: (typeof results.value)[number]) {
  isOpen.value = false;
  void navigateTo({
    path: result.path,
    query: { search: result.searchTerm },
  });
}

function closeResults() {
  window.setTimeout(() => {
    isOpen.value = false;
  }, 150);
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div
    v-if="isOpen && query.trim().length >= 2"
    class="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
    role="listbox"
    @focusout="closeResults"
    @focusin="isOpen = true"
  >
    <p
      v-if="isSearching"
      class="px-3 py-4 text-sm text-slate-500"
      role="status"
    >
      Searching all modules...
    </p>
    <p v-else-if="error" class="px-3 py-3 text-sm text-rose-700" role="alert">
      {{ error }}
    </p>
    <p v-else-if="!results.length" class="px-3 py-4 text-sm text-slate-500">
      No matching records found in any module.
    </p>
    <button
      v-for="(result, index) in results"
      :key="`${result.category}-${result.title}-${index}`"
      type="button"
      class="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
      role="option"
      @mousedown.prevent="openResult(result)"
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
</template>
