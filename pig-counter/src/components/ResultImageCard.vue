<template>
  <div class="img-card glass-card result-img-card"
    :class="{ 'result-img-card--ready': hasResult, floating: hasImage || (batchMode && selectedBatchImage) }">
    <div class="img-card-header">
      <div class="img-card-header-left">
        <span class="traffic-dot" :class="batchMode ? (batchProcessing ? 'dot-yellow' : 'dot-green') : (hasResult ? 'dot-green' : 'dot-gray')"></span>
        <span class="img-card-title">{{ batchMode ? (batchProcessing ? '批量扫描中…' : '批量结果') : '标注结果' }}</span>
        <template v-if="batchMode && selectedBatchImage">
          <span class="img-card-chip">{{ selectedBatchImage.unit_name }}</span>
          <span class="img-card-chip">{{ selectedBatchImage.pen_name }}</span>
          <span v-if="batchAnnotatedImages.length > 1" class="img-card-count">
            {{ batchImageIndex + 1 }}/{{ batchAnnotatedImages.length }}
          </span>
        </template>
        <template v-else-if="batchMode">
          <span class="img-card-chip chip-green" v-if="batchTotalPigs">共 {{ batchTotalPigs }} 头猪</span>
        </template>
        <template v-else>
          <transition name="meta-slide">
            <span class="img-card-chip chip-green" v-if="hasResult">检测到 {{ pigCount }} 头猪</span>
          </transition>
          <transition name="meta-slide">
            <span v-if="resultsCount > 1" class="img-card-count">
              {{ currentImageIndex + 1 }}/{{ resultsCount }}
            </span>
          </transition>
        </template>
      </div>
      <div class="img-card-header-right">
        <button v-if="hasResult || (batchMode && selectedBatchImage)" class="btn-header" @click="$emit('edit')" title="编辑标注">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
          编辑标注
        </button>
        <button v-if="hasResult || (batchMode && selectedBatchImage)" class="btn-header btn-header--primary" @click="$emit('export')" title="导出图片">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          导出图片
        </button>
      </div>
    </div>
    <div class="img-card-body">
      <div class="result-zone" :class="{ 'result-zone--active': hasResult || (batchMode && selectedBatchImage), 'result-zone--fill': batchMode }">
        <!-- 批量模式：扫描中 -->
        <div v-if="batchMode && batchProcessing"
          class="result-overlay result-overlay--batch-scanning">
          <div class="scan-line"></div>
          <div class="scan-corners">
            <span class="sc sc-tl"></span>
            <span class="sc sc-tr"></span>
            <span class="sc sc-bl"></span>
            <span class="sc sc-br"></span>
          </div>
          <div class="scan-label">
            <div class="scan-spinner"></div>
            AI 批量扫描中…
          </div>
        </div>
        <!-- 批量模式：检测完成后显示标注图 -->
        <div v-else-if="batchMode && selectedBatchImage"
          class="canvas-wrap" @click="$emit('open-preview')">
          <img :src="selectedBatchImage.url" :key="'batch-' + batchImageIndex + '-' + selectedBatchImage.pig_count" class="img-preview img-result-base" alt="batch result" ref="baseImg"
            @load="onResultImgLoad" />
          <canvas ref="boxCanvas" class="box-canvas"></canvas>
        </div>
        <!-- 批量模式：已加载但未开始识别 -->
        <div v-else-if="batchMode" class="canvas-wrap">
          <div class="result-overlay">
            <div class="overlay-content">
              <div class="overlay-icon">✦</div>
              <span>点击「开始识别」分析图片</span>
            </div>
          </div>
        </div>
        <!-- 单图模式：有图片时 -->
        <div v-else-if="hasImage" class="canvas-wrap" @click="$emit('open-preview')"
          :class="{ 'canvas-wrap--clickable': hasResult }">
          <img :src="annotatedImage || previewUrl" class="img-preview img-result-base" alt="result" ref="baseImg"
            @load="onResultImgLoad" />
          <canvas ref="boxCanvas" class="box-canvas"></canvas>
          <transition name="overlay-fade">
            <div class="result-overlay" v-if="!hasResult && !isAnalyzing">
              <div class="overlay-content">
                <div class="overlay-icon">✦</div>
                <span>点击「开始识别」分析图片</span>
              </div>
            </div>
          </transition>
          <transition name="overlay-fade">
            <div class="result-overlay result-overlay--scanning" v-if="isAnalyzing">
              <div class="scan-line"></div>
              <div class="scan-corners">
                <span class="sc sc-tl"></span>
                <span class="sc sc-tr"></span>
                <span class="sc sc-bl"></span>
                <span class="sc sc-br"></span>
              </div>
              <div class="scan-label">
                <div class="scan-spinner"></div>
                AI 扫描中…
              </div>
            </div>
          </transition>
        </div>
        <!-- 无内容占位 -->
        <div v-else class="dropzone-placeholder result-placeholder">
          <div class="dz-pig" style="opacity:.7;font-size:36px">✦</div>
          <p class="dz-title" style="opacity:.85;color:#000">识别结果将在此展示</p>
        </div>
      </div>
    </div>
    <!-- 导航：单图多张 或 批量多张 -->
    <div v-if="resultsCount > 1 || (batchMode && batchAnnotatedImages.length > 1)" class="img-navigation">
      <button class="nav-btn nav-btn-prev" @click="$emit('prev')" title="上一张">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <button class="nav-btn nav-btn-next" @click="$emit('next')" title="下一张">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ResultImageCard',
  props: {
    hasImage: { type: Boolean, default: false },
    hasResult: { type: Boolean, default: false },
    annotatedImage: { type: String, default: null },
    previewUrl: { type: String, default: '' },
    isAnalyzing: { type: Boolean, default: false },
    result: { type: Object, default: null },
    imageMeta: { type: Object, default: null },
    hoveredBox: { type: Number, default: null },
    inferenceTime: { type: [Number, String], default: null },
    confidencePct: { type: Number, default: 0 },
    confClass: { type: String, default: '' },
    pigCount: { type: Number, default: 0 },
    resultsCount: { type: Number, default: 0 },
    currentImageIndex: { type: Number, default: 0 },
    batchMode: { type: Boolean, default: false },
    batchProcessing: { type: Boolean, default: false },
    batchTotalPigs: { type: Number, default: 0 },
    batchTotalPhotos: { type: Number, default: 0 },
    batchUnitCount: { type: Number, default: 0 },
    batchAnnotatedImages: { type: Array, default: () => [] },
    selectedBatchImage: { type: Object, default: null },
    selectedBatchResult: { type: Object, default: null },
    batchImageIndex: { type: Number, default: 0 },
    batchFullLoading: { type: Boolean, default: false }
  },
  computed: {
    batchConfClass() {
      const c = this.selectedBatchImage ? this.selectedBatchImage.confidence : 0
      const p = Math.round(c * 100)
      if (p >= 85) return 'conf-high'
      if (p >= 65) return 'conf-mid'
      return 'conf-low'
    }
  },
  beforeUnmount() {
    if (this._drawRafId) cancelAnimationFrame(this._drawRafId)
    if (this._hoverRafId) cancelAnimationFrame(this._hoverRafId)
  },
  watch: {
    hasResult(val) { if (val && !this.batchFullLoading) this.$nextTick(() => this.drawBoxesAnimated()) },
    hoveredBox() { if (this.batchFullLoading) return; if (this.hasResult || (this.batchMode && this.selectedBatchImage)) { if (this._hoverRafId) cancelAnimationFrame(this._hoverRafId); this._hoverRafId = requestAnimationFrame(() => this.drawBoxesInstant()) } },
    selectedBatchImage(val, oldVal) {
      // 只在真正切换图片时清空 override
      if (!val || !oldVal || val.record_id !== oldVal.record_id || val.pen_name !== oldVal.pen_name) {
        this._overrideBoxes = null
      }
      if (val && !this.batchFullLoading) this.$nextTick(() => this.drawBoxesAnimated())
    },
    batchImageIndex() { this._overrideBoxes = null },
    annotatedImage() {},
    'result.boxes'(boxes) { if (!this.batchMode && boxes && this.hasResult) { this._overrideBoxes = null; this.$nextTick(() => this.drawBoxesAnimated()) } },
    selectedBatchResult() {},
    batchFullLoading(val, oldVal) {
      if (oldVal && !val) this.$nextTick(() => this.drawBoxesInstant())
    }
  },
  methods: {
    onResultImgLoad() { if (this.batchFullLoading) return; this.drawBoxesAnimated() },
    drawBoxesAnimated(overrideBoxes) {
      if (overrideBoxes) this._overrideBoxes = overrideBoxes
      if (this._drawRafId) cancelAnimationFrame(this._drawRafId)
      const { canvas, boxes, imgW, imgH } = this._resolveBoxesAndDims()
      if (!canvas || !boxes) return
      const ctx = canvas.getContext('2d')
      let prog = 0; const total = 30
      const draw = () => {
        prog++
        const t = Math.min(prog / total, 1)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        this._drawBoxesFrame(ctx, canvas, boxes, imgW, imgH, t)
        if (prog < total) this._drawRafId = requestAnimationFrame(draw)
      }
      this._drawRafId = requestAnimationFrame(draw)
    },
    drawBoxesInstant() {
      const { canvas, boxes, imgW, imgH } = this._resolveBoxesAndDims()
      if (!canvas || !boxes) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      this._drawBoxesFrame(ctx, canvas, boxes, imgW, imgH, 1)
    },
    _resolveBoxesAndDims() {
      const canvas = this.$refs.boxCanvas
      const img = this.$refs.baseImg
      if (!canvas || !img) return {}
      const containerW = img.clientWidth || canvas.parentElement?.clientWidth || 0
      const containerH = img.clientHeight || canvas.parentElement?.clientHeight || 0
      if (!containerW || !containerH) return {}
      let boxes, imgW, imgH
      if (this._overrideBoxes) {
        boxes = this._overrideBoxes
        imgW = this.selectedBatchImage ? this.selectedBatchImage.image_width : (this.imageMeta?.width || 0)
        imgH = this.selectedBatchImage ? this.selectedBatchImage.image_height : (this.imageMeta?.height || 0)
      } else if (this.batchMode && this.selectedBatchResult) {
        boxes = this.selectedBatchResult.boxes || []
        imgW = this.selectedBatchImage ? this.selectedBatchImage.image_width : 0
        imgH = this.selectedBatchImage ? this.selectedBatchImage.image_height : 0
      } else if (this.hasResult) {
        boxes = this.result && this.result.boxes ? this.result.boxes : []
        imgW = this.imageMeta ? this.imageMeta.width : 0
        imgH = this.imageMeta ? this.imageMeta.height : 0
      } else { return {} }
      canvas.width = containerW; canvas.height = containerH
      return { canvas, boxes, imgW, imgH }
    },
    _drawBoxesFrame(ctx, canvas, boxes, imgW, imgH, t) {
      boxes.forEach((box, i) => {
        const bd = boxes.length > 0 ? i / boxes.length * 0.4 : 0
        const lt = Math.max(0, Math.min(1, (t - bd) / 0.6))
        if (lt <= 0) return
        const c = this.resolveCoords(box, canvas, imgW, imgH)
        const w = c.x2 - c.x1; const h = c.y2 - c.y1
        const isH = this.hoveredBox === i
        const col = isH ? 'rgba(255,149,0,' + lt + ')' : 'rgba(52,199,89,' + lt + ')'
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = isH ? 2.5 : 1.8
        ctx.shadowColor = col; ctx.shadowBlur = isH ? 10 : 5; ctx.globalAlpha = lt
        ctx.strokeRect(c.x1, c.y1, w, h); ctx.restore()
        if (lt > 0.6) {
          const la = (lt - 0.6) / 0.4
          ctx.save(); ctx.globalAlpha = la
          const label = (i + 1) + '  ' + (box.score * 100).toFixed(0) + '%'
          ctx.font = 'bold 11px -apple-system,monospace'
          const tw = ctx.measureText(label).width
          const labelY = Math.max(2, c.y1 - 22)
          ctx.fillStyle = isH ? 'rgba(255,149,0,0.88)' : 'rgba(52,199,89,0.88)'
          ctx.beginPath(); ctx.roundRect(c.x1, labelY, tw + 12, 20, 4); ctx.fill()
          ctx.fillStyle = '#fff'; ctx.fillText(label, c.x1 + 6, labelY + 14); ctx.restore()
        }
      })
    },
    clearCanvas() { const c = this.$refs.boxCanvas; if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height) },
    resolveCoords(box, canvas, metaW, metaH) {
      const isN = box.x1 <= 1 && box.y1 <= 1
      const sw = canvas.width; const sh = canvas.height
      const mw = metaW || 1; const mh = metaH || 1

      // 计算 object-fit: contain 下图片实际渲染区域
      const scale = Math.min(sw / mw, sh / mh)
      const renderW = mw * scale; const renderH = mh * scale
      const offsetX = (sw - renderW) / 2; const offsetY = (sh - renderH) / 2

      if (isN) {
        return {
          x1: offsetX + box.x1 * renderW, y1: offsetY + box.y1 * renderH,
          x2: offsetX + (box.x1 + box.x2) * renderW, y2: offsetY + (box.y1 + box.y2) * renderH
        }
      }
      return {
        x1: offsetX + box.x1 / mw * renderW, y1: offsetY + box.y1 / mh * renderH,
        x2: offsetX + box.x2 / mw * renderW, y2: offsetY + box.y2 / mh * renderH
      }
    }
  }
}
</script>

<style scoped>
.img-card {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  animation: sectionIn 0.3s var(--ease-out) 0.4s both;
  transition: transform 0.3s ease, box-shadow 0.3s ease
}

.result-img-card {
  animation: sectionIn 0.3s var(--ease-out) 0.5s both
}

.img-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--sep);
  min-height: 53px
}

.img-card-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap
}

.img-card-header-right {
  display: flex;
  align-items: center;
  gap: 10px
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
  color: white;
  border: none;
}
.btn-header--primary:hover {
  background: #0068d6;
  color: white;
}

.traffic-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0 }
.dot-green { background: var(--green); box-shadow: 0 0 6px rgba(52, 199, 89, 0.45) }
.dot-gray { background: var(--sep-opaque) }
.dot-yellow { background: var(--orange); box-shadow: 0 0 6px rgba(255, 149, 0, 0.45) }

.img-card-title { font-size: 12px; font-weight: 600; color: var(--text-2) }

.img-card-chip {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid var(--sep);
  border-radius: 6px;
  padding: 3px 8px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap
}

.chip-green {
  background: rgba(52, 199, 89, 0.1);
  border-color: rgba(52, 199, 89, 0.25);
  color: var(--green)
}

.img-card-count {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid var(--sep);
  border-radius: 6px;
  padding: 3px 8px
}

.img-card-body {
  padding: 14px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column
}

.img-navigation {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 10
}

.nav-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--sep);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1)
}

.nav-btn:hover {
  background: white;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)
}

.nav-btn svg { width: 16px; height: 16px; color: var(--text-2) }

.result-zone {
  width: 100%;
  flex: 1;
  min-height: 0;
  border-radius: var(--r-md);
  position: relative;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.02);
  border: 1.5px solid var(--sep);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.4s ease
}

.result-zone--active { border-color: rgba(52, 199, 89, 0.3) }
.result-zone--fill { flex: 1; min-height: 0; height: auto }

.canvas-wrap { width: 100%; height: 100%; position: relative; overflow: hidden; border-radius: var(--r-md) }
.canvas-wrap .img-preview { width: 100%; height: 100%; object-fit: contain }
.box-canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none }

.result-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(6px);
  border-radius: var(--r-md)
}

.result-overlay--scanning {
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(2px);
  border-radius: var(--r-md)
}

.result-overlay--batch-scanning {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(2px);
  border-radius: var(--r-md)
}

.overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-3);
  font-weight: 500
}

.overlay-icon {
  font-size: 28px;
  opacity: 0.25;
  animation: iconBreath 3s ease-in-out infinite
}

@keyframes iconBreath {
  0%, 100% { opacity: 0.15; transform: scale(0.95) }
  50% { opacity: 0.35; transform: scale(1.05) }
}

.result-placeholder { opacity: 0.35 }

.scan-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--green), transparent);
  box-shadow: 0 0 12px var(--green);
  animation: scanLine 1.8s ease-in-out infinite
}

@keyframes scanLine { 0% { top: 0% } 100% { top: 100% } }

.scan-corners { position: absolute; inset: 12px }
.sc { position: absolute; width: 16px; height: 16px; border-color: var(--green); border-style: solid }
.sc-tl { top: 0; left: 0; border-width: 2px 0 0 2px; border-radius: 3px 0 0 0 }
.sc-tr { top: 0; right: 0; border-width: 2px 2px 0 0; border-radius: 0 3px 0 0 }
.sc-bl { bottom: 0; left: 0; border-width: 0 0 2px 2px; border-radius: 0 0 0 3px }
.sc-br { bottom: 0; right: 0; border-width: 0 2px 2px 0; border-radius: 0 0 3px 0 }

.scan-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--green);
  font-weight: 600;
  letter-spacing: 0.05em;
  text-shadow: 0 0 8px rgba(52, 199, 89, 0.5)
}

.scan-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(52, 199, 89, 0.3);
  border-top-color: var(--green);
  border-radius: 50%;
  animation: spin 0.7s linear infinite
}

@keyframes spin { to { transform: rotate(360deg) } }

.canvas-wrap--clickable { cursor: pointer }
.canvas-wrap--clickable:hover { box-shadow: 0 0 0 3px rgba(30, 190, 110, 0.3); border-radius: 8px }

.img-meta-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 2px 0;
  font-size: 11px;
  color: var(--text-4)
}

.meta-sep { color: var(--sep-opaque) }

.dropzone-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px;
  text-align: center;
  position: relative
}


.dz-pig { font-size: 44px; animation: pigFloat 4s ease-in-out infinite }
@keyframes pigFloat {
  0%, 100% { transform: translateY(0) rotate(-3deg) }
  50% { transform: translateY(-8px) rotate(3deg) }
}

.dz-title { font-size: 14px; font-weight: 600; color: var(--text-2) }

.result-img-card--ready {
  border-color: rgba(52, 199, 89, 0.3)
}

.floating {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06)
}

@keyframes sectionIn {
  from { opacity: 0 }
  to { opacity: 1 }
}
</style>
