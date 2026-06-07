<template>
  <div>
    <TopBar
      :scrolled="scrolled"
      :isAnalyzing="isAnalyzing"
      :uploadProgress="uploadProgress"
      :hasResult="hasResult || !!batchResults"
      :hasImage="hasImage"
      :batchTree="batchTree"
      :selectedFarmId="selectedFarmId"
      :serviceOnline="$store.state.serviceOnline"
      :farmName="currentFarmName"
      :farms="farms"
      :showFarmDropdown="showFarmDropdown"
      :routePath="$route.path"
      @service-online="onServiceOnline"
      @toggle-farm-dropdown="toggleFarmDropdown"
      @select-farm="selectFarmWrapper"
      @manage-farm="showFarmModal = true"
      @file-change="onTopFileChange"
      @batch-folder-change="onBatchFolderChange"
      @analyze="handleAnalyzeWrapper"
      @clear-image="clearImage"
      @need-farm="triggerWarningFlash"
      @close-dropdown="showFarmDropdown = false"
    />
    <CapsuleNav
      :scrolled="scrolled"
      :isAnalyzing="isAnalyzing"
      :hasResult="hasResult || !!batchResults"
      :hasImage="hasImage"
      :batchTree="batchTree"
      :selectedFarmId="selectedFarmId"
      :serviceOnline="$store.state.serviceOnline"
      :farmName="currentFarmName"
      :farms="farms"
      :showFarmDropdown="showFarmDropdown"
      :routePath="$route.path"
      @service-online="onServiceOnline"
      @toggle-farm-dropdown="toggleFarmDropdown"
      @select-farm="selectFarmWrapper"
      @manage-farm="showFarmModal = true"
      @analyze="handleAnalyzeWrapper"
      @clear-image="clearImage"
      @need-farm="triggerWarningFlash"
      @close-dropdown="showFarmDropdown = false"
    />
  <div class="page-wrap">
    <div class="top-info-row">
      <div class="current-farm-section">
        <FarmInfoCard :selectedFarmId="selectedFarmId" :farmName="currentFarmName" :hasImage="hasImage || !!batchTree" :flash="warningFlash" />
      </div>
      <div class="system-stats-section">
        <SystemStatsCard :stats="systemStats" />
      </div>
    </div>

    <StatCardsRow :cards="statCards" :animatedCount="animatedCount" />

    <div class="image-row">
      <BatchFolderUploader v-if="batchTree && (!batchResults || showFolderTree)"
        :batchTree="batchTree" :processing="batchProcessing" :hasResults="!!batchResults"
        @analyze="runBatchAnalysis" @clear="clearBatch"
        @show-results="showFolderTree = false" @re-upload="triggerBatchReUpload" @download-excel="downloadBatchExcel" />
      <BatchResultsTable v-else-if="batchResults && !showFolderTree"
        :batchResults="batchResults" @download="downloadBatchExcel" @clear="clearBatch"
        @back="backToFolderTree" @edit="openEditModal" @export="exportAnnotatedImage" />
      <OriginalImageCard v-else
        :hasImage="hasImage" :previewUrl="previewUrl" :imageMeta="imageMeta"
        :imageCount="$store.state.imageFiles.length" :currentImageIndex="$store.state.currentImageIndex"
        :farmSelected="!!selectedFarmId" @files-selected="onTopFileChange"
        @batch-folder-selected="onBatchFolderChange" @need-farm="triggerWarningFlash"
        @prev="prevImage" @next="nextImage" />
      <ResultImageCard ref="resultCard"
        :hasImage="hasImage" :hasResult="hasResult" :annotatedImage="annotatedImage"
        :previewUrl="previewUrl" :isAnalyzing="isAnalyzing" :result="result" :imageMeta="imageMeta"
        :hoveredBox="hoveredBox" :inferenceTime="inferenceTime" :confidencePct="confidencePct"
        :confClass="confClass" :pigCount="pigCount" :resultsCount="$store.state.results.length"
        :currentImageIndex="$store.state.currentImageIndex" :batchMode="!!batchTree"
        :batchProcessing="batchProcessing" :batchTotalPigs="batchResults?.total_pigs"
        :batchTotalPhotos="batchResults?.total_photos" :batchUnitCount="batchResults?.units?.length"
        :batchAnnotatedImages="batchAnnotatedImages" :selectedBatchImage="selectedBatchImage"
        :selectedBatchResult="selectedBatchResult" :batchImageIndex="batchImageIndex"
        @open-preview="$emit('open-preview')" @prev="batchTree ? prevBatchImage() : prevImage()"
        @next="batchTree ? nextBatchImage() : nextImage()" @edit="openEditModal" @export="exportAnnotatedImage" />
    </div>

    <DetectionDetailTable v-if="!batchResults || !selectedBatchImage"
      :boxes="activeResult?.boxes || []" :pigCount="activeResult?.count ?? pigCount"
      :confidencePct="confidencePct" :confClass="confClass" :hoveredBox="hoveredBox"
      :imageMeta="imageMeta" :inferenceTime="inferenceTime" @hover="onDetailHover" />
    <DetectionDetailTable v-if="batchResults && selectedBatchImage"
      :boxes="selectedBatchImage.boxes || []" :pigCount="selectedBatchImage.pig_count"
      :confidencePct="Math.round(selectedBatchImage.confidence * 100)"
      :confClass="selectedBatchImage.confidence >= 0.85 ? 'conf-high' : selectedBatchImage.confidence >= 0.65 ? 'conf-mid' : 'conf-low'"
      :hoveredBox="hoveredBox"
      :imageMeta="{ width: selectedBatchImage.image_width, height: selectedBatchImage.image_height }"
      :inferenceTime="selectedBatchImage.processing_time_ms" @hover="onDetailHover" />

    <LogPanel />

    <!-- 编辑标注弹窗（v1.0 原始逻辑，直接内联） -->
    <div v-if="showEditModal" class="edit-modal" @click="closeEditModal">
      <div class="edit-backdrop"></div>
      <div class="edit-container" @click.stop>
        <div class="edit-header">
          <div class="edit-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
            <span>编辑识别框</span>
          </div>
          <div class="edit-tabs">
            <button class="edit-tab" :class="{ 'edit-tab--active': editMode === 'add' }" @click="editMode = 'add'; editSelectedIndex = null; drawEditCanvas()">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              新增
            </button>
            <button class="edit-tab" :class="{ 'edit-tab--active': editMode === 'delete' }" @click="editMode = 'delete'; editSelectedIndex = null; drawEditCanvas()">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
              删除
            </button>
          </div>
          <div class="edit-actions">
            <button class="edit-btn edit-btn--primary" @click="saveBoxesToDb" :disabled="!editRecordId">保存</button>
            <button class="edit-close-btn" @click="closeEditModal" title="关闭">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="edit-body">
          <div class="edit-info">
            <span class="edit-pill">当前 {{ editBoxes.length }} 个识别框</span>
            <span class="edit-pill edit-pill--mode" v-if="editMode === 'add'">新增模式：拖拽绘制新框</span>
            <span class="edit-pill edit-pill--delete" v-else>删除模式：点选后删除</span>
            <span class="edit-pill" v-if="editSelectedIndex !== null">已选中 #{{ editSelectedIndex + 1 }}</span>
          </div>
          <div class="edit-canvas-area">
            <img v-if="editImageUrl" ref="editImg" :src="editImageUrl" :key="editImgKey" class="edit-img"
              @load="onEditImgLoad" alt="标注图" />
            <canvas ref="editCanvas" class="edit-canvas"
              :style="{ cursor: editMode === 'add' ? 'crosshair' : 'default' }"
              @mousedown="onEditCanvasMouseDown" @mousemove="onEditCanvasMouseMove"
              @mouseup="onEditCanvasMouseUp" @click="onEditCanvasClick"></canvas>
          </div>
        </div>
      </div>
    </div>
  </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick, inject, onMounted, onBeforeUnmount } from 'vue'
import { useStore } from 'vuex'
import { useRoute, useRouter } from 'vue-router'
import TopBar from '@/components/TopBar.vue'
import CapsuleNav from '@/components/CapsuleNav.vue'
import LogPanel from '@/components/LogPanel.vue'
import FarmInfoCard from '@/components/FarmInfoCard.vue'
import SystemStatsCard from '@/components/SystemStatsCard.vue'
import StatCardsRow from '@/components/StatCardsRow.vue'
import DetectionDetailTable from '@/components/DetectionDetailTable.vue'
import BatchFolderUploader from '@/components/BatchFolderUploader.vue'
import BatchResultsTable from '@/components/BatchResultsTable.vue'
import OriginalImageCard from '@/components/OriginalImageCard.vue'
import ResultImageCard from '@/components/ResultImageCard.vue'

export default {
  name: 'HomePage',
  components: { TopBar, CapsuleNav, LogPanel, FarmInfoCard, SystemStatsCard, StatCardsRow, DetectionDetailTable, BatchFolderUploader, BatchResultsTable, OriginalImageCard, ResultImageCard },
  emits: ['open-preview'],

  setup(props, { emit }) {
    const store = useStore()
    const route = useRoute()
    const router = useRouter()
    const resultCard = ref(null)
    const editImg = ref(null)
    const editCanvas = ref(null)
    const scrolled = ref(false)
    const hoveredBox = ref(null)
    const animatedCount = ref(0)

    // Inject shared state from App.vue
    const farmState = inject('farmState')

    const selectedFarmId = farmState.selectedFarmId
    const farms = farmState.farms
    const currentFarmName = farmState.currentFarmName
    const warningFlash = farmState.warningFlash
    const batchTree = farmState.batchTree
    const batchResults = farmState.batchResults
    const batchProcessing = farmState.batchProcessing
    const batchImageIndex = farmState.batchImageIndex
    const showFolderTree = farmState.showFolderTree
    const batchAnnotatedImages = farmState.batchAnnotatedImages
    const selectedBatchImage = farmState.selectedBatchImage
    const selectedBatchResult = farmState.selectedBatchResult
    const systemStats = farmState.systemStats

    // Store computed
    const hasImage = computed(() => store.getters.hasImage)
    const hasResult = computed(() => store.getters.hasResult)
    const previewUrl = computed(() => store.state.previewUrl)
    const imageMeta = computed(() => store.state.imageMeta)
    const isAnalyzing = computed(() => store.state.isAnalyzing)
    const uploadProgress = computed(() => store.state.uploadProgress)
    const result = computed(() => store.state.result)
    const pigCount = computed(() => store.getters.pigCount)
    const confidencePct = computed(() => store.getters.confidencePct)
    const inferenceTime = computed(() => store.getters.inferenceTime)
    const annotatedImage = computed(() => store.state.result?.annotatedImage || null)

    const confClass = computed(() => {
      const p = confidencePct.value
      if (p >= 85) return 'conf-high'
      if (p >= 65) return 'conf-mid'
      return 'conf-low'
    })

    const activeResult = computed(() => {
      if (batchResults.value && selectedBatchImage.value) {
        return { boxes: selectedBatchImage.value.boxes || [], recordId: selectedBatchImage.value.record_id || null, imageUrl: selectedBatchImage.value.url, count: selectedBatchImage.value.pig_count }
      }
      if (result.value) {
        return { boxes: result.value.boxes || [], recordId: result.value.recordId || null, imageUrl: annotatedImage.value || previewUrl.value, count: result.value.count }
      }
      return null
    })

    const statCards = computed(() => {
      if (batchTree.value) {
        const img = selectedBatchImage.value
        const hasBatchResult = !!batchResults.value
        return [
          { icon: 'PiggyBank', label: '预测识别数', value: hasBatchResult && img ? (img.original_pig_count || img.pig_count) : null, unit: hasBatchResult ? '头' : null, cls: '', active: hasBatchResult },
          { icon: 'Zap', label: '处理耗时', value: hasBatchResult && img ? img.processing_time_ms : null, unit: hasBatchResult ? 'ms' : null, cls: '', active: hasBatchResult },
          { icon: 'Target', label: '平均置信度', value: hasBatchResult && img ? Math.round(img.confidence * 100) + '%' : null, unit: null, cls: '', active: hasBatchResult },
          { icon: 'Sparkles', label: '实际识别数', value: hasBatchResult && img ? img.pig_count : null, unit: hasBatchResult ? '头' : null, cls: 'stat-blue', active: hasBatchResult }
        ]
      }
      return [
        { icon: 'PiggyBank', label: '预测识别数', value: hasResult.value ? (window.__modelOriginalCount || pigCount.value) : null, unit: hasResult.value ? '头' : null, cls: '', active: hasResult.value },
        { icon: 'Zap', label: '处理耗时', value: inferenceTime.value, unit: inferenceTime.value ? 'ms' : null, cls: '', active: !!inferenceTime.value },
        { icon: 'Target', label: '平均置信度', value: hasResult.value ? confidencePct.value + '%' : null, unit: null, cls: '', active: hasResult.value },
        { icon: 'Sparkles', label: '实际识别数', value: hasResult.value ? pigCount.value : null, unit: hasResult.value ? '头' : null, cls: 'stat-blue', active: hasResult.value }
      ]
    })

    // ── 编辑标注（v1.0 原始逻辑，直接内联） ──
    const showEditModal = ref(false)
    const editImageUrl = ref(null)
    const editImgKey = ref(0)
    const editRecordId = ref(null)
    const editBoxes = ref([])
    const editSelectedIndex = ref(null)
    const editIsDrawing = ref(false)
    const editDrawStart = ref(null)
    const editDrawEnd = ref(null)
    const editHint = ref('select')
    const editMode = ref('add')

    function openEditModal() {
      let boxes, recordId, imageUrl
      if (batchResults.value && selectedBatchImage.value) {
        boxes = selectedBatchImage.value.boxes || []
        recordId = selectedBatchImage.value.record_id || null
        const matchFile = farmState.batchFiles?.value?.find(f => f.name === selectedBatchImage.value.pen_name)
        imageUrl = matchFile ? URL.createObjectURL(matchFile) : selectedBatchImage.value.url
      } else if (result.value) {
        boxes = result.value.boxes || []
        recordId = result.value.recordId || null
        imageUrl = previewUrl.value
      } else { return }
      if (!boxes.length) return
      editBoxes.value = JSON.parse(JSON.stringify(boxes))
      editRecordId.value = recordId
      editImageUrl.value = imageUrl
      editImgKey.value++
      editSelectedIndex.value = null
      editIsDrawing.value = false
      editDrawStart.value = null
      editDrawEnd.value = null
      editHint.value = 'select'
      showEditModal.value = true
      store.commit('ADD_LOG', { msg: '已进入编辑模式', type: 'info' })
    }

    function closeEditModal() {
      if (editImageUrl.value?.startsWith('blob:')) URL.revokeObjectURL(editImageUrl.value)
      showEditModal.value = false
      editBoxes.value = []
      editSelectedIndex.value = null
      editImageUrl.value = null
      editHint.value = 'select'
      store.commit('ADD_LOG', { msg: '已退出编辑模式', type: 'info' })
    }

    function onEditImgLoad() {
      nextTick(() => {
        const canvas = editCanvas.value
        const img = editImg.value
        if (!canvas || !img || !img.naturalWidth) return
        const containerW = img.clientWidth, containerH = img.clientHeight
        const natW = img.naturalWidth, natH = img.naturalHeight
        const scale = Math.min(containerW / natW, containerH / natH)
        const renderW = Math.round(natW * scale), renderH = Math.round(natH * scale)
        canvas.width = renderW; canvas.height = renderH
        canvas.style.width = renderW + 'px'; canvas.style.height = renderH + 'px'
        canvas.style.left = Math.round((containerW - renderW) / 2) + 'px'
        canvas.style.top = Math.round((containerH - renderH) / 2) + 'px'
        img.style.setProperty('width', renderW + 'px', 'important')
        img.style.setProperty('height', renderH + 'px', 'important')
        img.style.setProperty('left', Math.round((containerW - renderW) / 2) + 'px', 'important')
        img.style.setProperty('top', Math.round((containerH - renderH) / 2) + 'px', 'important')
        img.style.setProperty('object-fit', 'fill', 'important')
        drawEditCanvas()
      })
    }

    function drawEditCanvas() {
      const canvas = editCanvas.value
      const img = editImg.value
      if (!canvas || !img || !img.naturalWidth) return
      const rect = canvas.getBoundingClientRect()
      if (Math.abs(rect.width - canvas.width) > 1 || Math.abs(rect.height - canvas.height) > 1) {
        canvas.width = Math.round(rect.width)
        canvas.height = Math.round(rect.height)
      }
      const imgW = imageMeta.value?.width || selectedBatchImage.value?.image_width || img.naturalWidth
      const imgH = imageMeta.value?.height || selectedBatchImage.value?.image_height || img.naturalHeight
      if (!imgW || !imgH) return
      const scaleX = canvas.width / imgW
      const scaleY = canvas.height / imgH
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      editBoxes.value.forEach((box, i) => {
        const x1 = box.x1 * scaleX, y1 = box.y1 * scaleY
        const x2 = box.x2 * scaleX, y2 = box.y2 * scaleY
        const isSelected = i === editSelectedIndex.value
        const color = isSelected ? 'rgba(255, 149, 0, 0.8)' : 'rgba(52, 199, 89, 0.7)'
        ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = isSelected ? 2.5 : 1.8
        ctx.shadowColor = color; ctx.shadowBlur = isSelected ? 10 : 5
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1); ctx.restore()
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2
        ctx.save(); ctx.font = '22px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillText(String(i + 1), cx, cy); ctx.restore()
      })
    }

    function getEditCanvasCoords(e) {
      const canvas = editCanvas.value, img = editImg.value
      if (!canvas || !img || !canvas.width) return null
      const rect = canvas.getBoundingClientRect()
      const canvasX = (e.clientX - rect.left) / rect.width * canvas.width
      const canvasY = (e.clientY - rect.top) / rect.height * canvas.height
      const imgW = imageMeta.value?.width || selectedBatchImage.value?.image_width || img.naturalWidth
      const imgH = imageMeta.value?.height || selectedBatchImage.value?.image_height || img.naturalHeight
      return { cx: canvasX, cy: canvasY, imgX: canvasX / canvas.width * imgW, imgY: canvasY / canvas.height * imgH, scaleX: canvas.width / imgW, scaleY: canvas.height / imgH }
    }

    function onEditCanvasMouseDown(e) {
      if (editMode.value !== 'add') return
      const c = getEditCanvasCoords(e); if (!c) return
      editIsDrawing.value = true; editDrawStart.value = { x: c.imgX, y: c.imgY }; editDrawEnd.value = { x: c.imgX, y: c.imgY }
    }
    function onEditCanvasMouseMove(e) {
      if (!editIsDrawing.value) return
      const c = getEditCanvasCoords(e); if (!c) return
      editDrawEnd.value = { x: c.imgX, y: c.imgY }; drawEditCanvas()
      const canvas = editCanvas.value; if (!canvas) return
      const ctx = canvas.getContext('2d')
      const sx = editDrawStart.value.x * c.scaleX, sy = editDrawStart.value.y * c.scaleY
      const ex = editDrawEnd.value.x * c.scaleX, ey = editDrawEnd.value.y * c.scaleY
      ctx.strokeStyle = 'rgba(0, 122, 255, 0.7)'; ctx.lineWidth = 2; ctx.setLineDash([6, 3])
      ctx.strokeRect(Math.min(sx, ex), Math.min(sy, ey), Math.abs(ex - sx), Math.abs(ey - sy)); ctx.setLineDash([])
    }
    function onEditCanvasMouseUp(e) {
      if (!editIsDrawing.value) return; editIsDrawing.value = false
      const s = editDrawStart.value, en = editDrawEnd.value; if (!s || !en) return
      const x1 = Math.min(s.x, en.x), y1 = Math.min(s.y, en.y), x2 = Math.max(s.x, en.x), y2 = Math.max(s.y, en.y)
      if (Math.abs(x2 - x1) < 10 || Math.abs(y2 - y1) < 10) return
      editBoxes.value.push({ x1, y1, x2, y2, score: 1.0, class_name: 'pig' })
      editSelectedIndex.value = editBoxes.value.length - 1
      drawEditCanvas()
      store.commit('ADD_LOG', { msg: `已添加新识别框 #${editBoxes.value.length}`, type: 'info' })
    }
    function onEditCanvasClick(e) {
      if (editMode.value !== 'delete') return
      const c = getEditCanvasCoords(e); if (!c) return
      const { cx, cy, scaleX, scaleY } = c
      let clicked = null
      for (let i = editBoxes.value.length - 1; i >= 0; i--) {
        const box = editBoxes.value[i]
        if (cx >= box.x1 * scaleX && cx <= box.x2 * scaleX && cy >= box.y1 * scaleY && cy <= box.y2 * scaleY) { clicked = i; break }
      }
      if (clicked !== null) {
        editBoxes.value.splice(clicked, 1); editSelectedIndex.value = null; drawEditCanvas()
        store.commit('ADD_LOG', { msg: '已删除识别框', type: 'info' })
      }
    }

    async function saveBoxesToDb() {
      const original = JSON.stringify(activeResult.value?.boxes || [])
      const current = JSON.stringify(editBoxes.value)
      if (original === current) {
        farmState.showNotify?.('success', '保存成功', `已更新 ${editBoxes.value.length} 个识别框`)
        closeEditModal(); return
      }
      if (!editRecordId.value) {
        try { const r = await (await import('@/api/detectionApi')).getDetectionRecords({ page: 1, page_size: 1 }); if (r?.data?.length > 0) editRecordId.value = r.data[0].id } catch (_) {}
      }
      if (!editRecordId.value) {
        store.commit('ADD_LOG', { msg: '保存失败：无 recordId，请先重新识别', type: 'error' })
        farmState.showNotify?.('error', '保存失败', '无 recordId，请先重新识别'); return
      }
      try {
        const { updateDetectionRecord } = await import('@/api/detectionApi')
        let imageForApi = editImageUrl.value
        if (imageForApi?.startsWith('blob:')) {
          const resp = await fetch(imageForApi); const blob = await resp.blob()
          imageForApi = await new Promise(r => { const reader = new FileReader(); reader.onload = () => r(reader.result); reader.readAsDataURL(blob) })
        }
        const res = await updateDetectionRecord(editRecordId.value, { boxes: editBoxes.value, original_image: previewUrl.value || imageForApi, predicted_count: editBoxes.value.length })
        if (batchResults.value && selectedBatchImage.value) {
          for (const unit of batchResults.value.units) {
            for (const pen of unit.pens) {
              const match = selectedBatchImage.value.record_id ? pen.record_id === selectedBatchImage.value.record_id : (pen.pen_name === selectedBatchImage.value.pen_name && unit.unit_name === selectedBatchImage.value.unit_name)
              if (match) { pen.boxes = JSON.parse(JSON.stringify(editBoxes.value)); pen.pig_count = editBoxes.value.length; if (res.annotated_image) pen.annotated_image = res.annotated_image; break }
            }
          }
          let totalPigs = 0
          for (const unit of batchResults.value.units) { let u = 0; for (const pen of unit.pens) u += pen.pig_count || 0; unit.subtotal = u; totalPigs += u }
          batchResults.value.total_pigs = totalPigs
          batchResults.value = { ...batchResults.value }
          if (res.annotated_image) { farmState._latestAnnotatedImage = res.annotated_image; store.commit('SET_RESULT', { ...(result.value || {}), annotatedImage: res.annotated_image }) }
        } else if (result.value) {
          result.value.boxes = JSON.parse(JSON.stringify(editBoxes.value)); result.value.count = editBoxes.value.length
          const idx = store.state.currentImageIndex; if (store.state.results[idx]) store.state.results[idx].count = editBoxes.value.length
          if (res.annotated_image) { store.commit('SET_RESULT', { ...result.value, annotatedImage: res.annotated_image }); farmState._latestAnnotatedImage = res.annotated_image }
        }
        store.commit('ADD_LOG', { msg: `已保存 ${editBoxes.value.length} 个识别框到数据库`, type: 'success' })
        farmState.showNotify?.('success', '保存成功', `已更新 ${editBoxes.value.length} 个识别框`)
        const boxesSnapshot = JSON.parse(JSON.stringify(editBoxes.value))
        closeEditModal()
        nextTick(() => { nextTick(() => { if (resultCard.value) resultCard.value.drawBoxesAnimated(boxesSnapshot) }) })
      } catch (e) {
        store.commit('ADD_LOG', { msg: '保存失败：' + e.message, type: 'error' })
        farmState.showNotify?.('error', '保存失败', e.message)
      }
    }

    function exportAnnotatedImage() {
      const src = (batchResults.value && selectedBatchImage.value ? selectedBatchImage.value.url : null) || annotatedImage.value || activeResult.value?.imageUrl
      if (!src) return
      const img = new Image(); img.crossOrigin = 'anonymous'
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
        c.getContext('2d').drawImage(img, 0, 0)
        const link = document.createElement('a')
        let baseName = '识别结果'
        if (imageMeta.value?.name) baseName = imageMeta.value.name.replace(/\.[^.]+$/, '')
        else if (selectedBatchImage.value) { const u = selectedBatchImage.value.unit_name || ''; const p = (selectedBatchImage.value.pen_name || '').replace(/\.[^.]+$/, ''); baseName = u ? `${u}_${p}` : p }
        link.download = `${baseName}_标注结果.png`; link.href = c.toDataURL('image/png'); link.click()
        store.commit('ADD_LOG', { msg: '已导出标注图片', type: 'success' })
      }
      img.src = src
    }

    // Watch
    watch(pigCount, (val) => {
      if (val === null) { animatedCount.value = 0; return }
      const dur = 800, start = Date.now()
      const tick = () => { const t = Math.min((Date.now() - start) / dur, 1); animatedCount.value = Math.round(val * (1 - Math.pow(1 - t, 4))); if (t < 1) requestAnimationFrame(tick) }
      requestAnimationFrame(tick)
    })
    watch(hasResult, (val) => { if (!val && resultCard.value) resultCard.value.clearCanvas() })

    // Methods
    function prevImage() { const idx = store.state.currentImageIndex, total = store.state.imageFiles.length; if (total > 0) store.commit('SET_CURRENT_IMAGE_INDEX', (idx - 1 + total) % total) }
    function nextImage() { const idx = store.state.currentImageIndex, total = store.state.imageFiles.length; if (total > 0) store.commit('SET_CURRENT_IMAGE_INDEX', (idx + 1) % total) }
    function onDetailHover(i) { hoveredBox.value = i }

    function selectFarmWrapper(farmId) {
      farmState.selectFarm(farmId)
    }

    function handleAnalyzeWrapper() {
      if (batchTree.value && !hasImage.value) {
        farmState.runBatchAnalysis()
      } else {
        runSingleAnalysis()
      }
    }

    async function runSingleAnalysis() {
      if (!hasImage.value || isAnalyzing.value || !selectedFarmId.value) return
      if (!store.state.serviceOnline) {
        store.commit('ADD_LOG', { msg: '⚠️ 后端服务离线，无法识别图片', type: 'error' })
        farmState.showNotify?.('error', '服务不可用', '后端服务离线，无法识别图片')
        return
      }
      store.commit('SET_ANALYZING', true)
      store.commit('SET_PROGRESS', 0)
      const { analyzeImage } = await import('@/api/pigModel')
      const imageFiles = store.state.imageFiles.length > 0 ? store.state.imageFiles : [store.state.imageFile]
      store.commit('ADD_LOG', { msg: `发送 ${imageFiles.length} 张图片至数猪大模型…`, type: 'info' })
      try {
        const result = await analyzeImage(imageFiles, (p) => {
          store.commit('SET_PROGRESS', p)
        }, selectedFarmId.value)
        if (result.totalImages) {
          store.commit('SET_RESULTS', { results: result.results, totalPigs: result.totalPigs })
          if (!window.__modelOriginalCount) window.__modelOriginalCount = result.totalPigs
          store.commit('SET_PROGRESS', 100)
          setTimeout(() => farmState.showNotify?.('success', '识别完成', `${result.totalImages} 张图片，共检测到 ${result.totalPigs} 头猪`), 500)
          store.commit('ADD_LOG', { msg: `识别完成：${result.totalImages} 张图片，共检测到 ${result.totalPigs} 头猪`, type: 'success' })
        } else {
          store.commit('SET_RESULT', result)
          if (!window.__modelOriginalCount) window.__modelOriginalCount = result.count
          store.commit('SET_PROGRESS', 100)
          setTimeout(() => farmState.showNotify?.('success', '识别完成', `检测到 ${result.count} 头猪`), 500)
          store.commit('ADD_LOG', { msg: '识别完成：检测到 ' + result.count + ' 头猪', type: 'success' })
        }
        await farmState.loadDetectionStats?.()
      } catch (err) {
        const isCancel = err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED'
        if (isCancel) {
          store.commit('ADD_LOG', { msg: '识别已取消', type: 'info' })
        } else {
          store.commit('ADD_LOG', { msg: '识别失败：' + err.message, type: 'error' })
          farmState.showNotify?.('error', '识别失败', err.message)
        }
      } finally {
        store.commit('SET_ANALYZING', false)
      }
    }

    // Scroll handler
    const onScroll = () => { scrolled.value = window.scrollY > 80 }
    onMounted(() => { window.addEventListener('scroll', onScroll); onScroll() })
    onBeforeUnmount(() => { window.removeEventListener('scroll', onScroll) })

    return {
      scrolled, hoveredBox, animatedCount, resultCard, editImg, editCanvas,
      selectedFarmId, farms: farmState.farms, currentFarmName, warningFlash: farmState.warningFlash,
      showFarmDropdown: farmState.showFarmDropdown, showFarmModal: farmState.showFarmModal,
      hasImage, hasResult, previewUrl, imageMeta, isAnalyzing, uploadProgress,
      result, pigCount, confidencePct, inferenceTime, annotatedImage,
      confClass, activeResult, statCards, systemStats,
      batchTree, batchResults, batchProcessing, batchImageIndex,
      showFolderTree, batchAnnotatedImages, selectedBatchImage, selectedBatchResult,
      onBatchFolderChange: farmState.onBatchFolderChange, runBatchAnalysis: farmState.runBatchAnalysis,
      downloadBatchExcel: farmState.downloadBatchExcel, clearBatch: farmState.clearBatch,
      triggerBatchReUpload: farmState.triggerBatchReUpload, backToFolderTree: farmState.backToFolderTree,
      prevBatchImage: farmState.prevBatchImage, nextBatchImage: farmState.nextBatchImage,
      onTopFileChange: farmState.onTopFileChange, clearImage: farmState.clearImage,
      triggerWarningFlash: farmState.triggerWarningFlash || (() => {}),
      onServiceOnline: farmState.onServiceOnline,
      toggleFarmDropdown: farmState.toggleFarmDropdown,
      selectFarmWrapper, handleAnalyzeWrapper,
      showEditModal, editImageUrl, editImgKey, editRecordId, editBoxes, editSelectedIndex, editMode,
      openEditModal, closeEditModal, drawEditCanvas, onEditImgLoad,
      onEditCanvasMouseDown, onEditCanvasMouseMove, onEditCanvasMouseUp, onEditCanvasClick,
      saveBoxesToDb, exportAnnotatedImage,
      prevImage, nextImage, onDetailHover
    }
  }
}
</script>
