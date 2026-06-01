<template>
  <div class="img-card glass-card">
    <div class="img-card-header">
      <div class="img-card-header-left">
        <span class="traffic-dot dot-green"></span>
        <span class="img-card-title">检测结果</span>
        <div class="view-tabs">
          <button class="view-tab" :class="{ 'view-tab--active': view === 'summary' }" @click="view = 'summary'">摘要</button>
          <button class="view-tab" :class="{ 'view-tab--active': view === 'detail' }" @click="view = 'detail'">详情</button>
        </div>
      </div>
      <div class="img-card-header-right">
        <button class="btn-header" @click="$emit('back')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          返回目录
        </button>
        <button class="btn-header btn-header--primary" @click="$emit('download')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          下载 Excel
        </button>
      </div>
    </div>

    <!-- 摘要视图 -->
    <div v-if="view === 'summary'" class="batch-body">
      <div class="batch-summary">
        <div class="batch-summary-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <div class="batch-summary-title">批量检测完成</div>
        <div class="batch-summary-stats">
          <div class="batch-stat-item">
            <span class="batch-stat-num">{{ batchResults.total_photos }}</span>
            <span class="batch-stat-label">张图片</span>
          </div>
          <div class="batch-stat-sep"></div>
          <div class="batch-stat-item">
            <span class="batch-stat-num">{{ batchResults.units.length }}</span>
            <span class="batch-stat-label">个单元</span>
          </div>
          <div class="batch-stat-sep"></div>
          <div class="batch-stat-item">
            <span class="batch-stat-num batch-stat-num--green">{{ batchResults.total_pigs }}</span>
            <span class="batch-stat-label">头猪</span>
          </div>
        </div>
        <div class="batch-unit-list">
          <div v-for="unit in batchResults.units" :key="unit.unit_name" class="batch-unit-item">
            <span class="batch-unit-name">{{ unit.unit_name }}</span>
            <span class="batch-unit-bar">
              <span class="batch-unit-bar-fill" :style="{ width: unitBarWidth(unit.subtotal) }"></span>
            </span>
            <span class="batch-unit-count">{{ unit.subtotal }} 头</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 详情视图 -->
    <div v-else class="batch-table-wrap">
      <table class="batch-table">
        <thead>
          <tr>
            <th>{{ batchResults.batch_name }}</th>
            <th>单元</th>
            <th>栏舍</th>
            <th>猪数</th>
          </tr>
        </thead>
        <tbody v-for="unit in batchResults.units" :key="unit.unit_name">
          <tr v-for="(pen, pi) in unit.pens" :key="pi"
            class="batch-pen-row">
            <td></td>
            <td v-if="pi === 0" :rowspan="unit.pens.length">{{ unit.unit_name }}</td>
            <td v-if="pi > 0" style="display:none"></td>
            <td>{{ pen.pen_name }}</td>
            <td class="batch-num">{{ pen.pig_count }}</td>
          </tr>
          <tr class="subtotal-row">
            <td></td>
            <td colspan="2">{{ unit.unit_name }} 小计</td>
            <td class="batch-num">{{ unit.subtotal }}</td>
          </tr>
        </tbody>
      </table>
      <div class="batch-total-bar">
        <span></span>
        <span>合计（{{ batchResults.units.length }} 单元，{{ batchResults.total_photos }} 张）</span>
        <span></span>
        <span class="batch-num">{{ batchResults.total_pigs }}</span>
      </div>
    </div>

  </div>
</template>

<script>
export default {
  name: 'BatchResultsTable',
  props: {
    batchResults: { type: Object, required: true }
  },
  data() {
    return {
      view: 'summary'
    }
  },
  computed: {
    maxSubtotal() {
      if (!this.batchResults || !this.batchResults.units) return 1
      return Math.max(...this.batchResults.units.map(u => u.subtotal), 1)
    }
  },
  methods: {
    unitBarWidth(subtotal) {
      return Math.round((subtotal / this.maxSubtotal) * 100) + '%'
    }
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
  flex-shrink: 0
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

.dot-green { background: var(--green); box-shadow: 0 0 6px rgba(52, 199, 89, 0.45) }

.img-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text)
}

/* ── 视图切换 Tab ── */
.view-tabs {
  display: flex;
  gap: 2px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  padding: 2px;
  margin-left: 6px
}

.view-tab {
  padding: 4px 12px;
  border-radius: 6px;
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  cursor: pointer;
  transition: all 0.15s
}

.view-tab--active {
  background: white;
  color: var(--text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08)
}

.view-tab:hover:not(.view-tab--active) {
  color: var(--text-2)
}

/* ── 按钮 ── */
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

/* ── 摘要视图 ── */
.batch-body {
  flex: 1;
  overflow-y: auto
}

.batch-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 28px 24px;
  text-align: center
}

.batch-summary-icon {
  color: var(--green);
  opacity: 0.7
}

.batch-summary-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text)
}

.batch-summary-stats {
  display: flex;
  align-items: center;
  gap: 18px
}

.batch-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px
}

.batch-stat-num {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums
}

.batch-stat-num--green { color: var(--green) }

.batch-stat-label {
  font-size: 12px;
  color: var(--text-3)
}

.batch-stat-sep {
  width: 1px;
  height: 32px;
  background: var(--sep)
}

.batch-unit-list {
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px
}

.batch-unit-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px
}

.batch-unit-name {
  width: 120px;
  text-align: right;
  font-weight: 500;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0
}

.batch-unit-bar {
  flex: 1;
  height: 8px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 4px;
  overflow: hidden
}

.batch-unit-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--green), rgba(52, 199, 89, 0.6));
  border-radius: 4px;
  transition: width 0.6s var(--ease-out)
}

.batch-unit-count {
  width: 60px;
  text-align: left;
  font-weight: 600;
  color: var(--green);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0
}

/* ── 详情表格 ── */
.batch-table-wrap {
  flex: 1;
  max-height: 480px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--sep) transparent
}

.batch-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px
}

.batch-total-bar {
  display: grid;
  grid-template-columns: 40px 1fr 120px 80px;
  align-items: center;
  padding: 10px 0;
  background: #fff;
  border-top: 2px solid var(--sep);
  font-weight: 700;
  font-size: 13px;
  color: var(--text);
  position: sticky;
  bottom: 0;
  z-index: 2;
  border-radius: 0 0 var(--r-lg) var(--r-lg)
}

.batch-table th {
  padding: 10px 16px;
  text-align: left;
  font-weight: 600;
  color: var(--text-3);
  font-size: 12px;
  background: #fff;
  border-bottom: 1px solid var(--sep);
  position: sticky;
  top: 0;
  z-index: 2
}

.batch-table td {
  padding: 10px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
  color: var(--text-2)
}

.batch-num {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text)
}

.subtotal-row td {
  background: rgba(0, 122, 255, 0.03);
  font-weight: 500;
  color: var(--text-3);
  font-size: 12px
}

.total-row td {
  background: #fff;
  font-weight: 700;
  color: var(--text);
  border-top: 2px solid var(--sep);
  position: sticky;
  bottom: 0;
  z-index: 2
}

.batch-pen-row { transition: background 0.15s; }
.batch-pen-row:hover { background: rgba(0,122,255,0.04); }
</style>
