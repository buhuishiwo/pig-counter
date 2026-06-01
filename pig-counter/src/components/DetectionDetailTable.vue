<template>
  <div class="glass-card detail-card">
    <div class="detail-header">
      <div class="detail-title-wrap">
        <div class="detail-pulse"></div>
        <span class="detail-title">检测明细</span>
      </div>
      <div class="detail-pills">
        <span class="detail-pill">共 {{ pigCount }} 头</span>
        <span class="detail-pill" v-if="inferenceTime">推理耗时 {{ inferenceTime }} ms</span>
        <span class="detail-pill" :class="confClass">置信度 {{ confidencePct }}%</span>
      </div>
    </div>
    <div class="table-scroll">
      <table class="det-table">
        <thead>
          <tr>
            <th>#</th>
            <th>类别</th>
            <th>置信度</th>
            <th>坐标</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(box, i) in boxes" :key="i" class="det-row"
            :class="{ 'det-row--hover': hoveredBox === i }" :style="{ '--row-delay': (i * 30) + 'ms' }"
            @mouseenter="$emit('hover', i)" @mouseleave="$emit('hover', null)">
            <td class="td-idx">{{ i + 1 }}</td>
            <td><span class="cls-pill">{{ box.class_name === 'pig' ? '猪' : box.class_name }}</span></td>
            <td>
              <div class="conf-cell">
                <div class="conf-track">
                  <div class="conf-fill" :class="getConfClass(box.score)"
                    :style="{ width: (box.score * 100) + '%' }">
                  </div>
                </div>
                <span class="conf-val" :class="getConfClass(box.score)">{{ (box.score * 100).toFixed(1) }}%</span>
              </div>
            </td>
            <td class="td-coord">{{ formatCoord(box) }}</td>
            <td>
              <span class="status-chip" :class="box.score >= 0.7 ? 'chip-ok' : 'chip-warn'">{{ box.score >= 0.7 ?
                '有效' : '低置信' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DetectionDetailTable',
  props: {
    boxes: { type: Array, default: () => [] },
    pigCount: { type: Number, default: 0 },
    confidencePct: { type: Number, default: 0 },
    confClass: { type: String, default: '' },
    hoveredBox: { type: Number, default: null },
    imageMeta: { type: Object, default: null },
    inferenceTime: { type: [Number, String], default: null }
  },
  methods: {
    getConfClass(score) {
      if (score >= 0.85) return 'conf-high'
      if (score >= 0.65) return 'conf-mid'
      return 'conf-low'
    },
    formatCoord(box) {
      const isN = box.x1 <= 1 && box.y1 <= 1
      const w = (this.imageMeta && this.imageMeta.width) || 1
      const h = (this.imageMeta && this.imageMeta.height) || 1
      if (isN) return Math.round(box.x1 * w) + ', ' + Math.round(box.y1 * h) + ', ' + Math.round((box.x1 + box.x2) * w) + ', ' + Math.round((box.y1 + box.y2) * h)
      return Math.round(box.x1) + ', ' + Math.round(box.y1) + ', ' + Math.round(box.x2) + ', ' + Math.round(box.y2)
    }
  }
}
</script>

<style scoped>
.detail-card {
  overflow: hidden
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  border-bottom: 1px solid var(--sep)
}

.detail-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px
}

.detail-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green);
  animation: detailPulse 2s infinite
}

@keyframes detailPulse {
  0%, 100% { opacity: 1; transform: scale(1) }
  50% { opacity: 0.5; transform: scale(0.8) }
}

.detail-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text)
}

.detail-pills {
  display: flex;
  gap: 8px
}

.detail-pill {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-2)
}

.detail-pill.conf-high {
  color: var(--green)
}

.detail-pill.conf-mid {
  color: var(--orange)
}

.detail-pill.conf-low {
  color: var(--red)
}

.table-scroll {
  overflow-x: auto;
  max-height: 320px;
  overflow-y: auto
}

.table-scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px
}

.table-scroll::-webkit-scrollbar-track {
  background: transparent
}

.table-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px
}

.table-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2)
}

.det-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px
}

.det-table th {
  padding: 10px 16px;
  text-align: left;
  font-weight: 600;
  color: var(--text-3);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  background: #fff;
  border-bottom: 1px solid var(--sep);
  position: sticky;
  top: 0;
  z-index: 2
}

.det-row {
  animation: rowFadeIn 0.3s ease calc(var(--row-delay, 0ms)) both;
  transition: background 0.15s
}

@keyframes rowFadeIn {
  from { opacity: 0; transform: translateX(-8px) }
  to { opacity: 1; transform: none }
}

.det-row td {
  padding: 10px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
  color: var(--text-2)
}

.det-row:last-child td {
  border-bottom: none
}

.det-row--hover td {
  background: rgba(0, 122, 255, 0.06)
}

.td-idx {
  color: var(--text-4);
  font-variant-numeric: tabular-nums;
  width: 40px
}

.cls-pill {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(0, 122, 255, 0.08);
  color: var(--blue)
}

.conf-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 140px
}

.conf-track {
  flex: 1;
  height: 4px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 2px;
  overflow: hidden
}

.conf-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease
}

.conf-fill.conf-high {
  background: var(--green)
}

.conf-fill.conf-mid {
  background: var(--orange)
}

.conf-fill.conf-low {
  background: var(--red)
}

.conf-val {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  min-width: 48px;
  text-align: right
}

.conf-val.conf-high {
  color: var(--green)
}

.conf-val.conf-mid {
  color: var(--orange)
}

.conf-val.conf-low {
  color: var(--red)
}

.td-coord {
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: var(--text-4)
}

.status-chip {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600
}

.chip-ok {
  background: rgba(52, 199, 89, 0.1);
  color: var(--green)
}

.chip-warn {
  background: rgba(255, 149, 0, 0.1);
  color: var(--orange)
}
</style>
