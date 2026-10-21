<template>
  <div class="farm-selector" :class="{ 'farm-selector--capsule': capsule }">
    <!-- 胶囊模式：保留原样式 -->
    <div v-if="capsule" class="farm-select-wrap" @click.stop="$emit('toggle')">
      <div class="capsule-farm">
        <Home :size="14" style="flex-shrink:0" /><span class="capsule-farm-name">{{ farmName === '未选择' ? '请选择猪场' : farmName }}</span>
      </div>
      <div class="farm-dropdown" v-if="showDropdown">
        <div class="farm-dropdown-item" v-for="farm in farms" :key="farm.id" :class="{ 'farm-dropdown-item--active': selectedFarmId === farm.id }" @click.stop="$emit('select', farm.id)">
          <Warehouse :size="14" class="farm-dropdown-item-icon" />
          <span class="farm-dropdown-item-text">{{ farm.name }}</span>
        </div>
      </div>
    </div>
    <!-- 标准模式：Ant Design 风格 -->
    <template v-else>
      <div class="antd-select" :class="{ 'antd-select--open': showDropdown }" @click.stop="$emit('toggle')">
        <div class="antd-select-selector">
          <span class="antd-select-selection-item" :class="{ 'antd-select-selection-placeholder': !selectedFarmId }">
            {{ truncateFarm(selectedFarmId ? farmName : '请选择猪场') }}
          </span>
          <span class="antd-select-arrow">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
          <span v-if="selectedFarmId" class="antd-select-clear" @click.stop="$emit('select', null)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </span>
        </div>
        <transition name="dropdown-fade">
          <div v-if="showDropdown" class="antd-select-dropdown" @click.stop>
            <div v-for="farm in farms" :key="farm.id" class="antd-select-item" :class="{ 'antd-select-item--selected': selectedFarmId === farm.id }" @click.stop="$emit('select', farm.id)">
              <Warehouse :size="14" class="antd-item-icon" /> {{ truncateFarm(farm.name) }}
            </div>
          </div>
        </transition>
      </div>
      <button class="btn-farm-manage" @click="$emit('manage')" title="编辑猪场">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </button>
    </template>
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
    truncateFarm(name) {
      return name && name.length > 11 ? name.slice(0, 11) + '...' : name
    }
  }
}
</script>

<style scoped>
.farm-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.farm-selector--capsule {
  position: relative;
}

.farm-select-wrap {
  position: relative;
  display: flex;
  align-items: center;
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
  user-select: none;
}
.capsule-farm:hover { background: rgba(0, 0, 0, 0.08) }
.capsule-farm-name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 胶囊模式下拉 */
.farm-selector--capsule .farm-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  min-width: 200px;
  max-width: 280px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.12);
  z-index: 1100;
  overflow: hidden;
  animation: dropdownIn 0.2s ease;
}
@keyframes dropdownIn {
  from { opacity: 0; transform: translateY(-4px) }
  to { opacity: 1; transform: translateY(0) }
}
.farm-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  cursor: pointer;
  transition: background 0.1s;
}
.farm-dropdown-item:hover { background: rgba(0,0,0,0.04) }
.farm-dropdown-item--active { color: var(--blue); font-weight: 600; background: rgba(0,122,255,0.06) }
.farm-dropdown-item-icon { color: var(--text-3); flex-shrink: 0 }
.farm-dropdown-item-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }

/* Ant Design 风格 Select（标准模式）*/
.antd-select {
  position: relative;
  width: 200px;
  font-size: 14px;
  cursor: pointer;
}
.antd-select-selector {
  display: flex;
  align-items: center;
  padding: 7px 13px;
  border-radius: 20px;
  border: 1px solid #d9d9d9;
  background: #fff;
  transition: all 0.2s;
  min-height: 36px;
}
.antd-select:hover .antd-select-selector { border-color: var(--blue); }
.antd-select--open .antd-select-selector { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(0,122,255,0.1); }
.antd-select-selection-item {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}
.antd-select-selection-placeholder { color: #bfbfbf }
.antd-select-arrow {
  color: #bfbfbf;
  font-size: 10px;
  margin-left: 4px;
  transition: transform 0.2s;
  flex-shrink: 0;
}
.antd-select--open .antd-select-arrow { transform: rotate(180deg) }
.antd-select-clear {
  display: none;
  color: #bfbfbf;
  margin-left: 4px;
  flex-shrink: 0;
}
.antd-select:hover .antd-select-clear { display: flex }
.antd-select:hover .antd-select-arrow { display: none }
.antd-select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.12);
  padding: 4px 0;
  z-index: 1000;
  max-height: 250px;
  overflow-y: auto;
}
.antd-select-item {
  padding: 6px 12px;
  font-size: 14px;
  color: var(--text);
  transition: background 0.1s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.antd-select-item:hover { background: rgba(0,0,0,0.04) }
.antd-select-item--selected { color: var(--blue); font-weight: 600; background: rgba(0,122,255,0.06) }
.antd-item-icon { color: var(--text-3); flex-shrink: 0; vertical-align: -2px; margin-right: 4px }
.dropdown-fade-enter-active, .dropdown-fade-leave-active { transition: opacity 0.15s, transform 0.15s }
.dropdown-fade-enter-from, .dropdown-fade-leave-to { opacity: 0; transform: translateY(-4px) }

.btn-farm-manage {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid #d9d9d9;
  background: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  transition: all 0.2s;
  flex-shrink: 0;
}
.btn-farm-manage:hover { border-color: var(--blue); color: var(--blue) }
</style>
