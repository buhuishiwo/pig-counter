import { ref } from 'vue'
import { useStore } from 'vuex'
import { analyzeImage } from '@/api/pigModel'
import { validateImage, fileToDataURL, getImageDimensions, formatFileSize, ensureLandscape } from '@/utils/imageUtils'

export function useDetection({ showNotify, showToastWithProgress, updateToastProgress, closeNotify, loadDetectionStats, clearBatch, batchTree }) {
  const store = useStore()

  const _abortCtrl = ref(null)
  const _latestAnnotatedImage = ref(null)

  async function processFiles(files) {
    if (batchTree?.value) clearBatch()
    for (const file of files) {
      const { valid, error } = validateImage(file)
      if (!valid) {
        store.commit('ADD_LOG', { msg: `文件 ${file.name} 验证失败：${error}`, type: 'error' })
        return
      }
    }
    const previewUrls = []
    const metas = []
    const processedFiles = []
    for (const file of files) {
      const rotated = await ensureLandscape(file)
      processedFiles.push(rotated)
      const dataURL = await fileToDataURL(rotated)
      const dim = await getImageDimensions(dataURL)
      const meta = { name: rotated.name, size: formatFileSize(rotated.size), width: dim.width, height: dim.height }
      previewUrls.push(dataURL)
      metas.push(meta)
      store.commit('ADD_LOG', { msg: '已加载：' + rotated.name + '（' + meta.size + '，' + meta.width + '×' + meta.height + '）' + (rotated !== file ? ' [竖屏已旋转]' : ''), type: 'info' })
    }
    store.commit('SET_IMAGES', { files: processedFiles, previewUrls, metas })
  }

  async function processFile(file) {
    const { valid, error } = validateImage(file)
    if (!valid) {
      store.commit('ADD_LOG', { msg: error, type: 'error' })
      return
    }
    const rotated = await ensureLandscape(file)
    const dataURL = await fileToDataURL(rotated)
    const dim = await getImageDimensions(dataURL)
    const meta = { name: rotated.name, size: formatFileSize(rotated.size), width: dim.width, height: dim.height }
    store.commit('SET_IMAGE', { file: rotated, previewUrl: dataURL, meta })
    store.commit('ADD_LOG', { msg: '已加载：' + rotated.name + '（' + meta.size + '，' + meta.width + '×' + meta.height + '）' + (rotated !== file ? ' [竖屏已旋转]' : ''), type: 'info' })
  }

  function clearImage() {
    if (_abortCtrl.value) { _abortCtrl.value.abort(); _abortCtrl.value = null }
    _latestAnnotatedImage.value = null
    window.__modelOriginalCount = null
    if (batchTree?.value) {
      clearBatch()
    } else {
      store.commit('CLEAR_IMAGE')
    }
    store.commit('ADD_LOG', { msg: '已清除', type: 'info' })
  }

  function onTopFileChange(files) {
    if (files.length > 0) processFiles(files)
  }

  async function runAnalysis({ router, route, runBatchAnalysis }) {
    if (route?.path === '/stats') {
      store.commit('SET_AUTO_ANALYZE', true)
      router?.push('/')
      return
    }
    const hasImage = store.getters.hasImage
    const isAnalyzing = store.state.isAnalyzing
    const selectedFarmId = store.state.selectedFarmId
    if ((!hasImage && !batchTree?.value) || isAnalyzing || !selectedFarmId) return
    if (!store.state.serviceOnline) {
      store.commit('ADD_LOG', { msg: '⚠️ 后端服务离线，无法识别图片', type: 'error' })
      showNotify('error', '服务不可用', '后端服务离线，无法识别图片')
      return
    }

    store.commit('SET_ANALYZING', true)
    store.commit('SET_PROGRESS', 0)
    _abortCtrl.value = new AbortController()

    const imageFiles = store.state.imageFiles.length > 0 ? store.state.imageFiles : [store.state.imageFile]
    store.commit('ADD_LOG', { msg: `发送 ${imageFiles.length} 张图片至数猪大模型…`, type: 'info' })
    showToastWithProgress('正在识别图片...', 'toast-info')

    try {
      const result = await analyzeImage(imageFiles, (p) => {
        store.commit('SET_PROGRESS', p)
        updateToastProgress(p)
      }, selectedFarmId, _abortCtrl.value.signal)

      if (result.totalImages) {
        store.commit('SET_RESULTS', { results: result.results, totalPigs: result.totalPigs })
        if (!window.__modelOriginalCount) window.__modelOriginalCount = result.totalPigs
        store.commit('SET_PROGRESS', 100)
        updateToastProgress(100)
        setTimeout(() => {
          showNotify('success', '识别完成', `${result.totalImages} 张图片，共检测到 ${result.totalPigs} 头猪`)
        }, 500)
        store.commit('ADD_LOG', { msg: `识别完成：${result.totalImages} 张图片，共检测到 ${result.totalPigs} 头猪`, type: 'success' })
      } else {
        store.commit('SET_RESULT', result)
        if (!window.__modelOriginalCount) window.__modelOriginalCount = result.count
        store.commit('SET_PROGRESS', 100)
        updateToastProgress(100)
        setTimeout(() => {
          showNotify('success', '识别完成', `检测到 ${result.count} 头猪`)
        }, 500)
        store.commit('ADD_LOG', { msg: '识别完成：检测到 ' + result.count + ' 头猪', type: 'success' })
        store.commit('ADD_LOG', { msg: '置信度 ' + Math.round(result.confidence * 100) + '%' + (result.inferenceTime ? '  耗时 ' + result.inferenceTime + 'ms' : ''), type: 'success' })
      }
      await loadDetectionStats()
    } catch (err) {
      const isCancel = err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED' || (err.message && err.message.toLowerCase().includes('cancel'))
      if (isCancel) {
        store.commit('ADD_LOG', { msg: '识别已取消', type: 'info' })
      } else {
        store.commit('ADD_LOG', { msg: '识别失败：' + err.message, type: 'error' })
        showNotify('error', '识别失败', err.message)
      }
    } finally {
      _abortCtrl.value = null
      store.commit('SET_ANALYZING', false)
      closeNotify()
    }
  }

  function handleAnalyze({ router, route, runBatchAnalysis }) {
    if (batchTree?.value && !store.getters.hasImage) {
      runBatchAnalysis()
    } else {
      runAnalysis({ router, route, runBatchAnalysis })
    }
  }

  return {
    _latestAnnotatedImage,
    processFiles,
    processFile,
    clearImage,
    onTopFileChange,
    runAnalysis,
    handleAnalyze
  }
}
