<template>
  <div class="farm-selector" :class="{ 'farm-selector--capsule': capsule }">
    <div class="farm-select-wrap" @click.stop="$emit('toggle')">
      <!-- 标准模式：完整下拉选择器 -->
      <div v-if="!capsule" class="farm-select" :class="{ 'farm-select--open': showDropdown }">
        <span class="farm-select-value">
          {{ farmName === '未选择' ? '请选择猪场' : farmName }}
        </span>
        <span class="farm-select-arrow" :class="{ 'farm-select-arrow--open': showDropdown }">▼</span>
      </div>
      <!-- 胶囊模式：简洁药丸按钮 -->
      <div v-else class="capsule-farm">
        <Home :size="14" style="flex-shrink:0" /><span class="capsule-farm-name">{{ farmName === '未选择' ? '请选择猪场' : farmName }}</span>
      </div>
      <div class="farm-dropdown" v-if="showDropdown">
        <div v-if="!capsule" class="farm-dropdown-item" :class="{ 'farm-dropdown-item--active': selectedFarmId === null }"
          @click.stop="$emit('select', null)">
          <Home :size="14" class="farm-dropdown-item-icon" />
          <span class="farm-dropdown-item-text">请选择猪场</span>
        </div>
        <div class="farm-dropdown-item" v-for="farm in farms" :key="farm.id"
          :class="{ 'farm-dropdown-item--active': selectedFarmId === farm.id }" @click.stop="$emit('select', farm.id)">
          <Warehouse :size="14" class="farm-dropdown-item-icon" />
          <span class="farm-dropdown-item-text">{{ farm.name }}</span>
        </div>
      </div>
    </div>
    <button v-if="!capsule" class="btn-farm-manage" @click="$emit('manage')" title="管理猪场">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    </button>
  </div>
</template>

<script>
import { Home, Warehouse } from '@lucide/vue'

export default {
  name: 'FarmSelector',
  components: { Home, Warehouse },
  props: {
    selectedFarmId: { type: [Number, null], default: null },
    farms: { type: Array, default: () => [] },
    showDropdown: { type: Boolean, default: false },
    farmName: { type: String, default: '未选择' },
    capsule: { type: Boolean, default: false }
  },
  mounted() {
    this.__onDocClick = (e) => {
      if (this.showDropdown && this.$el && !this.$el.contains(e.target)) {
        this.$emit('close')
      }
    }
    document.addEventListener('click', this.__onDocClick)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.__onDocClick)
  },
  methods: {
    _onClickOutside(e) {
      if (this.showDropdown && this.$el && !this.$el.contains(e.target)) {
        this.$emit('close')
      }
    }
  }
}
</script>

<style scoped>
.farm-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  margin-right: 12px
}

.farm-selector--capsule {
  margin-left: 0;
  margin-right: 0;
  position: relative
}

.farm-select-wrap {
  position: relative;
  display: flex;
  align-items: center
}

.farm-select {
  appearance: none;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  padding: 8px 36px 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  width: auto;
  max-width: 210px;
  height: 42px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: space-between
}

.farm-select:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%);
  border-color: rgba(0, 122, 255, 0.3);
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transform: translateY(-1px)
}

.farm-select--open {
  border-color: var(--blue);
  box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.15), 0 4px 12px rgba(0, 122, 255, 0.15);
  transform: translateY(-1px)
}

.farm-select-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap
}

.farm-select-arrow {
  position: absolute;
  right: 14px;
  font-size: 12px;
  color: var(--text-3);
  pointer-events: none;
  transition: all 0.3s ease;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))
}

.farm-select-arrow--open {
  transform: rotate(180deg);
  color: var(--blue)
}

.farm-select-wrap:hover .farm-select-arrow:not(.farm-select-arrow--open) {
  color: var(--blue);
  transform: translateY(-1px)
}

.farm-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
  z-index: 1000;
  overflow: hidden;
  animation: dropdownIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)
}

/* 胶囊模式下拉定位覆盖 */
.farm-selector--capsule .farm-dropdown {
  top: calc(100% + 10px) !important;
  left: 0 !important;
  right: auto !important;
  min-width: 200px;
  width: max-content;
  z-index: 1100
}

@keyframes dropdownIn {
  from { opacity: 0; transform: translateY(-8px) scale(0.96); transform-origin: top center }
  to { opacity: 1; transform: translateY(0) scale(1) }
}

.farm-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  cursor: pointer;
  transition: all 0.15s ease
}

.farm-dropdown-item:hover {
  background: rgba(0, 122, 255, 0.06)
}

.farm-dropdown-item--active {
  background: rgba(0, 122, 255, 0.08);
  color: var(--blue)
}

.farm-dropdown-item-icon {
  color: var(--text-3);
  flex-shrink: 0
}

.farm-dropdown-item-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap
}

.btn-farm-manage {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06)
}

.btn-farm-manage:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%);
  color: var(--blue);
  border-color: rgba(0, 122, 255, 0.3);
  transform: translateY(-1px)
}

.btn-farm-manage:active {
  transform: translateY(0) scale(0.95)
}

.capsule-farm {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  background: rgba(0, 0, 0, 0.04);
  border-radius: 20px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.15s;
  user-select: none
}

.capsule-farm:hover {
  background: rgba(0, 0, 0, 0.08)
}

.capsule-farm-name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap
}
</style>
