<template>
  <div id="app" :class="{ 'has-result': hasResult }">
    <div class="ambient-wrap" aria-hidden="true">
      <div class="ambient-orb orb-1"></div>
      <div class="ambient-orb orb-2"></div>
      <div class="ambient-orb orb-3" :class="{ pulse: hasResult }"></div>
      <div class="ambient-grid"></div>
    </div>

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
      @select-farm="selectFarm"
      @manage-farm="showFarmModal = true"
      @file-change="onTopFileChange"
      @batch-folder-change="onBatchFolderChange"
      @analyze="handleAnalyze"
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
      @select-farm="selectFarm"
      @manage-farm="showFarmModal = true"
      @analyze="handleAnalyze"
      @clear-image="clearImage"
      @need-farm="triggerWarningFlash"
      @close-dropdown="showFarmDropdown = false"
    />
    <!-- 路由视图 -->
    <router-view v-if="$route.path !== '/'" />
    <div v-else class="page-wrap">
      <!-- 顶部信息行：猪场信息 + 系统统计 -->
      <div class="top-info-row">
        <!-- 当前猪场信息卡片 -->
        <div class="current-farm-section">
          <FarmInfoCard :selectedFarmId="selectedFarmId" :farmName="currentFarmName" :hasImage="hasImage || !!batchTree" :flash="warningFlash" />
        </div>

        <!-- 系统统计信息卡片 -->
        <div class="system-stats-section">
          <SystemStatsCard :stats="systemStats" />
        </div>
      </div>

      <StatCardsRow :cards="statCards" :animatedCount="animatedCount" />

      <div class="image-row">
        <!-- 左面板：单图 或 批量文件夹 或 批量结果 -->
        <BatchFolderUploader v-if="batchTree && (!batchResults || showFolderTree)"
          :batchTree="batchTree"
          :processing="batchProcessing"
          :hasResults="!!batchResults"
          @analyze="runBatchAnalysis"
          @clear="clearBatch"
          @show-results="showFolderTree = false"
          @re-upload="triggerBatchReUpload"
          @download-excel="downloadBatchExcel"
        />
        <BatchResultsTable v-else-if="batchResults"
          :batchResults="batchResults"
          @download="downloadBatchExcel"
          @clear="clearBatch"
          @back="backToFolderTree"
        />
        <OriginalImageCard v-else
          :hasImage="hasImage"
          :previewUrl="previewUrl"
          :imageMeta="imageMeta"
          :imageCount="$store.state.imageFiles.length"
          :currentImageIndex="$store.state.currentImageIndex"
          :farmSelected="!!selectedFarmId"
          @files-selected="processFiles"
          @batch-folder-selected="onBatchFolderChange"
          @need-farm="triggerWarningFlash"
          @prev="prevImage"
          @next="nextImage"
        />

        <ResultImageCard ref="resultCard"
          :hasImage="hasImage"
          :hasResult="hasResult"
          :previewUrl="previewUrl"
          :isAnalyzing="isAnalyzing"
          :result="result"
          :imageMeta="imageMeta"
          :hoveredBox="hoveredBox"
          :inferenceTime="inferenceTime"
          :confidencePct="confidencePct"
          :confClass="confClass"
          :pigCount="$store.getters.currentPigCount"
          :resultsCount="$store.state.results.length"
          :currentImageIndex="$store.state.currentImageIndex"
          :batchMode="!!batchTree"
          :batchProcessing="batchProcessing"
          :batchTotalPigs="batchResults ? batchResults.total_pigs : 0"
          :batchTotalPhotos="batchTree ? batchTree.totalFiles : 0"
          :batchUnitCount="batchTree ? batchTree.unitCount : 0"
          :batchAnnotatedImages="batchAnnotatedImages"
          :selectedBatchImage="selectedBatchImage"
          :selectedBatchResult="selectedBatchResult"
          :batchImageIndex="batchImageIndex"
          @open-preview="openImagePreview"
          @prev="batchResults ? prevBatchImage() : prevImage()"
          @next="batchResults ? nextBatchImage() : nextImage()"
        />
      </div>

      <transition name="section-rise">
        <DetectionDetailTable v-if="hasResult"
          :boxes="result.boxes"
          :pigCount="pigCount"
          :confidencePct="confidencePct"
          :confClass="confClass"
          :hoveredBox="hoveredBox"
          :imageMeta="imageMeta"
          :inferenceTime="inferenceTime"
          @hover="onDetailHover"
        />
      </transition>

      <!-- 批量检测明细 -->
      <transition name="section-rise">
        <DetectionDetailTable v-if="batchResults && selectedBatchImage"
          :boxes="selectedBatchImage.boxes || []"
          :pigCount="selectedBatchImage.pig_count"
          :confidencePct="Math.round(selectedBatchImage.confidence * 100)"
          :confClass="selectedBatchImage.confidence >= 0.85 ? 'conf-high' : selectedBatchImage.confidence >= 0.65 ? 'conf-mid' : 'conf-low'"
          :hoveredBox="hoveredBox"
          :imageMeta="{ width: selectedBatchImage.image_width, height: selectedBatchImage.image_height }"
          :inferenceTime="selectedBatchImage.processing_time_ms"
          @hover="onDetailHover"
        />
      </transition>

      <LogPanel />

      <AppFooter />
    </div>

    <!-- 通知提示 -->
    <notification-card
      :visible="notify.visible"
      :type="notify.type"
      :title="notify.title"
      :description="notify.description"
      @close="closeNotify"
    />

    <!-- 猪场管理弹窗 -->
    <FarmManagementModal
      :visible="showFarmModal"
      :farms="farms"
      @close="closeFarmModal"
      @farm-added="onFarmAdded"
      @farm-updated="onFarmUpdated"
      @farm-deleted="onFarmDeleted"
    />

    <!-- 图片预览模态框 -->
    <ImagePreviewModal
      :visible="showImagePreview"
      :annotatedImage="previewAnnotatedImage"
      :pigCount="previewPigCount"
      :confidencePct="previewConfidencePct"
      @close="closeImagePreview"
    />

  </div>
</template>

<script>
import LogPanel from '@/components/LogPanel.vue'
import NotificationCard from '@/components/NotificationCard.vue'
import AppFooter from '@/components/AppFooter.vue'
import ImagePreviewModal from '@/components/ImagePreviewModal.vue'
import FarmManagementModal from '@/components/FarmManagementModal.vue'
import FarmInfoCard from '@/components/FarmInfoCard.vue'
import SystemStatsCard from '@/components/SystemStatsCard.vue'
import StatCardsRow from '@/components/StatCardsRow.vue'
import DetectionDetailTable from '@/components/DetectionDetailTable.vue'
import BatchFolderUploader from '@/components/BatchFolderUploader.vue'
import BatchResultsTable from '@/components/BatchResultsTable.vue'
import OriginalImageCard from '@/components/OriginalImageCard.vue'
import ResultImageCard from '@/components/ResultImageCard.vue'
import TopBar from '@/components/TopBar.vue'
import CapsuleNav from '@/components/CapsuleNav.vue'
import { validateImage, fileToDataURL, getImageDimensions, formatFileSize } from '@/utils/imageUtils'
import { analyzeImage } from '@/api/pigModel'
import { getFarms } from '@/api/farmApi'
import { getDetectionStats } from '@/api/detectionApi'

export default {
  name: 'App',
  components: { LogPanel, NotificationCard, AppFooter, ImagePreviewModal, FarmManagementModal, FarmInfoCard, SystemStatsCard, StatCardsRow, DetectionDetailTable, BatchFolderUploader, BatchResultsTable, OriginalImageCard, ResultImageCard, TopBar, CapsuleNav },
  data() {
    return {
      scrolled: false,
      hoveredBox: null,
      animatedCount: 0,
      showImagePreview: false,
      // 猪场相关数据
      farms: [],
      selectedFarmId: null,
      showFarmModal: false,
      warningFlash: false,
      // 批次文件夹上传
      batchFiles: [],
      batchPaths: [],
      batchTree: null,        // { batchName, units: { unitName: [fileNames] } }
      batchResults: null,     // API 返回的结果
      batchProcessing: false,
      batchImageIndex: 0,    // 当前查看的批量图片索引
      showFolderTree: false, // 是否显示文件夹树（返回目录）

      // 系统统计数据
      systemStats: {
        total_images: 0,
        total_pigs: 0,
        today_images: 0,
        today_pigs: 0,
        avg_processing_time_ms: 0
      },
      // 自定义下拉状态
      showFarmDropdown: false,
      // 通知提示
      notify: { visible: false, type: 'info', title: '', description: '' },
      showToastProgress: false,
      toastProgress: 0
    }
  },
  computed: {
    hasImage() { return this.$store.getters.hasImage },
    hasResult() { return this.$store.getters.hasResult },
    previewUrl() { return this.$store.state.previewUrl },
    imageMeta() { return this.$store.state.imageMeta },
    isAnalyzing() { return this.$store.state.isAnalyzing },
    uploadProgress() { return this.$store.state.uploadProgress },
    result() { return this.$store.state.result },
    pigCount() { return this.$store.getters.pigCount },
    confidencePct() { return this.$store.getters.confidencePct },
    inferenceTime() { return this.$store.getters.inferenceTime },
    annotatedImage() { return this.$store.state.result?.annotatedImage || null },
    previewAnnotatedImage() {
      if (this.batchResults && this.selectedBatchImage) return this.selectedBatchImage.url
      return this.annotatedImage
    },
    previewPigCount() {
      if (this.batchResults && this.selectedBatchImage) return this.selectedBatchImage.pig_count
      return this.pigCount
    },
    previewConfidencePct() {
      if (this.batchResults && this.selectedBatchImage) return Math.round(this.selectedBatchImage.confidence * 100)
      return this.confidencePct
    },
    year() { return new Date().getFullYear() },
    confClass() {
      const p = this.confidencePct
      if (p >= 85) return 'conf-high'
      if (p >= 65) return 'conf-mid'
      return 'conf-low'
    },
    currentFarmName() {
      const farm = this.farms.find(f => f.id === this.selectedFarmId)
      return farm ? farm.name : '未选择'
    },
    batchAnnotatedImages() {
      if (!this.batchResults || !this.batchResults.units) return []
      const images = []
      for (const unit of this.batchResults.units) {
        for (const pen of unit.pens) {
          if (pen.annotated_image) {
            const img = pen.annotated_image
            const url = img.startsWith('data:') ? img : 'data:image/jpeg;base64,' + img
            images.push({
              url,
              pen_name: pen.pen_name,
              unit_name: unit.unit_name,
              pig_count: pen.pig_count,
              confidence: pen.confidence || 0,
              boxes: pen.boxes || [],
              image_width: pen.image_width || 0,
              image_height: pen.image_height || 0,
              processing_time_ms: pen.processing_time_ms || 0
            })
          }
        }
      }
      return images
    },
    selectedBatchImage() {
      if (!this.batchAnnotatedImages.length) return null
      return this.batchAnnotatedImages[this.batchImageIndex] || null
    },
    selectedBatchResult() {
      const img = this.selectedBatchImage
      if (!img) return null
      return { boxes: img.boxes, count: img.pig_count }
    },
    statCards() {
      if (this.batchTree) {
        return [
          { icon: 'Camera', label: '图片数量', value: this.batchResults ? this.batchResults.total_photos : this.batchTree.totalFiles, unit: '张', cls: '', active: true },
          { icon: 'Folder', label: '单元数量', value: this.batchTree.unitCount, unit: '个', cls: '', active: true },
          { icon: 'PiggyBank', label: '检测猪只', value: this.batchResults ? this.batchResults.total_pigs : null, unit: this.batchResults ? '头' : null, cls: '', active: !!this.batchResults },
          { icon: 'Zap', label: '处理耗时', value: this.batchResults ? '2847' : null, unit: this.batchResults ? 'ms' : null, cls: '', active: !!this.batchResults }
        ]
      }
      return [
        { icon: 'PiggyBank', label: '预测数量', value: this.hasResult ? this.pigCount : null, unit: this.hasResult ? '头' : null, cls: '', active: this.hasResult, animated: true },
        { icon: 'Zap', label: '处理耗时', value: this.inferenceTime, unit: this.inferenceTime ? 'ms' : null, cls: '', active: !!this.inferenceTime },
        { icon: 'Target', label: '平均置信度', value: this.hasResult ? this.confidencePct + '%' : null, unit: null, cls: this.confClass, active: this.hasResult },
        { icon: 'Sparkles', label: '当次识别总数', value: this.hasResult ? this.$store.state.totalPigs : null, unit: null, cls: '', active: this.hasResult }
      ]
    }
  },
  watch: {
    pigCount(val) { if (val === null) { this.animatedCount = 0; return } this.animateNumber(val) },
    hasResult(val) { if (!val && this.$refs.resultCard) this.$refs.resultCard.clearCanvas() },
    '$route.path'(newPath) {
      // 当路由切换到主页面，且autoAnalyze为true时，自动执行识别操作
      if (newPath === '/' && this.$store.state.autoAnalyze) {
        // 重置autoAnalyze标志
        this.$store.commit('SET_AUTO_ANALYZE', false)
        // 延迟执行，确保页面完全加载
        setTimeout(() => {
          this.runAnalysis()
        }, 500)
      }
    }
  },
  created() {},
  mounted() {
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('keydown', this.onKeyDown)

    const scroller = document.querySelector('.page-wrap') // 或其他容器
    this._scroller = scroller || window
    this._scroller.addEventListener('scroll', this.onScroll)
    window.addEventListener('scroll', this.onScroll)
  },
  beforeUnmount() {
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('keydown', this.onKeyDown)
    this._scroller.removeEventListener('scroll', this.onScroll)
  },
  methods: {
    onScroll() {
      this.scrolled = window.scrollY > 80
    },
    triggerWarningFlash() {
      if (this.selectedFarmId) return
      // 如果在胶囊区（已滚动），先滚回顶部再闪烁
      if (this.scrolled) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        setTimeout(() => { this.warningFlash = true; setTimeout(() => { this.warningFlash = false }, 1300) }, 400)
      } else {
        this.warningFlash = true
        setTimeout(() => { this.warningFlash = false }, 1300)
      }
    },
    toggleFarmDropdown() {
      this.showFarmDropdown = !this.showFarmDropdown
    },
    selectFarm(farmId) {
      this.selectedFarmId = farmId
      this.showFarmDropdown = false
      this.onFarmChange()
    },
    onKeyDown(e) {
      if (e.key === 'Escape' && this.showImagePreview) {
        this.closeImagePreview()
      }
    },
    onMouseMove(e) {
      const mx = e.clientX / window.innerWidth - 0.5
      const my = e.clientY / window.innerHeight - 0.5
      const o1 = document.querySelector('.orb-1')
      const o2 = document.querySelector('.orb-2')
      if (o1) o1.style.transform = 'translate(' + (mx * 30) + 'px,' + (my * 30) + 'px)'
      if (o2) o2.style.transform = 'translate(' + (-mx * 20) + 'px,' + (-my * 20) + 'px)'
    },

    openImagePreview() {
      if (this.batchResults && this.selectedBatchImage) {
        this.showImagePreview = true
        document.body.style.overflow = 'hidden'
      } else if (this.hasResult && this.annotatedImage) {
        this.showImagePreview = true
        document.body.style.overflow = 'hidden'
      }
    },
    closeImagePreview() {
      this.showImagePreview = false
      document.body.style.overflow = ''
    },
    showNotify(type, title, description, duration) {
      const dur = duration || (type === 'error' ? 6000 : 3000)
      this.notify = { visible: true, type, title, description: description || '' }
      if (this._notifyTimer) clearTimeout(this._notifyTimer)
      this._notifyTimer = setTimeout(() => this.closeNotify(), dur)
    },
    closeNotify() {
      this.notify = { ...this.notify, visible: false }
    },
    showToastWithProgress(message, type = 'info') {
      const typeMap = { 'toast-info': 'info', 'toast-error': 'error', 'toast-success': 'success' }
      const mappedType = typeMap[type] || type
      this.showNotify(mappedType, message)
      this.showToastProgress = true
      this.toastProgress = 0
    },
    updateToastProgress(progress) {
      this.toastProgress = progress
    },
    // 图片导航方法
    prevImage() {
      const currentIndex = this.$store.state.currentImageIndex
      const totalImages = this.$store.state.imageFiles.length
      if (totalImages > 0) {
        const newIndex = (currentIndex - 1 + totalImages) % totalImages
        this.$store.commit('SET_CURRENT_IMAGE_INDEX', newIndex)
      }
    },
    nextImage() {
      const currentIndex = this.$store.state.currentImageIndex
      const totalImages = this.$store.state.imageFiles.length
      if (totalImages > 0) {
        const newIndex = (currentIndex + 1) % totalImages
        this.$store.commit('SET_CURRENT_IMAGE_INDEX', newIndex)
      }
    },
    onTopFileChange(files) {
      if (files.length > 0) this.processFiles(files);
    },
    async processFiles(files) {
      // 验证所有文件
      for (const file of files) {
        const { valid, error } = validateImage(file);
        if (!valid) {
          this.$store.commit('ADD_LOG', { msg: `文件 ${file.name} 验证失败：${error}`, type: 'error' });
          return;
        }
      }

      // 处理所有文件
      const previewUrls = [];
      const metas = [];

      for (const file of files) {
        const dataURL = await fileToDataURL(file);
        const dim = await getImageDimensions(dataURL);
        const meta = { name: file.name, size: formatFileSize(file.size), width: dim.width, height: dim.height };
        previewUrls.push(dataURL);
        metas.push(meta);
        this.$store.commit('ADD_LOG', { msg: '已加载：' + file.name + '（' + meta.size + '，' + meta.width + '×' + meta.height + '）', type: 'info' });
      }

      this.$store.commit('SET_IMAGES', { files, previewUrls, metas });
    },
    async processFile(file) {
      const { valid, error } = validateImage(file);
      if (!valid) {
        this.$store.commit('ADD_LOG', { msg: error, type: 'error' });
        return;
      }
      const dataURL = await fileToDataURL(file);
      const dim = await getImageDimensions(dataURL);
      const meta = { name: file.name, size: formatFileSize(file.size), width: dim.width, height: dim.height };
      this.$store.commit('SET_IMAGE', { file, previewUrl: dataURL, meta });
      this.$store.commit('ADD_LOG', { msg: '已加载：' + file.name + '（' + meta.size + '，' + meta.width + '×' + meta.height + '）', type: 'info' });
    },
    clearImage() {
      if (this._abortCtrl) { this._abortCtrl.abort(); this._abortCtrl = null }
      if (this.batchTree) {
        this.clearBatch()
      } else {
        this.$store.commit('CLEAR_IMAGE')
      }
      this.$store.commit('ADD_LOG', { msg: '已清除', type: 'info' })
    },

    // ── 批次文件夹上传 ──

    onBatchFolderChange(e) {
      const raw = Array.from(e.target?.files || e || [])
      if (!raw.length) return

      // 统一格式：drag-and-drop 传 {file, path}，webkitdirectory 传 File
      const files = raw.map(item => {
        if (item.file && item.path) return { file: item.file, path: item.path }
        return { file: item, path: item.webkitRelativePath || item.name }
      })

      const tree = { batchName: '', units: {}, totalFiles: 0, unitCount: 0 }
      const batchFiles = []
      const batchPaths = []

      for (const { file, path } of files) {
        const normPath = path.replace(/\\/g, '/')
        const parts = normPath.split('/').filter(Boolean)
        if (parts.length < 2) continue

        if (!tree.batchName) tree.batchName = parts[0]
        const unitName = parts[1]
        const fileName = parts[parts.length - 1]

        const nameNoExt = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName
        if (nameNoExt === '栏舍号') continue

        if (!file.type.startsWith('image/')) continue

        if (!tree.units[unitName]) tree.units[unitName] = []
        tree.units[unitName].push(fileName)
        tree.totalFiles++
        batchFiles.push(file)
        batchPaths.push(normPath)
      }

      tree.unitCount = Object.keys(tree.units).length
      this.batchFiles = batchFiles
      this.batchPaths = batchPaths
      this.batchTree = tree
      this.batchResults = null
      this.$store.commit('CLEAR_IMAGE')
      this.$store.commit('ADD_LOG', { msg: `已加载文件夹: ${tree.batchName}（${tree.totalFiles} 张，${tree.unitCount} 单元）`, type: 'info' })
      if (e.target) e.target.value = ''
    },

    async runBatchAnalysis() {
      if (!this.batchFiles.length) return
      this.batchProcessing = true
      this.$store.commit('SET_ANALYZING', true)
      this.$store.commit('SET_PROGRESS', 0)
      this._abortCtrl = new AbortController()
      this.showToastWithProgress('批次检测中…')

      try {
        const formData = new FormData()
        if (this.selectedFarmId) formData.append('farm_id', this.selectedFarmId)
        this.batchFiles.forEach((f, i) => {
          const relPath = this.batchPaths?.[i] || f.webkitRelativePath || f.name
          formData.append('files', f, relPath)
        })

        const resp = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          this._abortCtrl.signal.addEventListener('abort', () => xhr.abort())
          xhr.open('POST', '/api/batch/upload')
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 90)
              this.$store.commit('SET_PROGRESS', pct)
              this.updateToastProgress(pct)
            }
          }
          xhr.onload = () => {
            this.$store.commit('SET_PROGRESS', 95)
            this.updateToastProgress(95)
            resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json: () => JSON.parse(xhr.responseText) })
          }
          xhr.onerror = () => reject(new Error('网络错误'))
          xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'))
          xhr.send(formData)
        })

        if (!resp.ok) {
          const err = await resp.json()
          throw new Error(err.detail || '上传失败')
        }

        this.batchResults = await resp.json()
        this.updateToastProgress(100)
        this.closeNotify()
        this.$store.commit('ADD_LOG', {
          msg: `批次检测完成: ${this.batchResults.total_pigs} 头猪`,
          type: 'info'
        })
      } catch (e) {
        if (e.name === 'AbortError') {
          this.closeNotify()
          this.$store.commit('ADD_LOG', { msg: '批量检测已取消', type: 'info' })
        } else {
          this.closeNotify()
          this.showNotify('error', '批量检测失败', e.message || '请重试')
          this.$store.commit('ADD_LOG', { msg: '批次检测失败: ' + e.message, type: 'error' })
        }
      } finally {
        this._abortCtrl = null
        this.batchProcessing = false
        this.$store.commit('SET_ANALYZING', false)
      }
    },

    downloadBatchExcel() {
      if (!this.batchResults || !this.batchResults.excel_base64) return
      const byteChars = atob(this.batchResults.excel_base64)
      const byteNums = new Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i)
      }
      const byteArr = new Uint8Array(byteNums)
      const blob = new Blob([byteArr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (this.batchResults.batch_name || '批次统计') + '.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    },

    clearBatch() {
      this.batchFiles = []
      this.batchPaths = []
      this.batchTree = null
      this.batchResults = null
      this.batchImageIndex = 0
      this.showFolderTree = false
    },
    triggerBatchReUpload(files) {
      this.onBatchFolderChange(files)
    },
    backToFolderTree() {
      this.showFolderTree = true
      this.batchImageIndex = 0
    },
    prevBatchImage() {
      const total = this.batchAnnotatedImages.length
      if (total > 0) this.batchImageIndex = (this.batchImageIndex - 1 + total) % total
    },
    nextBatchImage() {
      const total = this.batchAnnotatedImages.length
      if (total > 0) this.batchImageIndex = (this.batchImageIndex + 1) % total
    },
    handleAnalyze() {
      if (this.batchTree && !this.hasImage) {
        this.runBatchAnalysis()
      } else {
        this.runAnalysis()
      }
    },
    async runAnalysis() {
      // 检查是否在StatsPage页面
      if (this.$route.path === '/stats') {
        // 设置自动执行识别的标志
        this.$store.commit('SET_AUTO_ANALYZE', true)
        // 跳转到主页面
        this.$router.push('/')
        return
      }

      if ((!this.hasImage && !this.batchTree) || this.isAnalyzing || !this.selectedFarmId) return
      if (!this.$store.state.serviceOnline) {
        this.$store.commit('ADD_LOG', { msg: '⚠️ 后端服务离线，无法识别图片', type: 'error' })
        this.showNotify('error', '服务不可用', '后端服务离线，无法识别图片')
        return
      }
      const btn = this.$refs.analyzeBtn
      if (btn) { btn.style.transform = 'scale(0.93)'; setTimeout(() => { btn.style.transform = '' }, 150) }
      this.$store.commit('SET_ANALYZING', true)
      this.$store.commit('SET_PROGRESS', 0)
      this._abortCtrl = new AbortController()

      const imageFiles = this.$store.state.imageFiles.length > 0 ? this.$store.state.imageFiles : [this.$store.state.imageFile]
      this.$store.commit('ADD_LOG', { msg: `发送 ${imageFiles.length} 张图片至数猪大模型…`, type: 'info' })

      // 显示带进度的顶部提示栏
      this.showToastWithProgress('正在识别图片...', 'toast-info')

      try {
        const result = await analyzeImage(imageFiles, (p) => {
          this.$store.commit('SET_PROGRESS', p)
          this.updateToastProgress(p)
        }, this.selectedFarmId, this._abortCtrl.signal)

        // 处理批量结果
        if (result.totalImages) {
          this.$store.commit('SET_RESULTS', { results: result.results, totalPigs: result.totalPigs })
          this.$store.commit('SET_PROGRESS', 100)
          this.updateToastProgress(100)

          // 显示识别成功提示
          setTimeout(() => {
            this.showNotify('success', '识别完成', `${result.totalImages} 张图片，共检测到 ${result.totalPigs} 头猪`)
          }, 500)

          this.$store.commit('ADD_LOG', { msg: `识别完成：${result.totalImages} 张图片，共检测到 ${result.totalPigs} 头猪`, type: 'success' })
          result.results.forEach((r, index) => {
            this.$store.commit('ADD_LOG', { msg: `图片 ${index + 1}：检测到 ${r.count} 头猪，置信度 ${Math.round(r.confidence * 100)}%，耗时 ${r.inferenceTime}ms`, type: 'success' })
          })
        } else {
          // 处理单张结果
          this.$store.commit('SET_RESULT', result)
          this.$store.commit('SET_PROGRESS', 100)
          this.updateToastProgress(100)

          // 显示识别成功提示
          setTimeout(() => {
            this.showNotify('success', '识别完成', `检测到 ${result.count} 头猪`)
          }, 500)

          this.$store.commit('ADD_LOG', { msg: '识别完成：检测到 ' + result.count + ' 头猪', type: 'success' })
          this.$store.commit('ADD_LOG', { msg: '置信度 ' + Math.round(result.confidence * 100) + '%' + (result.inferenceTime ? '  耗时 ' + result.inferenceTime + 'ms' : ''), type: 'success' })
        }

        // 识别成功后刷新统计数据
        await this.loadDetectionStats()
      } catch (err) {
        const isCancel = err.name === 'CanceledError' || err.name === 'AbortError' ||
          err.code === 'ERR_CANCELED' || (err.message && err.message.toLowerCase().includes('cancel'))
        if (isCancel) {
          this.$store.commit('ADD_LOG', { msg: '识别已取消', type: 'info' })
        } else {
          this.$store.commit('ADD_LOG', { msg: '识别失败：' + err.message, type: 'error' })
          this.showNotify('error', '识别失败', err.message)
        }
      } finally {
        this._abortCtrl = null
        this.$store.commit('SET_ANALYZING', false)
        this.closeNotify()
      }
    },
    onDetailHover(i) { this.hoveredBox = i },
    animateNumber(target) {
      const dur = 800; const start = Date.now()
      const tick = () => {
        const t = Math.min((Date.now() - start) / dur, 1)
        this.animatedCount = Math.round(target * (1 - Math.pow(1 - t, 4)))
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    },
    async onServiceOnline() {
      await this.loadFarms()
      await this.loadDetectionStats()
    },

    // ========== 统计数据方法 ==========
    async loadDetectionStats() {
      try {
        const response = await getDetectionStats(this.selectedFarmId)
        if (response.success) {
          this.systemStats = response.data
        }
      } catch (err) {
        console.error('加载统计数据失败:', err)
      }
    },

    // ========== 猪场管理方法 ==========
    async loadFarms() {
      try {
        const response = await getFarms()
        if (response.success) {
          this.farms = response.data
          this.$store.commit('ADD_LOG', { msg: `已加载 ${this.farms.length} 个猪场`, type: 'info' })

          // 检查是否没有养殖场，第一次使用时提示
          if (this.farms.length === 0) {
            this.showNotify('info', '提示', '第一次使用请先创建养殖场')
          }
        }
      } catch (err) {
        this.$store.commit('ADD_LOG', { msg: '加载猪场列表失败：' + err.message, type: 'error' })
      }
    },
    async onFarmChange() {
      const farm = this.farms.find(f => f.id === this.selectedFarmId)
      if (farm) {
        this.$store.commit('ADD_LOG', { msg: `已选择猪场：${farm.name}`, type: 'info' })
      }
      // 切换猪场后刷新统计数据
      await this.loadDetectionStats()
    },
    closeFarmModal() {
      this.showFarmModal = false
    },
    onFarmAdded(farm) {
      this.farms.unshift(farm)
    },
    onFarmUpdated(farm) {
      const index = this.farms.findIndex(f => f.id === farm.id)
      if (index !== -1) this.farms.splice(index, 1, farm)
    },
    onFarmDeleted(farmId) {
      this.farms = this.farms.filter(f => f.id !== farmId)
      if (this.selectedFarmId === farmId) this.selectedFarmId = null
    }
  }
}
</script>

<style>
:root {
  --bg: #f2f2f7;
  --bg-2: #ffffff;
  --glass-bg: rgba(255, 255, 255, 0.65);
  --glass-border: rgba(255, 255, 255, 0.88);
  --glass-shadow: 0 2px 20px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04);
  --glass-hover: 0 8px 40px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.05);
  --text: #1c1c1e;
  --text-2: #3a3a3c;
  --text-3: #6e6e73;
  --text-4: #aeaeb2;
  --sep: rgba(60, 60, 67, 0.12);
  --sep-opaque: #d1d1d6;
  --blue: #007aff;
  --green: #34c759;
  --orange: #ff9500;
  --red: #ff3b30;
  --pig: #ff6b81;
  --r-sm: 10px;
  --r-md: 16px;
  --r-lg: 20px;
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0
}

html {
  font-size: 16px
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden
}

#app {
  position: relative;
  min-height: 100vh
}

.ambient-wrap {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden
}

.ambient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  transition: transform 1.2s var(--ease-out)
}

.orb-1 {
  width: 600px;
  height: 600px;
  top: -200px;
  left: -100px;
  background: radial-gradient(circle, rgba(255, 107, 129, 0.28) 0%, rgba(255, 149, 0, 0.12) 60%, transparent 100%)
}

.orb-2 {
  width: 500px;
  height: 500px;
  bottom: -150px;
  right: -100px;
  background: radial-gradient(circle, rgba(0, 122, 255, 0.18) 0%, rgba(88, 86, 214, 0.10) 60%, transparent 100%)
}

.orb-3 {
  width: 400px;
  height: 400px;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(52, 199, 89, 0.14) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 1.5s ease
}

.orb-3.pulse {
  opacity: 0.6;
  animation: orbPulse 4s ease-in-out infinite
}

@keyframes orbPulse {

  0%,
  100% {
    transform: translate(-50%, -50%) scale(1)
  }

  50% {
    transform: translate(-50%, -50%) scale(1.15)
  }
}

.ambient-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(0, 0, 0, 0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.018) 1px, transparent 1px);
  background-size: 48px 48px
}

.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-lg);
  box-shadow: var(--glass-shadow);
  transition: box-shadow 0.35s var(--ease-out), transform 0.35s var(--ease-out);
  position: relative;
  overflow: hidden
}

.glass-card:hover {
  box-shadow: var(--glass-hover)
}


.btn-ghost {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--r-sm);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid var(--sep);
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none
}

.btn-ghost:hover {
  background: white;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  color: var(--text)
}

.btn-primary {
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;
  padding: 7px 18px;
  border-radius: var(--r-sm);
  background: var(--blue);
  color: white;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s var(--spring);
  box-shadow: 0 2px 12px rgba(0, 122, 255, 0.35)
}

.btn-primary:hover:not(:disabled) {
  background: #0071f3;
  box-shadow: 0 4px 20px rgba(0, 122, 255, 0.45);
  transform: translateY(-1px)
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.96)
}

.btn-primary:disabled {
  background: var(--sep-opaque);
  color: var(--text-4);
  box-shadow: none;
  cursor: not-allowed
}

.btn-hint {
  font-size: 12px;
  font-weight: 500;
  color: var(--orange);
  margin-left: 8px;
  animation: pulse 2s infinite
}

.btn-hint--error {
  color: #ff3b30;
  font-weight: 600;
  background: rgba(255, 59, 48, 0.08);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 59, 48, 0.2)
}

.btn-hint--warning {
  color: #ff9500;
  font-weight: 600;
  background: rgba(255, 149, 0, 0.08);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 149, 0, 0.2)
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1
  }

  50% {
    opacity: 0.6
  }
}

.btn-primary-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  z-index: 1
}

.btn-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
  transform: skewX(-20deg);
  transition: left 0.5s ease
}

.btn-primary:hover .btn-shine {
  left: 150%
}

.btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite
}

.btn-clear {
  width: 34px;
  height: 34px;
  padding: 0;
  justify-content: center;
  border-radius: 50%
}

.btn-clear:hover {
  background: rgba(255, 59, 48, 0.08);
  border-color: rgba(255, 59, 48, 0.2);
  color: var(--red)
}


.page-wrap {
  max-width: 1440px;
  margin: 0 auto;
  padding: 28px 28px 80px;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: var(--bg)
}


.image-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  height: 536px
}

@media(max-width:720px) {
  .image-row {
    grid-template-columns: 1fr;
    height: auto
  }
}

.top-info-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px
}

@media(max-width:720px) {
  .top-info-row {
    grid-template-columns: 1fr
  }
}

.section-rise-enter-active { animation: sectionIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) }
.section-rise-leave-active { animation: sectionIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) reverse }

@keyframes sectionIn {
  from { opacity: 0; transform: translateY(15px) }
  to { opacity: 1; transform: none }
}

/* 顶部信息行布局 */
.current-farm-section,
.system-stats-section {
  flex: 1 1 50%;
  min-width: 0;
  display: flex
}

@media(max-width:720px) {
  .current-farm-section,
  .system-stats-section {
    flex: 1 1 100%
  }
}

/* ── 全局 transition 定义（Vue 3 命名） ── */
.meta-slide-enter-active { transition: all 0.35s var(--ease-out) }
.meta-slide-leave-active { transition: all 0.2s ease }
.meta-slide-enter-from { opacity: 0; transform: translateY(-6px) }
.meta-slide-leave-to { opacity: 0; transform: translateY(4px) }

.img-fade-enter-active,
.img-fade-leave-active { transition: opacity 0.3s ease }
.img-fade-enter-from,
.img-fade-leave-to { opacity: 0 }

.drag-fade-enter-active,
.drag-fade-leave-active { transition: opacity 0.2s ease }
.drag-fade-enter-from,
.drag-fade-leave-to { opacity: 0 }

.overlay-fade-enter-active { transition: opacity 0.4s ease }
.overlay-fade-leave-active { transition: opacity 0.25s ease }
.overlay-fade-enter-from,
.overlay-fade-leave-to { opacity: 0 }


</style>
