<template>
  <nav class="topbar" :class="{ 'topbar--scrolled': scrolled }">
    <div class="topbar-inner">
      <div class="topbar-brand">
        <div class="brand-logo">
          <span class="brand-emoji">
            <img src="/icon/pig-logo.png" alt="智慧猪群识别系统" />
          </span>
          <div class="brand-glow"></div>
        </div>
        <div class="brand-text">
          <span class="brand-name">智慧猪群识别系统</span>
          <span class="brand-tag">AI</span>
        </div>
        <div class="brand-sep"></div>
        <span class="brand-sub">v1.0</span>
        <ServiceStatusPill @service-online="$emit('service-online')" />
      </div>

      <div class="topbar-center">
        <FarmSelector v-if="routePath === '/'"
          :selectedFarmId="selectedFarmId"
          :farms="farms"
          :showDropdown="showFarmDropdown"
          :farmName="farmName"
          @toggle="$emit('toggle-farm-dropdown')"
          @select="farmId => $emit('select-farm', farmId)"
          @manage="$emit('manage-farm')"
          @close="$emit('close-dropdown')"
        />
      </div>

      <div class="topbar-actions">
        <label v-if="routePath === '/'" class="btn-ghost" :class="{ 'btn-disabled': !selectedFarmId }" :for="selectedFarmId ? 'top-file-input' : ''"
          @pointerdown="!selectedFarmId && $emit('need-farm')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          单张识别
        </label>
        <input v-if="routePath === '/'" id="top-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/bmp" style="display:none"
          multiple @change="onTopFileChange" />

        <label v-if="routePath === '/'" class="btn-ghost" :class="{ 'btn-disabled': !selectedFarmId }" :for="selectedFarmId ? 'batch-folder-input' : ''" style="margin-left:4px"
          @pointerdown="!selectedFarmId && $emit('need-farm')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
          批量识别
        </label>
        <input v-if="routePath === '/'" id="batch-folder-input" type="file" webkitdirectory directory multiple
          style="display:none" @change="onBatchFolderChange" />

        <button v-if="routePath === '/'" class="btn-primary"
          :disabled="(!hasImage && !batchTree) || !selectedFarmId || isAnalyzing || !serviceOnline" @click="$emit('analyze')"
          @pointerdown="(!selectedFarmId || (!hasImage && !batchTree)) && $emit('need-farm')"
          :title="btnTitle">
          <span class="btn-primary-inner">
            <span v-if="isAnalyzing" class="btn-spinner"></span>
            <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {{ isAnalyzing ? '识别中…' : hasResult ? '重新识别' : '开始识别' }}
          </span>
          <div class="btn-shine"></div>
        </button>
        <span v-if="!serviceOnline" class="btn-hint btn-hint--error">服务离线，无法识别</span>

        <button v-if="routePath === '/' && (hasImage || batchTree)" class="btn-ghost btn-clear" @click="$emit('clear-image')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <button v-if="routePath === '/stats'" class="btn-ghost" @click="$emit('manage-farm')" title="编辑猪场">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          编辑猪场
        </button>

        <router-link v-if="routePath === '/'" to="/stats" class="btn-ghost" title="查看统计数据">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          统计页面
        </router-link>
        <router-link v-else-if="routePath === '/stats'" to="/" class="btn-ghost" title="返回识别页面">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          识别页面
        </router-link>
      </div>
    </div>
    <div class="topbar-scan" v-if="isAnalyzing">
      <div class="topbar-scan-fill" :style="{ width: uploadProgress + '%' }"></div>
      <div class="topbar-scan-glow" :style="{ left: uploadProgress + '%' }"></div>
    </div>
  </nav>
</template>

<script>
import ServiceStatusPill from '@/components/ServiceStatusPill.vue'
import FarmSelector from '@/components/FarmSelector.vue'

export default {
  name: 'TopBar',
  components: { ServiceStatusPill, FarmSelector },
  props: {
    scrolled: { type: Boolean, default: false },
    isAnalyzing: { type: Boolean, default: false },
    hasResult: { type: Boolean, default: false },
    uploadProgress: { type: Number, default: 0 },
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
  },
  methods: {
    onTopFileChange(e) {
      const files = Array.from(e.target.files)
      if (files.length > 0) this.$emit('file-change', files)
      e.target.value = ''
    },
    onBatchFolderChange(e) {
      this.$emit('batch-folder-change', e)
    }
  }
}
</script>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 200;
  background: rgba(242, 242, 247, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid var(--sep);
  transition: opacity 0.3s ease
}

.topbar--scrolled {
  opacity: 0;
  pointer-events: none
}

.topbar-inner {
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 28px;
  height: 52px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 14px
}

.topbar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-right: 4px
}

.topbar-center {
  display: flex;
  justify-content: center;
  align-items: center
}

.brand-logo {
  position: relative;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 9px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
  overflow: hidden
}

.brand-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover
}

.brand-emoji { font-size: 19px; line-height: 1 }

.brand-glow {
  position: absolute;
  inset: -4px;
  border-radius: 13px;
  background: radial-gradient(circle, rgba(255, 107, 129, 0.2) 0%, transparent 70%);
  animation: brandGlow 3s ease-in-out infinite
}

@keyframes brandGlow {
  0%, 100% { opacity: 0.5 }
  50% { opacity: 1 }
}

.brand-text { display: flex; align-items: baseline; gap: 3px }
.brand-name { font-size: 16px; font-weight: 700; letter-spacing: -0.5px; color: var(--text) }
.brand-tag { font-size: 10px; font-weight: 600; color: var(--blue); letter-spacing: 0.04em }
.brand-sep { width: 1px; height: 18px; background: var(--sep-opaque); margin: 0 4px }
.brand-sub { font-size: 12px; color: var(--text-3) }

.topbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px
}

.topbar-scan {
  height: 2px;
  background: var(--sep);
  position: relative;
  overflow: visible
}

.topbar-scan-fill {
  height: 100%;
  background: var(--blue);
  transition: width 0.3s ease;
  border-radius: 1px
}

.topbar-scan-glow {
  position: absolute;
  top: -3px;
  width: 24px;
  height: 8px;
  background: radial-gradient(circle, var(--blue), transparent);
  transform: translateX(-50%);
  transition: left 0.3s ease;
  filter: blur(3px)
}

.btn-disabled {
  opacity: 0.4;
  cursor: not-allowed
}
</style>
