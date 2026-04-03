<template>
  <div class="analyze-wrap">
    <!-- Progress bar -->
    <div class="progress-bar" v-if="isAnalyzing">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
    </div>

    <button
      class="btn-analyze"
      :disabled="!hasImage || isAnalyzing"
      @click="$emit('analyze')"
    >
      <span class="btn-icon" v-if="!isAnalyzing">🔍</span>
      <span class="btn-spinner" v-else></span>
      <span>{{ isAnalyzing ? analyzeLabel : '开始识别' }}</span>
    </button>
  </div>
</template>

<script>
export default {
  name: 'AnalyzeButton',
  props: {
    progress: { type: Number, default: 0 }
  },
  data() {
    return { labelIndex: 0 }
  },
  computed: {
    hasImage()    { return this.$store.getters.hasImage },
    isAnalyzing() { return this.$store.state.isAnalyzing },
    analyzeLabel() {
      const labels = ['上传中...', '模型推理中...', '统计数量...']
      const p = this.progress
      if (p < 100) return labels[0]
      return labels[1]
    }
  }
}
</script>

<style scoped>
.analyze-wrap {
  width: 100%;
  position: relative;
}

.progress-bar {
  height: 3px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--pig-pink), var(--accent));
  border-radius: 2px;
  transition: width 0.3s ease;
}

.btn-analyze {
  width: 100%;
  padding: 15px 0;
  background: linear-gradient(135deg, #f4a24a 0%, #e8c84a 100%);
  color: #000;
  border: none;
  border-radius: 10px;
  font-family: 'Space Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  position: relative;
  overflow: hidden;
}

.btn-analyze::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.2), transparent);
  opacity: 0;
  transition: opacity 0.2s;
}

.btn-analyze:hover:not(:disabled)::after { opacity: 1; }
.btn-analyze:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(244, 162, 74, 0.35);
}
.btn-analyze:active:not(:disabled) { transform: translateY(0); }

.btn-analyze:disabled {
  background: var(--surface);
  color: var(--text-muted);
  border: 1.5px solid var(--border);
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.btn-icon { font-size: 16px; }

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0,0,0,0.2);
  border-top-color: #000;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
