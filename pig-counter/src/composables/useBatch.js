import { ref, computed } from 'vue'
import { useStore } from 'vuex'

export function useBatch({ showNotify, showToastWithProgress, updateToastProgress, closeNotify }) {
  const store = useStore()

  const batchFiles = ref([])
  const batchPaths = ref([])
  const batchTree = ref(null)
  const batchResults = ref(null)
  const batchProcessing = ref(false)
  const batchFullLoading = ref(false)
  const batchImageIndex = ref(0)
  const showFolderTree = ref(false)
  const _batchAbortCtrl = ref(null)

  const batchAnnotatedImages = computed(() => {
    if (!batchResults.value?.units) return []
    const images = []
    for (const unit of batchResults.value.units) {
      for (const pen of unit.pens) {
        if (pen.annotated_image) {
          const img = pen.annotated_image
          const url = img.startsWith('data:') ? img : 'data:image/jpeg;base64,' + img
          if (!pen.original_pig_count) pen.original_pig_count = pen.pig_count
          images.push({
            url,
            pen_name: pen.pen_name,
            unit_name: unit.unit_name,
            pig_count: pen.pig_count,
            original_pig_count: pen.original_pig_count,
            confidence: pen.confidence || 0,
            boxes: pen.boxes || [],
            record_id: pen.record_id || null,
            image_width: pen.image_width || 0,
            image_height: pen.image_height || 0,
            processing_time_ms: pen.processing_time_ms || 0
          })
        }
      }
    }
    return images
  })

  const selectedBatchImage = computed(() => {
    if (!batchAnnotatedImages.value.length) return null
    return batchAnnotatedImages.value[batchImageIndex.value] || null
  })

  const selectedBatchResult = computed(() => {
    const img = selectedBatchImage.value
    if (!img) return null
    return { boxes: img.boxes, count: img.pig_count }
  })

  function onBatchFolderChange(e) {
    const raw = Array.from(e.target?.files || e || [])
    if (!raw.length) return
    const files = raw.map(item => {
      if (item.file && item.path) return { file: item.file, path: item.path }
      return { file: item, path: item.webkitRelativePath || item.name }
    })
    const tree = { batchName: '', units: {}, totalFiles: 0, unitCount: 0 }
    const newBatchFiles = []
    const newBatchPaths = []
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
      newBatchFiles.push(file)
      newBatchPaths.push(normPath)
    }
    tree.unitCount = Object.keys(tree.units).length
    batchFiles.value = newBatchFiles
    batchPaths.value = newBatchPaths
    batchTree.value = tree
    batchResults.value = null
    store.commit('CLEAR_IMAGE')
    store.commit('ADD_LOG', { msg: `已加载文件夹: ${tree.batchName}（${tree.totalFiles} 张，${tree.unitCount} 单元）`, type: 'info' })
    if (e.target) e.target.value = ''
  }

  async function runBatchAnalysis() {
    if (!batchFiles.value.length) return
    const prevBatchResults = batchResults.value ? JSON.parse(JSON.stringify(batchResults.value)) : null
    const prevBatchImageIndex = batchImageIndex.value
    batchProcessing.value = true
    store.commit('SET_ANALYZING', true)
    store.commit('SET_PROGRESS', 0)
    const abortCtrl = new AbortController()
    _batchAbortCtrl.value = abortCtrl
    let simTimer = null
    function startSimProgress() {
      let ticks = 0
      simTimer = setInterval(() => {
        ticks++
        const t = ticks * 0.2
        const pct = Math.min(99, 50 + 49 * (1 - Math.exp(-t / 15)))
        const v = Math.round(pct)
        store.commit('SET_PROGRESS', v)
        updateToastProgress(v)
      }, 200)
    }
    function stopSimProgress() {
      if (simTimer) { clearInterval(simTimer); simTimer = null }
    }
    showToastWithProgress('批次检测中…')
    try {
      const formData = new FormData()
      if (store.state.selectedFarmId) formData.append('farm_id', store.state.selectedFarmId)
      batchFiles.value.forEach((f, i) => {
        formData.append('files', f)
        formData.append('file_paths', batchPaths.value?.[i] || f.webkitRelativePath || f.name)
      })
      const resp = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        abortCtrl.signal.addEventListener('abort', () => xhr.abort())
        xhr.open('POST', '/api/batch/upload')
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 50)
            store.commit('SET_PROGRESS', pct)
            updateToastProgress(pct)
          }
        }
        xhr.upload.onload = () => {
          startSimProgress()
        }
        xhr.onload = () => {
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
      batchFullLoading.value = true
      batchResults.value = await resp.json()
      stopSimProgress()
      await new Promise(r => {
        let cur = store.state.uploadProgress
        const tick = setInterval(() => {
          cur = Math.min(cur + Math.max(2, (100 - cur) * 0.15), 100)
          store.commit('SET_PROGRESS', Math.round(cur))
          updateToastProgress(Math.round(cur))
          if (cur >= 100) { clearInterval(tick); setTimeout(r, 400) }
        }, 50)
      })
      closeNotify()
      store.commit('ADD_LOG', { msg: `批次检测完成: ${batchResults.value.total_pigs} 头猪`, type: 'info' })
      loadBatchFullImages()
    } catch (e) {
      stopSimProgress()
      if (e.name === 'AbortError') {
        closeNotify()
        store.commit('ADD_LOG', { msg: '批量检测已取消', type: 'info' })
        if (prevBatchResults) {
          batchResults.value = prevBatchResults
          batchImageIndex.value = prevBatchImageIndex
        }
      } else {
        closeNotify()
        showNotify('error', '批量检测失败', e.message || '请重试')
        store.commit('ADD_LOG', { msg: '批次检测失败: ' + e.message, type: 'error' })
      }
    } finally {
      stopSimProgress()
      _batchAbortCtrl.value = null
      batchProcessing.value = false
      store.commit('SET_ANALYZING', false)
    }
  }

  async function loadBatchFullImages() {
    if (!batchResults.value?.units) return
    let updated = false
    try {
      for (const unit of batchResults.value.units) {
        for (const pen of unit.pens) {
          if (!pen.record_id || pen.annotated_image) continue
          if (_batchAbortCtrl.value?.signal.aborted) return
          try {
            const res = await fetch(`/api/detection-records/${pen.record_id}`, { signal: _batchAbortCtrl.value?.signal })
            if (!res.ok) continue
            const data = await res.json()
            if (data.annotated_image) { pen.annotated_image = data.annotated_image; updated = true }
          } catch (_) {}
        }
      }
      if (updated) batchResults.value = { ...batchResults.value }
    } finally {
      batchFullLoading.value = false
    }
  }

  async function downloadBatchExcel() {
    if (!batchResults.value) return
    showNotify('info', '正在生成', 'Excel 导出中…')
    try {
      const resp = await fetch('/api/batch/regenerate-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_name: batchResults.value.batch_name, units: batchResults.value.units })
      })
      const data = await resp.json()
      if (!data.success || !data.excel_base64) throw new Error(data.detail || '生成失败')
      const byteChars = atob(data.excel_base64)
      const byteArr = Uint8Array.from(byteChars, c => c.charCodeAt(0))
      const blob = new Blob([byteArr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (batchResults.value.batch_name || '批次统计') + '.xlsx'
      a.click()
      URL.revokeObjectURL(url)
      showNotify('success', '导出成功', `共 ${batchResults.value.total_photos || ''} 张图片`)
    } catch (e) {
      showNotify('error', '导出失败', e.message)
    }
  }

  function clearBatch() {
    if (_batchAbortCtrl.value) { _batchAbortCtrl.value.abort(); _batchAbortCtrl.value = null }
    batchFiles.value = []
    batchPaths.value = []
    batchTree.value = null
    batchResults.value = null
    batchImageIndex.value = 0
    showFolderTree.value = false
    store.commit('CLEAR_IMAGE')
  }

  function triggerBatchReUpload(files) {
    onBatchFolderChange(files)
  }

  function backToFolderTree() {
    showFolderTree.value = true
    batchImageIndex.value = 0
  }

  function prevBatchImage() {
    const total = batchAnnotatedImages.value.length
    if (total > 0) batchImageIndex.value = (batchImageIndex.value - 1 + total) % total
  }

  function nextBatchImage() {
    const total = batchAnnotatedImages.value.length
    if (total > 0) batchImageIndex.value = (batchImageIndex.value + 1) % total
  }

  return {
    batchFiles,
    batchPaths,
    batchTree,
    batchResults,
    batchProcessing,
    batchFullLoading,
    batchImageIndex,
    showFolderTree,
    batchAnnotatedImages,
    selectedBatchImage,
    selectedBatchResult,
    onBatchFolderChange,
    runBatchAnalysis,
    loadBatchFullImages,
    downloadBatchExcel,
    clearBatch,
    triggerBatchReUpload,
    backToFolderTree,
    prevBatchImage,
    nextBatchImage
  }
}
