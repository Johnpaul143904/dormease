<script setup lang="ts">
import type { PaymentSubmission } from "~/types/payment";

const props = defineProps<{
  submission: Pick<
    PaymentSubmission,
    "id" | "proofFileName" | "proofMimeType"
  >;
}>();

const api = useApi();
const route = useRoute();
const loadingAction = ref<"preview" | "download" | null>(null);
const error = ref("");
const previewUrl = ref("");
const previewType = ref("");

async function fetchProof() {
  const blob = await api.request<Blob>(
    `/payments/submissions/${props.submission.id}/proof`,
    { responseType: "blob" },
  );
  if (!blob.size) throw new Error("The receipt file is empty.");
  return blob;
}

function getErrorStatus(caught: unknown) {
  if (typeof caught !== "object" || caught === null) return undefined;
  if ("statusCode" in caught && typeof caught.statusCode === "number") {
    return caught.statusCode;
  }
  if ("status" in caught && typeof caught.status === "number") {
    return caught.status;
  }
  if (
    "response" in caught &&
    typeof caught.response === "object" &&
    caught.response !== null &&
    "status" in caught.response &&
    typeof caught.response.status === "number"
  ) {
    return caught.response.status;
  }
  return undefined;
}

async function handleActionError(caught: unknown, fallback: string) {
  const status = getErrorStatus(caught);
  if (status === 401) {
    await navigateTo(
      {
        path: "/login",
        query: { redirect: route.fullPath, authError: "session" },
      },
      { replace: true },
    );
    return;
  }
  error.value =
    status === 404
      ? "Receipt not found or you do not have permission to view it."
      : caught instanceof Error
        ? caught.message
        : fallback;
}

async function previewProof() {
  if (loadingAction.value) return;
  loadingAction.value = "preview";
  error.value = "";
  try {
    const blob = await fetchProof();
    const mimeType = blob.type || props.submission.proofMimeType;
    if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") {
      throw new Error("This receipt format cannot be previewed.");
    }
    closePreview();
    previewUrl.value = URL.createObjectURL(blob);
    previewType.value = mimeType;
  } catch (caught) {
    await handleActionError(caught, "Unable to open receipt.");
  } finally {
    loadingAction.value = null;
  }
}

async function downloadProof() {
  if (loadingAction.value) return;
  loadingAction.value = "download";
  error.value = "";
  let objectUrl = "";
  try {
    const blob = await fetchProof();
    objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = props.submission.proofFileName;
    document.body.append(link);
    link.click();
    link.remove();
  } catch (caught) {
    await handleActionError(caught, "Unable to download receipt.");
  } finally {
    if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    loadingAction.value = null;
  }
}

function closePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = "";
  previewType.value = "";
}

onBeforeUnmount(closePreview);
</script>

<template>
  <div class="space-y-2">
    <p
      class="max-w-48 truncate text-xs text-slate-500"
      :title="submission.proofFileName"
    >
      {{ submission.proofFileName }}
    </p>
    <div class="flex flex-wrap gap-x-3 gap-y-1">
      <button
        type="button"
        class="text-sm font-semibold text-brand-700 underline disabled:cursor-wait disabled:opacity-60"
        :disabled="loadingAction !== null"
        @click="previewProof"
      >
        {{ loadingAction === "preview" ? "Opening…" : "Preview receipt" }}
      </button>
      <button
        type="button"
        class="text-sm font-semibold text-brand-700 underline disabled:cursor-wait disabled:opacity-60"
        :disabled="loadingAction !== null"
        @click="downloadProof"
      >
        {{ loadingAction === "download" ? "Downloading…" : "Download" }}
      </button>
    </div>
    <p v-if="error" role="alert" class="text-sm text-rose-700">
      {{ error }}
    </p>
    <div
      v-if="previewUrl"
      class="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 sm:items-center"
      @click.self="closePreview"
    >
      <section
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`receipt-title-${submission.id}`"
        class="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-5"
      >
        <div class="flex items-center justify-between gap-4">
          <h3
            :id="`receipt-title-${submission.id}`"
            class="truncate font-semibold"
          >
            {{ submission.proofFileName }}
          </h3>
          <div class="flex shrink-0 items-center gap-3">
            <a
              :href="previewUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm font-semibold text-brand-700 underline"
            >
              Open in new tab
            </a>
            <button
              type="button"
              class="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100"
              @click="closePreview"
            >
              Close
            </button>
          </div>
        </div>
        <img
          v-if="previewType.startsWith('image/')"
          :src="previewUrl"
          :alt="`Receipt preview: ${submission.proofFileName}`"
          class="mt-4 max-h-[78vh] w-full rounded-lg object-contain"
        />
        <iframe
          v-else
          :src="previewUrl"
          :title="`PDF receipt preview: ${submission.proofFileName}`"
          class="mt-4 min-h-[70vh] w-full rounded-lg border"
        />
      </section>
    </div>
  </div>
</template>
