<template>
  <div id="app">
    <div class="ambient-wrap" aria-hidden="true">
      <div class="ambient-grid"></div>
    </div>

    <TopBar
      :scrolled="scrolled"
      :isAnalyzing="isAnalyzing"
      :uploadProgress="uploadProgress"
      :hasResult="hasResult"
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
      :hasResult="hasResult"
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

    <router-view @open-preview="openImagePreview" />

    <AppFooter />

    <ImagePreviewModal
      :visible="showImagePreview"
      :annotatedImage="previewImageSrc"
      :pigCount="previewType === 'annotated' ? previewPigCount : 0"
      :confidencePct="previewType === 'annotated' ? previewConfidencePct : 0"
      :showInfo="previewType === 'annotated'"
      @close="closeImagePreview"
    />

    <FarmManagementModal
      :visible="showFarmModal"
      :farms="farms"
      @close="closeFarmModal"
      @farm-added="onFarmAdded"
      @farm-updated="onFarmUpdated"
      @farm-deleted="onFarmDeleted"
    />

    <NotificationCard
      :visible="notify.visible"
      :type="notify.type"
      :title="notify.title"
      :description="notify.description"
      @close="closeNotify"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, provide } from 'vue'
import { useStore } from 'vuex'
import TopBar from '@/components/TopBar.vue'
import CapsuleNav from '@/components/CapsuleNav.vue'
import AppFooter from '@/components/AppFooter.vue'
import ImagePreviewModal from '@/components/ImagePreviewModal.vue'
import FarmManagementModal from '@/components/FarmManagementModal.vue'
import NotificationCard from '@/components/NotificationCard.vue'
import { useNotify } from '@/composables/useNotify'
import { useStats } from '@/composables/useStats'
import { useFarm } from '@/composables/useFarm'
import { useBatch } from '@/composables/useBatch'
import { useDetection } from '@/composables/useDetection'

export default {
  name: 'App',
  components: { TopBar, CapsuleNav, AppFooter, ImagePreviewModal, FarmManagementModal, NotificationCard },

  setup() {
    const store = useStore()
    const showImagePreview = ref(false)
    const previewType = ref('annotated')

    const notify = useNotify()
    const stats = useStats()
    const farm = useFarm({ showNotify: notify.showNotify, loadDetectionStats: stats.loadDetectionStats })
    const batch = useBatch({
      showNotify: notify.showNotify,
      showToastWithProgress: notify.showToastWithProgress,
      updateToastProgress: notify.updateToastProgress,
      closeNotify: notify.closeNotify
    })
    const detection = useDetection({
      showNotify: notify.showNotify,
      showToastWithProgress: notify.showToastWithProgress,
      updateToastProgress: notify.updateToastProgress,
      closeNotify: notify.closeNotify,
      loadDetectionStats: stats.loadDetectionStats,
      clearBatch: batch.clearBatch,
      batchTree: batch.batchTree
    })

    const annotatedImage = computed(() => store.state.result?.annotatedImage || null)
    const pigCount = computed(() => store.getters.pigCount)
    const confidencePct = computed(() => store.getters.confidencePct)
    const result = computed(() => store.state.result)
    const previewUrl = computed(() => store.state.previewUrl)
    const imageMeta = computed(() => store.state.imageMeta)
    const isAnalyzing = computed(() => store.state.isAnalyzing)
    const uploadProgress = computed(() => store.state.uploadProgress)
    const hasResult = computed(() => store.getters.hasResult)
    const hasImage = computed(() => store.getters.hasImage)

    const previewImageSrc = computed(() => {
      if (previewType.value === 'original') return previewUrl.value
      // 批量模式：用当前选中的批量图片
      if (batch.batchResults.value && batch.selectedBatchImage.value) {
        return batch.selectedBatchImage.value.url
      }
      return annotatedImage.value
    })
    const selectedFarmId = computed({
      get: () => store.state.selectedFarmId,
      set: (val) => store.commit('SET_FARM', val)
    })
    const currentFarmName = computed(() => farm.currentFarmName(selectedFarmId.value))

    const scrolled = ref(false)
    const warningFlash = ref(false)
    const onScroll = () => { scrolled.value = window.scrollY > 80 }
    onMounted(() => { window.addEventListener('scroll', onScroll); onScroll() })
    onBeforeUnmount(() => { window.removeEventListener('scroll', onScroll) })

    function selectFarmWrapper(farmId) {
      farm.selectFarm(farmId, farm.onFarmChange)
    }

    function triggerWarningFlash() {
      if (selectedFarmId.value && (hasImage.value || batch.batchTree.value)) return
      warningFlash.value = true
      setTimeout(() => { warningFlash.value = false }, 1300)
    }

    function onTopFileChange(files) {
      if (files.length > 0) detection.processFiles(files)
    }

    function handleAnalyzeWrapper() {
      if (batch.batchTree.value && !hasImage.value) {
        batch.runBatchAnalysis()
      } else {
        runSingleAnalysis()
      }
    }

    async function runSingleAnalysis() {
      if (!hasImage.value || isAnalyzing.value || !selectedFarmId.value) return
      if (!store.state.serviceOnline) {
        store.commit('ADD_LOG', { msg: '⚠️ 后端服务离线，无法识别图片', type: 'error' })
        notify.showNotify('error', '服务不可用', '后端服务离线，无法识别图片')
        return
      }
      store.commit('SET_ANALYZING', true)
      store.commit('SET_PROGRESS', 0)
      const { analyzeImage } = await import('@/api/pigModel')
      const imageFiles = store.state.imageFiles.length > 0 ? store.state.imageFiles : [store.state.imageFile]
      store.commit('ADD_LOG', { msg: `发送 ${imageFiles.length} 张图片至数猪大模型…`, type: 'info' })
      try {
        const result = await analyzeImage(imageFiles, (p) => { store.commit('SET_PROGRESS', p) }, selectedFarmId.value)
        if (result.totalImages) {
          store.commit('SET_RESULTS', { results: result.results, totalPigs: result.totalPigs })
          if (!window.__modelOriginalCount) window.__modelOriginalCount = result.totalPigs
          store.commit('SET_PROGRESS', 100)
          setTimeout(() => notify.showNotify('success', '识别完成', `${result.totalImages} 张图片，共检测到 ${result.totalPigs} 头猪`), 500)
          store.commit('ADD_LOG', { msg: `识别完成：${result.totalImages} 张，共 ${result.totalPigs} 头猪`, type: 'success' })
        } else {
          store.commit('SET_RESULT', result)
          if (!window.__modelOriginalCount) window.__modelOriginalCount = result.count
          store.commit('SET_PROGRESS', 100)
          setTimeout(() => notify.showNotify('success', '识别完成', `检测到 ${result.count} 头猪`), 500)
          store.commit('ADD_LOG', { msg: '识别完成：检测到 ' + result.count + ' 头猪', type: 'success' })
        }
        await stats.loadDetectionStats()
      } catch (err) {
        const isCancel = err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED'
        if (isCancel) { store.commit('ADD_LOG', { msg: '识别已取消', type: 'info' }) }
        else { store.commit('ADD_LOG', { msg: '识别失败：' + err.message, type: 'error' }); notify.showNotify('error', '识别失败', err.message) }
      } finally { store.commit('SET_ANALYZING', false) }
    }

    function openImagePreview(type = 'annotated') {
      previewType.value = type
      showImagePreview.value = true
      document.body.style.overflow = 'hidden'
    }
    function closeImagePreview() {
      showImagePreview.value = false
      document.body.style.overflow = ''
    }

    onMounted(async () => {
      await farm.loadFarms()
      await stats.loadDetectionStats()
    })

    // Provide shared state for child routes
    provide('farmState', {
      farms: farm.farms,
      showFarmModal: farm.showFarmModal,
      showFarmDropdown: farm.showFarmDropdown,
      selectedFarmId,
      currentFarmName,
      warningFlash: ref(false),
      batchTree: batch.batchTree,
      batchResults: batch.batchResults,
      batchProcessing: batch.batchProcessing,
      batchFullLoading: batch.batchFullLoading,
      batchImageIndex: batch.batchImageIndex,
      showFolderTree: batch.showFolderTree,
      batchAnnotatedImages: batch.batchAnnotatedImages,
      selectedBatchImage: batch.selectedBatchImage,
      selectedBatchResult: batch.selectedBatchResult,
      batchFiles: batch.batchFiles,
      onBatchFolderChange: batch.onBatchFolderChange,
      runBatchAnalysis: batch.runBatchAnalysis,
      downloadBatchExcel: batch.downloadBatchExcel,
      clearBatch: batch.clearBatch,
      triggerBatchReUpload: batch.triggerBatchReUpload,
      backToFolderTree: batch.backToFolderTree,
      prevBatchImage: batch.prevBatchImage,
      nextBatchImage: batch.nextBatchImage,
      clearImage: detection.clearImage,
      onTopFileChange: detection.onTopFileChange,
      systemStats: stats.systemStats,
      toggleFarmDropdown: farm.toggleFarmDropdown,
      onServiceOnline: farm.onServiceOnline,
      selectFarm: (farmId) => farm.selectFarm(farmId, farm.onFarmChange),
      onFarmChange: farm.onFarmChange,
      closeFarmModal: farm.closeFarmModal,
      onFarmAdded: farm.onFarmAdded,
      onFarmUpdated: farm.onFarmUpdated,
      onFarmDeleted: farm.onFarmDeleted,
      _latestAnnotatedImage: detection._latestAnnotatedImage,
      showNotify: notify.showNotify,
      triggerWarningFlash: ref(false)
    })

    return {
      scrolled, showImagePreview, previewType, warningFlash,
      notify: notify.notify, closeNotify: notify.closeNotify,
      farms: farm.farms, showFarmModal: farm.showFarmModal, showFarmDropdown: farm.showFarmDropdown,
      closeFarmModal: farm.closeFarmModal,
      onFarmAdded: farm.onFarmAdded, onFarmUpdated: farm.onFarmUpdated, onFarmDeleted: farm.onFarmDeleted,
      onServiceOnline: farm.onServiceOnline, toggleFarmDropdown: farm.toggleFarmDropdown, selectFarmWrapper,
      selectedFarmId, hasImage, hasResult, isAnalyzing, uploadProgress,
      currentFarmName, batchTree: batch.batchTree,
      onTopFileChange, onBatchFolderChange: batch.onBatchFolderChange, clearImage: detection.clearImage,
      triggerWarningFlash, handleAnalyzeWrapper,
      previewImageSrc,
      previewPigCount: computed(() => {
        if (batch.batchResults.value && batch.selectedBatchImage.value) return batch.selectedBatchImage.value.pig_count
        return pigCount.value
      }),
      previewConfidencePct: computed(() => {
        if (batch.batchResults.value && batch.selectedBatchImage.value) return Math.round(batch.selectedBatchImage.value.confidence * 100)
        return confidencePct.value
      }),
      openImagePreview, closeImagePreview
    }
  }
}
</script>

<style>
:root {
  --bg: #f2f2f7; --bg-2: #ffffff;
  --glass-bg: rgba(255, 255, 255, 0.65); --glass-border: rgba(255, 255, 255, 0.88);
  --glass-shadow: 0 2px 20px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04);
  --glass-hover: 0 8px 40px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.05);
  --text: #1c1c1e; --text-2: #3a3a3c; --text-3: #6e6e73; --text-4: #aeaeb2;
  --sep: rgba(60, 60, 67, 0.12); --sep-opaque: #d1d1d6;
  --blue: #007aff; --green: #34c759; --orange: #ff9500; --red: #ff3b30; --pig: #ff6b81;
  --r-sm: 10px; --r-md: 16px; --r-lg: 20px;
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1); --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
html { font-size: 16px }
body { background: var(--bg); color: var(--text); font-family: -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif; min-height: 100vh; -webkit-font-smoothing: antialiased; overflow-x: hidden }
#app { position: relative; min-height: 100vh }
.ambient-wrap { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden }
.ambient-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(0, 0, 0, 0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.018) 1px, transparent 1px); background-size: 48px 48px }
.glass-card { background: var(--glass-bg); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); border: 1px solid var(--glass-border); border-radius: var(--r-lg); box-shadow: var(--glass-shadow); transition: box-shadow 0.35s var(--ease-out), transform 0.35s var(--ease-out); position: relative; overflow: hidden }
.glass-card:hover { box-shadow: var(--glass-hover) }
.btn-ghost { display: flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: var(--r-sm); font-size: 13px; font-weight: 500; color: var(--text-2); background: rgba(255, 255, 255, 0.7); border: 1px solid var(--sep); cursor: pointer; transition: all 0.2s ease; text-decoration: none }
.btn-ghost:hover { background: white; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08); color: var(--text) }
.btn-primary { display: flex; align-items: center; position: relative; overflow: hidden; padding: 7px 18px; border-radius: var(--r-sm); background: var(--blue); color: white; border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s var(--spring); box-shadow: 0 2px 12px rgba(0, 122, 255, 0.35) }
.btn-primary:hover:not(:disabled) { background: #0071f3; box-shadow: 0 4px 20px rgba(0, 122, 255, 0.45); transform: translateY(-1px) }
.btn-primary:active:not(:disabled) { transform: scale(0.96) }
.btn-primary:disabled { background: var(--sep-opaque); color: var(--text-4); box-shadow: none; cursor: not-allowed }
.btn-hint { font-size: 12px; font-weight: 500; color: var(--orange); margin-left: 8px; animation: pulse 2s infinite }
.btn-hint--error { color: #ff3b30; font-weight: 600; background: rgba(255, 59, 48, 0.08); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255, 59, 48, 0.2) }
.btn-hint--warning { color: #ff9500; font-weight: 600; background: rgba(255, 149, 0, 0.08); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255, 149, 0, 0.2) }
@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.6 } }
.btn-primary-inner { display: flex; align-items: center; gap: 6px; position: relative; z-index: 1 }
.btn-shine { position: absolute; top: 0; left: -100%; width: 60%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent); transform: skewX(-20deg); transition: left 0.5s ease }
.btn-primary:hover .btn-shine { left: 150% }
.btn-spinner { width: 12px; height: 12px; border: 2px solid rgba(255, 255, 255, 0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite }
.btn-clear { width: 34px; height: 34px; padding: 0; justify-content: center; border-radius: 50% }
.btn-clear:hover { background: rgba(255, 59, 48, 0.08); border-color: rgba(255, 59, 48, 0.2); color: var(--red) }
.page-wrap { max-width: 1440px; margin: 0 auto; padding: 28px 28px 80px; position: relative; z-index: 1; display: flex; flex-direction: column; gap: 18px; background: transparent }
.image-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; height: 536px }
@media(max-width:720px) { .image-row { grid-template-columns: 1fr; height: auto } }
.top-info-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px }
@media(max-width:720px) { .top-info-row { grid-template-columns: 1fr } }
.section-rise-enter-active { animation: sectionIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) }
.section-rise-leave-active { animation: sectionIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) reverse }
@keyframes sectionIn { from { opacity: 0; transform: translateY(15px) } to { opacity: 1; transform: none } }
.current-farm-section, .system-stats-section { flex: 1 1 50%; min-width: 0; display: flex }
@media(max-width:720px) { .current-farm-section, .system-stats-section { flex: 1 1 100% } }
.meta-slide-enter-active { transition: all 0.35s var(--ease-out) }
.meta-slide-leave-active { transition: all 0.2s ease }
.meta-slide-enter-from { opacity: 0; transform: translateY(-6px) }
.meta-slide-leave-to { opacity: 0; transform: translateY(4px) }
.img-fade-enter-active, .img-fade-leave-active { transition: opacity 0.3s ease }
.img-fade-enter-from, .img-fade-leave-to { opacity: 0 }
.drag-fade-enter-active, .drag-fade-leave-active { transition: opacity 0.2s ease }
.drag-fade-enter-from, .drag-fade-leave-to { opacity: 0 }
.overlay-fade-enter-active { transition: opacity 0.4s ease }
.overlay-fade-leave-active { transition: opacity 0.25s ease }
.overlay-fade-enter-from, .overlay-fade-leave-to { opacity: 0 }
.edit-modal { position: fixed; inset: 0; z-index: 9998; display: flex; align-items: center; justify-content: center; padding: 20px }
.edit-backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px) }
.edit-container { position: relative; width: 90vw; max-width: 900px; max-height: 85vh; display: flex; flex-direction: column; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2) }
.edit-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--sep) }
.edit-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--text) }
.edit-actions { display: flex; align-items: center; gap: 8px }
.edit-tabs { display: flex; gap: 4px; background: rgba(0, 0, 0, 0.04); border-radius: 8px; padding: 3px }
.edit-tab { display: flex; align-items: center; gap: 4px; padding: 5px 12px; border-radius: 6px; border: none; background: transparent; font-size: 12px; font-weight: 500; color: var(--text-3); cursor: pointer; transition: all 0.2s ease }
.edit-tab:hover { color: var(--text-2) }
.edit-tab--active { background: white; color: var(--text); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1) }
.edit-btn { padding: 6px 12px; border-radius: 6px; border: 1px solid var(--sep); background: rgba(0, 0, 0, 0.03); font-size: 12px; font-weight: 500; color: var(--text-2); cursor: pointer; transition: all 0.2s }
.edit-btn:hover:not(:disabled) { border-color: var(--blue); color: var(--blue) }
.edit-btn:disabled { opacity: 0.4; cursor: not-allowed }
.edit-btn--primary { background: var(--blue); border-color: var(--blue); color: white }
.edit-btn--primary:hover:not(:disabled) { background: #0068d6 }
.edit-btn--danger { color: var(--red); border-color: rgba(255, 59, 48, 0.2) }
.edit-btn--danger:hover:not(:disabled) { background: rgba(255, 59, 48, 0.08); border-color: var(--red) }
.edit-close-btn { width: 32px; height: 32px; border-radius: 8px; border: none; background: rgba(0, 0, 0, 0.05); color: var(--text-3); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s }
.edit-close-btn:hover { background: rgba(0, 0, 0, 0.1); color: var(--text) }
.edit-body { flex: 1; display: flex; flex-direction: column; overflow: hidden }
.edit-info { display: flex; align-items: center; gap: 10px; padding: 10px 20px; border-bottom: 1px solid var(--sep); font-size: 12px; color: var(--text-3) }
.edit-pill { padding: 3px 8px; background: rgba(0, 122, 255, 0.08); border-radius: 6px; color: var(--blue); font-weight: 500 }
.edit-pill--mode { background: rgba(52, 199, 89, 0.08); color: var(--green) }
.edit-pill--delete { background: rgba(255, 59, 48, 0.08); color: var(--red) }
.edit-hint { margin-left: auto; color: var(--text-4) }
.edit-canvas-area { flex: 1; min-height: 300px; background: rgba(0, 0, 0, 0.03); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden }
.edit-img { max-width: 100%; max-height: 100%; object-fit: contain; display: block }
.edit-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: auto; cursor: crosshair }
.edit-placeholder { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-3); font-size: 14px }
.edit-placeholder-sub { font-size: 12px; color: var(--text-4) }
</style>
