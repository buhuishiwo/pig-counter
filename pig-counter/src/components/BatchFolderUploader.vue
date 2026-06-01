<template>
  <div class="img-card glass-card">
    <div class="img-card-header">
      <div class="img-card-header-left">
        <span class="traffic-dot dot-blue"></span>
        <span class="img-card-title">文件夹</span>
        <span class="img-card-chip">{{ batchTree.batchName }}</span>
        <span class="img-card-chip">{{ batchTree.totalFiles }} 张</span>
        <span class="img-card-chip">{{ batchTree.unitCount }} 单元</span>
      </div>
      <div class="img-card-header-right">
        <button v-if="hasResults" class="btn-header btn-header--green" @click="$emit('show-results')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          查看结果
        </button>
        <button v-if="hasResults" class="btn-header btn-header--primary" @click="$emit('download-excel')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          下载 Excel
        </button>
      </div>
    </div>
    <div class="img-card-body">
      <div class="folder-tree-view">
        <FolderTree :batchTree="batchTree" />
      </div>
    </div>
  </div>
</template>

<script>
import FolderTree from './FolderTree.vue'

export default {
  name: 'BatchFolderUploader',
  components: { FolderTree },
  props: {
    batchTree: { type: Object, required: true },
    processing: { type: Boolean, default: false },
    hasResults: { type: Boolean, default: false }
  }
}
</script>

<style scoped>
.img-card {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  height: 100%
}

.img-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-bottom: 1px solid var(--sep);
  flex-shrink: 0;
  min-height: 53px
}

.img-card-header-left {
  display: flex;
  align-items: center;
  gap: 8px
}

.img-card-header-right {
  display: flex;
  align-items: center;
  gap: 6px
}

.traffic-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0
}

.dot-blue { background: var(--blue) }

.img-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text)
}

.img-card-chip {
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-3)
}

.img-card-body {
  padding: 14px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column
}

.folder-tree-view {
  border-radius: var(--r-md);
  background: rgba(0, 0, 0, 0.015);
  border: 1px solid var(--sep-opaque);
  flex: 1;
  overflow: hidden;
  min-height: 0
}

.btn-header {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  background: rgba(0, 0, 0, 0.04);
  border: none;
  cursor: pointer;
  transition: all 0.15s
}

.btn-header:hover {
  background: rgba(0, 0, 0, 0.08);
  color: var(--text-2)
}

.btn-header--primary {
  background: var(--blue);
  color: white
}

.btn-header--primary:hover {
  background: #0056d6;
  color: white
}

.btn-header--green {
  color: var(--green);
  background: rgba(52, 199, 89, 0.08)
}

.btn-header--green:hover {
  background: rgba(52, 199, 89, 0.15);
  color: var(--green)
}
</style>
