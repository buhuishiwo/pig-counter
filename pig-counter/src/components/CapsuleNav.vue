<template>
  <transition name="capsule-drop">
    <div class="capsule-nav" v-show="scrolled">
      <div class="capsule-inner">
        <ServiceStatusPill @service-online="$emit('service-online')" />
        <div class="capsule-sep"></div>

        <FarmSelector capsule
          :selectedFarmId="selectedFarmId"
          :farms="farms"
          :showDropdown="showFarmDropdown"
          :farmName="farmName"
          @toggle="$emit('toggle-farm-dropdown')"
          @select="farmId => $emit('select-farm', farmId)"
          @manage="$emit('manage-farm')"
          @close="$emit('close-dropdown')"
        />

        <button class="capsule-btn-ghost" @click="$emit('manage-farm')" title="管理猪场">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
        <div class="capsule-sep"></div>

        <label class="capsule-btn-ghost" :class="{ 'capsule-btn-disabled': !selectedFarmId }" :for="selectedFarmId ? 'top-file-input' : ''"
          @pointerdown="!selectedFarmId && $emit('need-farm')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          单张识别
        </label>

        <label class="capsule-btn-ghost" :class="{ 'capsule-btn-disabled': !selectedFarmId }" :for="selectedFarmId ? 'batch-folder-input' : ''"
          @pointerdown="!selectedFarmId && $emit('need-farm')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
          批量识别
        </label>

        <button v-if="hasImage || batchTree" class="capsule-btn-ghost capsule-btn-clear" @click="$emit('clear-image')"
          title="清除图片">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <button class="capsule-btn-primary"
          :disabled="(!hasImage && !batchTree) || !selectedFarmId || isAnalyzing || !serviceOnline" @click="$emit('analyze')"
          @pointerdown="(!selectedFarmId || (!hasImage && !batchTree)) && $emit('need-farm')"
          :title="btnTitle">
          <span v-if="isAnalyzing" class="btn-spinner"></span>
          <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {{ isAnalyzing ? '识别中…' : hasResult ? '重新识别' : '开始识别' }}
        </button>

        <router-link v-if="routePath === '/'" to="/stats" class="capsule-btn-ghost">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          统计
        </router-link>
        <router-link v-else-if="routePath === '/stats'" to="/" class="capsule-btn-ghost">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          识别
        </router-link>
      </div>
    </div>
  </transition>
</template>

<script>
import ServiceStatusPill from '@/components/ServiceStatusPill.vue'
import FarmSelector from '@/components/FarmSelector.vue'

export default {
  name: 'CapsuleNav',
  components: { ServiceStatusPill, FarmSelector },
  props: {
    scrolled: { type: Boolean, default: false },
    isAnalyzing: { type: Boolean, default: false },
    hasResult: { type: Boolean, default: false },
    hasImage: { type: Boolean, default: false },
    batchTree: { type: Object, default: null },
    selectedFarmId: { type: [Number, null], default: null },
    serviceOnline: { type: Boolean, default: false },
    farmName: { type: String, default: '未选择' },
    farms: { type: Array, default: () => [] },
    showFarmDropdown: { type: Boolean, default: false },
    routePath: { type: String, default: '/' }
  },
  computed: {
    btnTitle() {
      if (!this.selectedFarmId) return '请先选择猪场'
      if (!this.serviceOnline) return '后端服务离线，请检查服务状态'
      return ''
    }
  }
}
</script>

<style scoped>
.capsule-nav {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999
}

.capsule-inner {
  overflow: visible;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(28px) saturate(200%);
  -webkit-backdrop-filter: blur(28px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.92);
  border-radius: 100px;
  box-shadow: 0 6px 32px rgba(0, 0, 0, 0.12), 0 1px 6px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.85);
  white-space: nowrap
}

.capsule-sep { width: 1px; height: 20px; background: var(--sep); flex-shrink: 0 }

.capsule-btn-ghost {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  background: rgba(0, 0, 0, 0.04);
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  text-decoration: none
}

.capsule-btn-ghost:hover { background: rgba(0, 0, 0, 0.08) }
.capsule-btn-clear:hover { background: rgba(255, 59, 48, 0.08); color: var(--red) }

.capsule-btn-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  background: var(--blue);
  color: white;
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 122, 255, 0.35);
  transition: all 0.2s ease
}

.capsule-btn-primary:hover:not(:disabled) {
  background: #0071f3;
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 122, 255, 0.45)
}

.capsule-btn-primary:disabled {
  background: var(--sep-opaque);
  color: var(--text-4);
  box-shadow: none;
  cursor: not-allowed
}

.btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite
}

@keyframes spin { to { transform: rotate(360deg) } }

/* capsule-drop transition */
.capsule-drop-enter-active {
  transition: transform 0.5s cubic-bezier(0.34, 1.35, 0.64, 1), opacity 0.3s ease
}

.capsule-drop-leave-active {
  transition: transform 0.28s ease, opacity 0.22s ease
}

.capsule-drop-enter-from,
.capsule-drop-leave-to {
  transform: translateX(-50%) translateY(-64px);
  opacity: 0
}

.capsule-drop-enter-to,
.capsule-drop-leave-from {
  transform: translateX(-50%) translateY(0);
  opacity: 1
}

.capsule-btn-disabled {
  opacity: 0.4;
  cursor: not-allowed
}
</style>
