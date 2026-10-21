<template>
  <div class="farm-info-card glass-card">
    <div class="farm-info-header">
      <Warehouse :size="20" class="farm-info-icon" />
      <div class="farm-info-title">
        <span class="farm-info-label">当前猪场</span>
        <span class="farm-info-name" :class="{ 'farm-info-name--placeholder': !selectedFarmId }" :title="farmName && farmName.length > 11 ? farmName : ''">{{ farmName && farmName.length > 11 ? farmName.slice(0, 11) + '...' : farmName }}</span>
      </div>
      <span v-if="!selectedFarmId" class="farm-info-hint">未选择</span>
    </div>
    <div class="farm-info-sep"></div>
    <div class="farm-warning-banner" :class="{ 'farm-warning-banner--hidden': selectedFarmId && hasImage, 'farm-warning-banner--flash': flash }">
      <AlertTriangle :size="14" class="farm-warning-icon" />
      <span class="farm-warning-text" v-if="!selectedFarmId">请先在上方选择猪场，才能进行图片识别</span>
      <span class="farm-warning-text" v-else>请先上传图片，才能进行图片识别</span>
    </div>
  </div>
</template>

<script>
import { Warehouse, AlertTriangle } from '@lucide/vue'

export default {
  name: 'FarmInfoCard',
  components: { Warehouse, AlertTriangle },
  props: {
    selectedFarmId: { type: [Number, String, null], default: null },
    farmName: { type: String, default: '未选择' },
    hasImage: { type: Boolean, default: false },
    flash: { type: Boolean, default: false }
  }
}
</script>

<style scoped>
.farm-info-card {
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  width: 100%;
  animation: sectionIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
}

@keyframes sectionIn {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: none; }
}

.farm-info-header {
  display: flex;
  align-items: center;
  gap: 14px
}

.farm-info-icon {
  color: var(--text-2);
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1))
}

.farm-info-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0
}

.farm-info-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-4);
  text-transform: uppercase;
  letter-spacing: 0.5px
}

.farm-info-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 230px
}

.farm-info-name--placeholder {
  color: var(--text-4);
  font-style: italic
}

.farm-info-hint {
  font-size: 12px;
  color: var(--text-4);
  flex-shrink: 0
}

.farm-info-sep {
  height: 1px;
  background: var(--sep);
  margin: 10px 0
}

.farm-warning-banner {
  display: flex !important;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(255, 149, 0, 0.12);
  border-radius: 10px;
  border: 1px solid rgba(255, 149, 0, 0.2);
  visibility: visible;
  opacity: 1;
  transition: opacity 0.2s ease
}

.farm-warning-banner--hidden {
  display: flex !important;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
  height: 0;
  padding: 0;
  margin: 0;
  border: none;
  overflow: hidden
}

.farm-warning-banner--flash {
  animation: warningFlash 1.2s ease
}

@keyframes warningFlash {
  0%, 100% { border-color: rgba(255, 149, 0, 0.2); box-shadow: none; }
  15% { border-color: rgba(255, 149, 0, 0.8); box-shadow: 0 0 12px rgba(255, 149, 0, 0.3); }
  30% { border-color: rgba(255, 149, 0, 0.2); box-shadow: none; }
  50% { border-color: rgba(255, 149, 0, 0.8); box-shadow: 0 0 12px rgba(255, 149, 0, 0.3); }
  65% { border-color: rgba(255, 149, 0, 0.2); box-shadow: none; }
}

.farm-warning-icon {
  color: var(--orange);
  flex-shrink: 0
}

.farm-warning-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--orange)
}
</style>
