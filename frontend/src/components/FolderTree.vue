<template>
  <div class="folder-tree-wrapper" ref="wrapper">
    <a-tree
      show-line
      :tree-data="treeData"
      :default-expanded-keys="expandedKeys"
      :selectable="false"
    >
      <template #switcherIcon="{ expanded }">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          :style="{ transform: `rotate(${expanded ? 0 : -90}deg)`, transition: 'transform 0.3s' }">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </template>
      <template #title="{ title, isLeaf }">
        <span :class="isLeaf ? 'tree-leaf' : 'tree-branch'">{{ title }}</span>
      </template>
    </a-tree>
  </div>
</template>

<script>
import { Tree } from 'ant-design-vue'

export default {
  name: 'FolderTree',
  components: { 'a-tree': Tree },
  props: {
    batchTree: { type: Object, required: true }
  },
  computed: {
    treeData() {
      if (!this.batchTree) return []
      const children = []
      for (const [unitName, pens] of Object.entries(this.batchTree.units)) {
        children.push({
          title: unitName,
          key: unitName,
          children: pens.map(pen => ({
            title: pen,
            key: `${unitName}/${pen}`,
            isLeaf: true
          }))
        })
      }
      return [{
        title: this.batchTree.batchName,
        key: this.batchTree.batchName,
        children
      }]
    },
    expandedKeys() {
      if (!this.batchTree) return []
      return [this.batchTree.batchName]
    }
  }
}
</script>

<style>
/* 全局覆盖 Ant Design Tree 样式 */
.ant-tree,
.ant-tree .ant-tree-list,
.ant-tree .ant-tree-list-holder,
.ant-tree .ant-tree-list-holder-inner,
.ant-tree .ant-tree-treenode {
  background: transparent !important;
}

.ant-tree .ant-tree-node-content-wrapper {
  padding: 2px 4px !important;
  border-radius: 4px !important;
  transition: background 0.15s !important;
  background: transparent !important;
}

.ant-tree .ant-tree-node-content-wrapper:hover {
  background: rgba(0, 122, 255, 0.06) !important;
}

.ant-tree .ant-tree-switcher {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 20px !important;
  height: 24px !important;
}

.ant-tree .ant-tree-indent-unit {
  width: 20px !important;
}

.ant-tree .ant-tree-treenode {
  padding: 1px 0 !important;
}
</style>

<style scoped>
.folder-tree-wrapper {
  padding: 6px 0 0 6px;
  font-size: 13px;
  height: 100%;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--sep) transparent
}

.folder-tree-wrapper::-webkit-scrollbar { width: 5px }
.folder-tree-wrapper::-webkit-scrollbar-track { background: transparent }
.folder-tree-wrapper::-webkit-scrollbar-thumb { background: var(--sep); border-radius: 3px }

.tree-branch {
  font-weight: 500;
  color: var(--text-2)
}

.tree-leaf {
  color: var(--text-3)
}
</style>
