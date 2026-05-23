<template>
  <div class="momo-view overflow-y-auto h-full">
    <div class="momo-view__content px-lg py-md">
      <header class="flex items-center gap-md mb-lg">
        <button class="neo-button neo-button--ghost" @click="$router.back()">
          <span class="material-symbols-rounded">arrow_back</span>
        </button>
        <h1 class="text-xl font-bold">Mobile Money</h1>
      </header>

      <!-- Provider cards -->
      <div class="flex flex-col gap-md mb-lg">
        <div
          v-for="provider in providers"
          :key="provider.key"
          class="momo-view__provider neo-card-sm"
          :style="{ borderLeft: `4px solid ${provider.color}` }"
        >
          <div class="flex items-center gap-md">
            <div class="momo-view__logo" :style="{ background: provider.color + '20' }">
              <span class="font-bold text-sm" :style="{ color: provider.color }">{{
                provider.abbr
              }}</span>
            </div>
            <div class="flex-1">
              <p class="font-semibold text-base">{{ provider.name }}</p>
              <p class="text-xs text-tertiary">{{ provider.desc }}</p>
            </div>
          </div>

          <!-- Linked accounts for this provider -->
          <div
            v-for="acc in getAccountsFor(provider.key)"
            :key="acc.id"
            class="momo-view__linked mt-md"
          >
            <div class="flex items-center gap-sm">
              <span class="material-symbols-rounded icon-sm text-success">check_circle</span>
              <span class="text-sm font-semibold">{{ acc.phoneNumber }}</span>
              <span class="text-xs text-tertiary">{{ acc.nickname }}</span>
              <button
                class="neo-button neo-button--ghost"
                style="margin-left: auto; padding: 4px"
                @click="unlinkAccount(acc.id)"
              >
                <span class="material-symbols-rounded icon-sm text-danger">link_off</span>
              </button>
            </div>
          </div>

          <!-- Link form -->
          <div v-if="linkingProvider === provider.key" class="momo-view__form mt-md">
            <input
              v-model="linkPhone"
              class="neo-input mb-sm"
              placeholder="Phone number (e.g. 024XXXXXXX)"
              type="tel"
            />
            <input
              v-model="linkNickname"
              class="neo-input mb-sm"
              placeholder="Nickname (optional)"
            />
            <div class="flex gap-sm">
              <button class="neo-button neo-button--ghost flex-1" @click="linkingProvider = null">
                Cancel
              </button>
              <button
                class="neo-button neo-button--primary flex-1"
                @click="linkAccount(provider.key)"
                :disabled="!linkPhone.trim()"
              >
                Link
              </button>
            </div>
          </div>

          <button
            v-else
            class="neo-button neo-button--ghost w-full mt-md"
            @click="startLinking(provider.key)"
            style="display: flex; align-items: center; justify-content: center; gap: 6px"
          >
            <span class="material-symbols-rounded icon-sm">add</span>
            Link Account
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useMomoStore } from '@/stores/momo';
  import type { MomoProvider } from '@/types';

  const momoStore = useMomoStore();

  const linkingProvider = ref<MomoProvider | null>(null);
  const linkPhone = ref('');
  const linkNickname = ref('');
  const linkError = ref('');

  const providers = [
    {
      key: 'mtn' as MomoProvider,
      name: 'MTN Mobile Money',
      abbr: 'MTN',
      color: '#FFCC00',
      desc: 'MoMo by MTN Ghana',
    },
    {
      key: 'telecel' as MomoProvider,
      name: 'Telecel Cash',
      abbr: 'TEL',
      color: '#E40521',
      desc: 'Cash by Telecel Ghana',
    },
    {
      key: 'airteltigo' as MomoProvider,
      name: 'AirtelTigo Money',
      abbr: 'AT',
      color: '#E40000',
      desc: 'Money by AirtelTigo',
    },
  ];

  function getAccountsFor(provider: MomoProvider) {
    return momoStore.accounts.filter((a) => a.provider === provider);
  }

  function startLinking(provider: MomoProvider) {
    linkingProvider.value = provider;
    linkPhone.value = '';
    linkNickname.value = '';
    linkError.value = '';
  }

  async function linkAccount(provider: MomoProvider) {
    if (!linkPhone.value.trim()) return;
    try {
      await momoStore.linkAccount(provider, linkPhone.value.trim(), linkNickname.value.trim());
      linkingProvider.value = null;
    } catch (err) {
      linkError.value = err instanceof Error ? err.message : 'Failed to link';
    }
  }

  async function unlinkAccount(id: string) {
    await momoStore.unlinkAccount(id);
  }
</script>

<style lang="scss">
  .momo-view {
    &__provider {
      border-radius: $radius-lg;
    }
    &__logo {
      width: 44px;
      height: 44px;
      border-radius: $radius-md;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    &__linked {
      padding: $space-sm $space-md;
      background: var(--surface-alt);
      border-radius: $radius-sm;
    }
  }
</style>
