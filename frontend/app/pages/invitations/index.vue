<script setup lang="ts">
import QRCode from "qrcode";
import AdminShell from "~/components/layout/AdminShell.vue";
import GlobalSearchResults from "~/components/layout/GlobalSearchResults.vue";

const data = useDormData();
const route = useRoute();
const selectedRoom = ref<number | null>(null);
const notice = ref("");
const invitationSearch = ref("");
watch(
  () => route.query.search,
  (value) => {
    invitationSearch.value = typeof value === "string" ? value : "";
  },
  { immediate: true },
);
const qrInvitation = ref<(typeof data.invitations.value)[number] | null>(null);
const qrDataUrl = ref("");
const invitationUrl = ref("");
const isGeneratingQr = ref(false);
onMounted(() => {
  void data.loadFromApi();
  void data.loadInvitations().catch((error: unknown) => {
    notice.value =
      error instanceof Error ? error.message : "Unable to load invitations.";
  });
});
const roomName = (id: number) => {
  const room = data.rooms.value.find((item) => item.id === id);
  return room ? `${room.roomNumber} · ${room.building}` : "Room unavailable";
};
const filteredInvitations = computed(() => {
  const query = invitationSearch.value.trim().toLocaleLowerCase();
  if (!query) return data.invitations.value;
  return data.invitations.value.filter((invitation) =>
    [
      invitation.code,
      roomName(invitation.roomId),
      invitation.status,
      invitation.expirationDate,
    ].some((value) => value.toLocaleLowerCase().includes(query)),
  );
});
async function generate() {
  if (!selectedRoom.value) {
    notice.value = "Select a room first.";
    return;
  }
  try {
    await data.createInvitation(selectedRoom.value);
    notice.value = "Invitation generated.";
  } catch (error) {
    notice.value =
      error instanceof Error ? error.message : "Unable to create invitation.";
  }
}
async function revoke(id: number) {
  try {
    await data.revokeInvitation(id);
    notice.value = "Invitation revoked.";
  } catch (error) {
    notice.value =
      error instanceof Error ? error.message : "Unable to revoke invitation.";
  }
}
function copy(code: string) {
  void navigator.clipboard
    ?.writeText(code)
    .then(() => (notice.value = "Invitation code copied."))
    .catch(() => (notice.value = "Unable to copy the invitation code."));
}
async function generateQr(invitation: (typeof data.invitations.value)[number]) {
  isGeneratingQr.value = true;
  notice.value = "";
  try {
    const url = new URL(
      `/invitations/accept/${encodeURIComponent(invitation.code)}`,
      window.location.origin,
    );
    invitationUrl.value = url.toString();
    qrDataUrl.value = await QRCode.toDataURL(url.toString(), {
      errorCorrectionLevel: "H",
      margin: 4,
      width: 640,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
    qrInvitation.value = invitation;
  } catch (error) {
    notice.value =
      error instanceof Error ? error.message : "Unable to generate QR code.";
  } finally {
    isGeneratingQr.value = false;
  }
}
async function copyInvitationLink() {
  try {
    await navigator.clipboard.writeText(invitationUrl.value);
    notice.value = "Invitation link copied.";
  } catch {
    notice.value = "Unable to copy the invitation link.";
  }
}
function saveQr() {
  const invitation = qrInvitation.value;
  if (!qrDataUrl.value || !invitation) return;
  const roomNumber = (roomName(invitation.roomId).split(" · ")[0] ?? "Room")
    .replace(/[^a-zA-Z0-9-]/g, "");
  const link = document.createElement("a");
  link.href = qrDataUrl.value;
  link.download = `DormEase-Room-${roomNumber}-Invitation.png`;
  link.click();
}
</script>
<template>
  <AdminShell
    ><template #title>Room invitations</template>
    <div class="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 class="text-2xl font-bold">Room invitations</h2>
        <p class="mt-1 text-sm text-slate-500">
          Create shareable codes for tenants to reserve an available room.
        </p>
      </div>
      <div class="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <section
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3 class="font-bold">Generate invitation</h3>
          <p class="mt-2 text-sm text-slate-500">
            Codes expire after seven days and create an assignment only after
            tenant confirmation.
          </p>
          <select
            v-model="selectedRoom"
            class="mt-5 w-full rounded-xl border border-slate-200 px-3 py-3"
          >
            <option :value="null">Select an available room</option>
            <option
              v-for="room in data.rooms.value.filter(
                (item) =>
                  item.status !== 'MAINTENANCE' &&
                  item.currentOccupants < item.capacity,
              )"
              :key="room.id"
              :value="room.id"
            >
              {{ room.roomNumber }} · {{ room.building }}
            </option></select
          ><button
            class="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white"
            @click="generate"
          >
            Generate invitation code
          </button>
          <p
            v-if="notice"
            role="status"
            class="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800"
          >
            {{ notice }}
          </p>
        </section>
        <section
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3 class="font-bold">Invitation history</h3>
          <div class="relative mt-4">
            <input
              v-model="invitationSearch"
              type="search"
              aria-label="Search all modules or filter invitations"
              placeholder="Search all modules or filter invitations..."
              class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
            <GlobalSearchResults :query="invitationSearch" />
          </div>
          <div class="mt-4 divide-y divide-slate-100">
            <div
              v-for="invitation in filteredInvitations"
              :key="invitation.id"
              class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <strong class="block font-mono text-brand-700">{{
                  invitation.code
                }}</strong
                ><span class="text-sm text-slate-500"
                  >{{ roomName(invitation.roomId) }} · expires
                  {{ invitation.expirationDate }}</span
                >
              </div>
              <div class="flex flex-wrap items-center gap-2 sm:justify-end">
                <span
                  class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold"
                  >{{ invitation.status }}</span
                ><button
                  class="text-sm font-semibold text-brand-600"
                  @click="copy(invitation.code)"
                >
                  Copy</button
                ><button
                  class="text-sm font-semibold text-slate-600"
                  :disabled="isGeneratingQr"
                  @click="generateQr(invitation)"
                >
                  Generate QR Code</button
                ><button
                  v-if="invitation.status === 'ACTIVE'"
                  class="text-sm font-semibold text-rose-600"
                  @click="revoke(invitation.id)"
                >
                  Revoke
                </button>
              </div>
            </div>
            <p
              v-if="!filteredInvitations.length && !invitationSearch"
              class="py-8 text-center text-sm text-slate-500"
            >
              No invitations yet.
            </p>
            <p
              v-else-if="!filteredInvitations.length"
              class="py-8 text-center text-sm text-slate-500"
            >
              No invitations match "{{ invitationSearch }}".
            </p>
          </div>
        </section>
      </div>
    </div>
    <div
      v-if="qrInvitation"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invitation-qr-title"
      @click.self="qrInvitation = null"
    >
      <section
        class="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-8"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 id="invitation-qr-title" class="text-xl font-bold">
              Room Invitation QR Code
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              Scan to review this invitation. Acceptance requires signing in.
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close QR code dialog"
            @click="qrInvitation = null"
          >
            Close
          </button>
        </div>
        <div class="mt-5 flex justify-center rounded-xl bg-white p-3">
          <img
            v-if="qrDataUrl"
            :src="qrDataUrl"
            alt="QR code for the room invitation"
            class="h-64 w-64 max-w-full object-contain sm:h-72 sm:w-72"
          />
        </div>
        <dl class="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt class="font-medium text-slate-500">Invitation</dt>
          <dd class="break-all font-mono">{{ qrInvitation.code }}</dd>
          <dt class="font-medium text-slate-500">Room</dt>
          <dd>{{ roomName(qrInvitation.roomId) }}</dd>
          <dt class="font-medium text-slate-500">Status</dt>
          <dd>{{ qrInvitation.status }}</dd>
          <dt class="font-medium text-slate-500">Expires</dt>
          <dd>{{ qrInvitation.expirationDate }}</dd>
          <dt class="font-medium text-slate-500">Invitation link</dt>
          <dd class="break-all text-brand-700">{{ invitationUrl }}</dd>
        </dl>
        <div class="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            class="rounded-xl border border-slate-300 px-4 py-2.5 font-semibold text-slate-700"
            @click="copyInvitationLink"
          >
            Copy Invitation Link
          </button>
          <button
            type="button"
            class="rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white"
            @click="saveQr"
          >
            Save QR Code
          </button>
        </div>
      </section>
    </div>
  </AdminShell>
</template>
