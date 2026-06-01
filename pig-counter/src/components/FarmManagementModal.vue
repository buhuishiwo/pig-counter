<template>
  <transition name="overlay-bloom">
    <div class="modal-backdrop farm-modal" v-if="visible" @click.self="$emit('close')">
      <div class="modal-glass farm-modal-content">
        <div class="farm-modal-header">
          <h3><Warehouse :size="20" style="vertical-align:middle;margin-right:6px" /> 猪场管理</h3>
          <button class="btn-close" @click="$emit('close')">×</button>
        </div>

        <!-- 添加新猪场 -->
        <div class="farm-add-section">
          <input v-model="newFarmName" type="text" class="farm-input" placeholder="输入新猪场名称"
            @keyup.enter="addFarm" maxlength="100" />
          <button class="btn-add-farm" @click="addFarm" :disabled="!newFarmName.trim() || isAddingFarm">
            <span v-if="isAddingFarm" class="btn-spinner-small"></span>
            <span v-else>+ 添加</span>
          </button>
        </div>

        <!-- 猪场列表 -->
        <div class="farm-list">
          <div v-if="farms.length === 0" class="farm-empty">
            暂无猪场，请添加
          </div>
          <div v-for="farm in farms" :key="farm.id" class="farm-item"
            :class="{ 'farm-item--editing': editingFarmId === farm.id }">
            <template v-if="editingFarmId === farm.id">
              <input v-model="editingFarmName" type="text" class="farm-input farm-input--edit"
                @keyup.enter="saveEditFarm" @keyup.esc="cancelEditFarm" ref="editInput" maxlength="100" />
              <div class="farm-actions">
                <button class="btn-farm-save" @click="saveEditFarm" title="保存">✓</button>
                <button class="btn-farm-cancel" @click="cancelEditFarm" title="取消">✕</button>
              </div>
            </template>
            <template v-else>
              <span class="farm-name">{{ farm.name }}</span>
              <span class="farm-date">{{ formatFarmDate(farm.created_at) }}</span>
              <div class="farm-actions">
                <button class="btn-farm-edit" @click="startEditFarm(farm)" title="编辑">✎</button>
                <button class="btn-farm-delete" @click="deleteFarmById(farm.id)" title="删除">🗑</button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
import { createFarm, updateFarm, deleteFarm } from '@/api/farmApi'
import { Warehouse } from '@lucide/vue'

export default {
  name: 'FarmManagementModal',
  components: { Warehouse },
  props: {
    visible: { type: Boolean, default: false },
    farms: { type: Array, default: () => [] }
  },
  data() {
    return {
      newFarmName: '',
      isAddingFarm: false,
      editingFarmId: null,
      editingFarmName: ''
    }
  },
  methods: {
    close() {
      this.$emit('close')
      this.newFarmName = ''
      this.editingFarmId = null
      this.editingFarmName = ''
    },
    async addFarm() {
      const name = this.newFarmName.trim()
      if (!name) return
      this.isAddingFarm = true
      try {
        const response = await createFarm(name)
        if (response.success) {
          this.$emit('farm-added', response.data)
          this.newFarmName = ''
          this.$store.commit('ADD_LOG', { msg: `成功添加猪场：${response.data.name}`, type: 'success' })
        }
      } catch (err) {
        this.$store.commit('ADD_LOG', { msg: '添加猪场失败：' + err.message, type: 'error' })
      } finally {
        this.isAddingFarm = false
      }
    },
    startEditFarm(farm) {
      this.editingFarmId = farm.id
      this.editingFarmName = farm.name
      this.$nextTick(() => {
        const input = this.$refs.editInput
        if (input && input[0]) input[0].focus()
      })
    },
    cancelEditFarm() {
      this.editingFarmId = null
      this.editingFarmName = ''
    },
    async saveEditFarm() {
      const name = this.editingFarmName.trim()
      if (!name || name === this.farms.find(f => f.id === this.editingFarmId)?.name) {
        this.cancelEditFarm()
        return
      }
      try {
        const response = await updateFarm(this.editingFarmId, name)
        if (response.success) {
          this.$emit('farm-updated', response.data)
          this.$store.commit('ADD_LOG', { msg: `成功更新猪场：${response.data.name}`, type: 'success' })
        }
      } catch (err) {
        this.$store.commit('ADD_LOG', { msg: '更新猪场失败：' + err.message, type: 'error' })
      } finally {
        this.editingFarmId = null
        this.editingFarmName = ''
      }
    },
    async deleteFarmById(farmId) {
      const farm = this.farms.find(f => f.id === farmId)
      if (!farm) return
      if (!confirm(`确定要删除猪场"${farm.name}"吗？`)) return
      try {
        const response = await deleteFarm(farmId)
        if (response.success) {
          this.$emit('farm-deleted', farmId)
          this.$store.commit('ADD_LOG', { msg: `成功删除猪场：${farm.name}`, type: 'success' })
        }
      } catch (err) {
        this.$store.commit('ADD_LOG', { msg: '删除猪场失败：' + err.message, type: 'error' })
      }
    },
    formatFarmDate(dateStr) {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    }
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 500;
  background: rgba(242, 242, 247, 0.55);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  display: flex;
  align-items: center;
  justify-content: center
}

.modal-glass {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(32px);
  border: 1px solid rgba(255, 255, 255, 0.92);
  border-radius: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.10), 0 4px 16px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  padding: 44px 56px;
  text-align: center;
  min-width: 300px;
  position: relative;
  overflow: hidden
}

.overlay-bloom-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1)
}

.overlay-bloom-leave-active {
  transition: all 0.25s ease
}

.overlay-bloom-enter-from {
  opacity: 0
}

.overlay-bloom-leave-to {
  opacity: 0
}

.farm-modal .modal-glass {
  padding: 28px;
  min-width: 420px;
  max-width: 520px;
  max-height: 70vh;
  overflow-y: auto;
  text-align: left
}

.farm-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--sep)
}

.farm-modal-header h3 {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  margin: 0
}

.btn-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: rgba(0, 0, 0, 0.04);
  font-size: 20px;
  color: var(--text-3);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1
}

.btn-close:hover {
  background: rgba(0, 0, 0, 0.08);
  color: var(--text)
}

.farm-add-section {
  display: flex;
  gap: 10px;
  margin-bottom: 20px
}

.farm-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.6);
  outline: none;
  transition: all 0.2s ease
}

.farm-input:focus {
  border-color: var(--blue);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.08)
}

.farm-input--edit {
  padding: 8px 12px;
  font-size: 13px
}

.btn-add-farm {
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  background: var(--blue);
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px
}

.btn-add-farm:hover:not(:disabled) {
  background: #0056d6;
  transform: translateY(-1px)
}

.btn-add-farm:disabled {
  opacity: 0.5;
  cursor: not-allowed
}

.btn-spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite
}

.farm-list {
  display: flex;
  flex-direction: column;
  gap: 8px
}

.farm-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-4);
  font-size: 14px
}

.farm-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 12px;
  transition: all 0.2s ease
}

.farm-item:hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: rgba(0, 0, 0, 0.08);
  transform: translateX(2px)
}

.farm-item--editing {
  background: rgba(0, 122, 255, 0.05);
  border-color: rgba(0, 122, 255, 0.2)
}

.farm-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap
}

.farm-date {
  font-size: 12px;
  color: var(--text-4);
  font-variant-numeric: tabular-nums
}

.farm-actions {
  display: flex;
  gap: 6px
}

.farm-actions button {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px
}

.btn-farm-edit {
  color: var(--blue)
}

.btn-farm-edit:hover {
  background: rgba(0, 122, 255, 0.1)
}

.btn-farm-delete {
  color: var(--red)
}

.btn-farm-delete:hover {
  background: rgba(255, 59, 48, 0.1)
}

.btn-farm-save {
  color: var(--green)
}

.btn-farm-save:hover {
  background: rgba(52, 199, 89, 0.1)
}

.btn-farm-cancel {
  color: var(--text-3)
}

.btn-farm-cancel:hover {
  background: rgba(0, 0, 0, 0.06)
}

@keyframes spin {
  to {
    transform: rotate(360deg)
  }
}
</style>
