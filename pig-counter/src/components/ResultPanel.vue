<template>
  <div class="result-panel" :class="{ 'has-result': hasResult }">
    <!-- Header -->
    <div class="panel-header">
      <span class="header-dot" :class="{ active: hasResult }"></span>
      <span class="header-title">识别结果</span>
      <span v-if="inferenceTime" class="header-badge">{{ inferenceTime }}ms</span>
    </div>

    <!-- Count display -->
    <div class="count-section">
      <div class="count-label">检测到的猪只数量</div>

      <div class="count-display">
        <transition name="count-pop" mode="out-in">
          <div v-if="hasResult" key="number" class="count-number">
            {{ animatedCount }}
          </div>
          <div v-else key="dash" class="count-dash">—</div>
        </transition>
      </div>

      <div v-if="hasResult" class="count-unit">头猪 🐷</div>
    </div>

    <!-- Confidence bar -->
    <div v-if="hasResult" class="confidence-section">
      <div class="conf-row">
        <span class="conf-label">模型置信度</span>
        <span
          class="conf-value"
          :class="confidenceLevel"
        >{{ confidencePct }}%</span>
      </div>
      <div class="conf-bar-bg">
        <div
          class="conf-bar-fill"
          :class="confidenceLevel"
          :style="{ width: confidencePct + '%' }"
        ></div>
      </div>
      <div class="conf-hint" :class="confidenceLevel">{{ confidenceHint }}</div>
    </div>

    <!-- Pig emoji visualization -->
    <div class="pig-viz" v-if="hasResult">
      <div class="pig-viz-header">
        <span>猪群预览</span>
        <span class="pig-viz-note" v-if="pigCount > 20">仅展示前 20 头</span>
      </div>
      <div class="pig-grid">
        <span
          v-for="i in displayCount"
          :key="i"
          class="pig-emoji"
          :style="{ animationDelay: ((i - 1) * 35) + 'ms' }"
        >🐷</span>
        <span v-if="pigCount > 20" class="pig-more">+{{ pigCount - 20 }}</span>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <div class="empty-icon">🔍</div>
      <p>上传图片后点击「开始识别」</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ResultPanel',
  data() {
    return {
      animatedCount: 0
    }
  },
  computed: {
    hasResult()     { return this.$store.getters.hasResult },
    pigCount()      { return this.$store.getters.pigCount },
    confidencePct() { return this.$store.getters.confidencePct },
    inferenceTime() { return this.$store.getters.inferenceTime },
    displayCount()  { return Math.min(this.pigCount || 0, 20) },

    confidenceLevel() {
      const p = this.confidencePct
      if (p >= 85) return 'high'
      if (p >= 65) return 'mid'
      return 'low'
    },
    confidenceHint() {
      const level = this.confidenceLevel
      if (level === 'high') return '✓ 识别结果可信'
      if (level === 'mid')  return '△ 结果较为可信，建议核实'
      return '✗ 置信度偏低，建议重新拍摄'
    }
  },
  watch: {
    pigCount(newVal) {
      if (newVal === null) { this.animatedCount = 0; return }
      this.animateNumber(newVal)
    }
  },
  methods: {
    animateNumber(target) {
      const duration = 600
      const start    = Date.now()
      const from     = 0
      const tick = () => {
        const elapsed  = Date.now() - start
        const progress = Math.min(elapsed / duration, 1)
        // ease out cubic
        const eased    = 1 - Math.pow(1 - progress, 3)
        this.animatedCount = Math.round(from + (target - from) * eased)
        if (progress < 1) requestAnimationFrame(tick)
        else this.animatedCount = target
      }
      requestAnimationFrame(tick)
    }
  }
}
</script>

<style scoped>
.result-panel {
  background: var(--card);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  transition: border-color 0.35s;
}

.result-panel.has-result {
  border-color: var(--pig-pink-dim);
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 22px;
  border-bottom: 1px solid var(--border);
}

.header-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
  transition: background 0.3s;
  flex-shrink: 0;
}

.header-dot.active { background: var(--pig-pink); box-shadow: 0 0 6px var(--pig-pink); }

.header-title {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  font-weight: 700;
  flex: 1;
}

.header-badge {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 7px;
  letter-spacing: 0.04em;
}

/* Count */
.count-section {
  padding: 28px 22px 20px;
  text-align: center;
}

.count-label {
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.count-display { min-height: 90px; display: flex; align-items: center; justify-content: center; }

.count-number {
  font-family: 'Noto Serif SC', serif;
  font-size: 84px;
  font-weight: 900;
  line-height: 1;
  background: linear-gradient(135deg, var(--pig-pink), var(--accent2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.count-dash {
  font-family: 'Noto Serif SC', serif;
  font-size: 60px;
  font-weight: 900;
  color: var(--border);
  line-height: 1;
}

.count-unit {
  font-size: 14px;
  color: var(--text-muted);
  letter-spacing: 0.06em;
  margin-top: 4px;
}

/* Transition */
.count-pop-enter-active { transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.count-pop-leave-active { transition: all 0.2s ease; }
.count-pop-enter        { opacity: 0; transform: scale(0.5); }
.count-pop-leave-to     { opacity: 0; transform: scale(0.8); }

/* Confidence */
.confidence-section {
  padding: 0 22px 20px;
  border-top: 1px solid var(--border);
  margin-top: 4px;
  padding-top: 16px;
}

.conf-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.conf-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.conf-value {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.conf-value.high { color: var(--success); }
.conf-value.mid  { color: var(--accent); }
.conf-value.low  { color: #e87070; }

.conf-bar-bg {
  height: 5px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.conf-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}
.conf-bar-fill.high { background: linear-gradient(90deg, #6dcc80, #4ab86a); }
.conf-bar-fill.mid  { background: linear-gradient(90deg, var(--accent2), var(--accent)); }
.conf-bar-fill.low  { background: linear-gradient(90deg, #e87070, #c45050); }

.conf-hint {
  font-size: 10px;
  margin-top: 6px;
  letter-spacing: 0.04em;
}
.conf-hint.high { color: var(--success); }
.conf-hint.mid  { color: var(--accent); }
.conf-hint.low  { color: #e87070; }

/* Pig viz */
.pig-viz {
  border-top: 1px solid var(--border);
  padding: 14px 22px 18px;
}

.pig-viz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.pig-viz-note {
  color: var(--border);
  font-size: 9px;
}

.pig-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.pig-emoji {
  font-size: 20px;
  animation: pigPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes pigPop {
  from { transform: scale(0) rotate(-20deg); opacity: 0; }
  to   { transform: scale(1) rotate(0deg);   opacity: 1; }
}

.pig-more {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 8px;
  font-family: 'Space Mono', monospace;
}

/* Empty state */
.empty-state {
  padding: 32px 22px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.8;
}

.empty-icon {
  font-size: 28px;
  margin-bottom: 10px;
  opacity: 0.4;
}
</style>
