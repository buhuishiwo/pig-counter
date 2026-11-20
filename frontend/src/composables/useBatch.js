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

  // 每批张数：内网 qwen3.8-27b 实测 ~15.4s/张（推理 0.35s + OCR ~15s），
  // 25 张 ≈ 385 秒，稳在 nginx proxy_read_timeout（600s）以内；50 张会 770s 触发 504。
  const CHUNK_SIZE = 25
  // 批内进度估算用：与上面的实测值保持一致，否则进度条会早早卡在 95%
  const MS_PER_PHOTO = 15400

  /** 单批上传：一次 XHR POST /api/batch/upload */
  function uploadChunk(files, paths, farmId, abortCtrl, onUploadFrac, token) {
    const formData = new FormData()
    if (farmId) formData.append('farm_id', farmId)
    // 分批上传不生成 Excel：最终下载走 /api/batch/regenerate-excel
    formData.append('skip_excel', 'true')
    if (token) formData.append('batch_token', token)
    files.forEach((f, i) => {
      formData.append('files', f)
      formData.append('file_paths', paths[i])
    })
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      abortCtrl.signal.addEventListener('abort', () => xhr.abort())
      xhr.open('POST', '/api/batch/upload')
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onUploadFrac) onUploadFrac(e.loaded / e.total)
      }
      xhr.onload = () => {
        const text = xhr.responseText || ''
        // Content-Length 是字节数；用来判断响应是否被截断（截断时会 JSON.parse 报
        // "Unexpected end of JSON input"，用户看到的就是“批量检测失败”）
        let received = 0
        try { received = new Blob([text]).size } catch (_) { received = text.length }
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          text,
          received,
          contentLength: Number(xhr.getResponseHeader('Content-Length') || 0)
        })
      }
      xhr.onerror = () => reject(new Error('网络错误'))
      xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'))
      xhr.send(formData)
    })
  }

  const PENDING_ROLLBACK_KEY = 'pigcount_pending_rollback'

  function readPendingRollback() {
    try { return JSON.parse(localStorage.getItem(PENDING_ROLLBACK_KEY) || '[]') } catch (_) { return [] }
  }
  function writePendingRollback(ids) {
    try {
      if (ids.length) localStorage.setItem(PENDING_ROLLBACK_KEY, JSON.stringify(ids))
      else localStorage.removeItem(PENDING_ROLLBACK_KEY)
    } catch (_) { /* localStorage 不可用时忽略 */ }
  }

  /**
   * 删除本次上传写入的记录（两种用途）：
   *   1) 合并时被淘汰的跨批重复项（同一栏只留识别数最多的一条）
   *   2) 识别失败回滚：把本次已写入的记录清掉，回到"未识别"状态，避免留下无人展示的脏数据
   */
  async function removeRecords(ids, reason = '') {
    if (!ids || !ids.length) return
    try {
      const r = await fetch('/api/batch/dedupe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remove_record_ids: ids })
      })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const data = await r.json().catch(() => ({}))
      if (data && data.deleted) {
        store.dispatch('addLog', {
          msg: reason ? `已回滚 ${data.deleted} 条记录（${reason}）` : `已清理 ${data.deleted} 条跨批重复记录`,
          type: 'info'
        })
      }
    } catch (_) {
      // 后端此刻不可用（例如失败原因就是服务挂了）→ 记入待回滚队列，等下次进页面/开始识别时补做
      writePendingRollback([...new Set([...readPendingRollback(), ...ids])])
    }
  }

  /** 补做上次没成功的回滚（后端恢复后调用） */
  async function flushPendingRollback() {
    const ids = readPendingRollback()
    if (!ids.length) return
    try {
      const r = await fetch('/api/batch/dedupe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remove_record_ids: ids })
      })
      if (!r.ok) return
      writePendingRollback([])
      store.dispatch('addLog', { msg: `已补做上次失败批次的数据回滚（${ids.length} 条）`, type: 'info' })
    } catch (_) { /* 下次再试 */ }
  }

  /** 取出若干批结果里所有 record_id */
  function collectRecordIds(results) {
    const ids = []
    for (const r of results) {
      for (const u of r.units || []) {
        for (const p of u.pens || []) {
          if (p.record_id) ids.push(p.record_id)
        }
      }
    }
    return ids
  }

  /** 通知服务端取消：让正在跑的批次在下一个栏推理前停下（已写入的记录保留） */
  function cancelOnServer(token) {
    if (!token) return
    try {
      const body = JSON.stringify({ token })
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/batch/cancel', new Blob([body], { type: 'application/json' }))
      } else {
        fetch('/api/batch/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
      }
    } catch (_) { /* 取消失败不影响本地流程 */ }
  }

  /**
   * 合并多批结果。规则与 backend/app.py 中 batch_upload 的聚合一致：
   * 同一 (单元, 栏号) 只保留 predicted_count 最大的一张（前端这里是 pig_count），
   * 数量相同时保留先出现的批次（=上传顺序靠前）。
   * 后端改动时请同步此处。
   */
  function mergeChunkResults(results) {
    const unitOrder = []
    const unitMap = new Map()
    const superseded = []          // 跨批同栏被淘汰的重复记录 id（合并后从库里删掉）
    let totalPhotos = 0
    let totalPigs = 0
    for (const res of results) {
      for (const unit of res.units || []) {
        if (!unitMap.has(unit.unit_name)) {
          unitMap.set(unit.unit_name, new Map())
          unitOrder.push(unit.unit_name)
        }
        const pens = unitMap.get(unit.unit_name)
        for (const pen of unit.pens || []) {
          const key = pen.pen_number ?? pen.pen_name
          const prev = pens.get(key)
          if (!prev) {
            pens.set(key, pen)
          } else if ((pen.pig_count || 0) > (prev.pig_count || 0)) {
            if (prev.record_id) superseded.push(prev.record_id)
            pens.set(key, pen)
          } else if (pen.record_id) {
            superseded.push(pen.record_id)
          }
        }
      }
    }
    const units = unitOrder.map(name => {
      const pens = Array.from(unitMap.get(name).values())
      const subtotal = pens.reduce((s, p) => s + (p.pig_count || 0), 0)
      totalPhotos += pens.length
      totalPigs += subtotal
      return { unit_name: name, pens, subtotal }
    })
    return { units, total_photos: totalPhotos, total_pigs: totalPigs, superseded }
  }

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
            // 原图在本次上传中的相对路径（与 batchPaths 中的值一一对应），
            // 用于在编辑标注时按路径找到正确的原始文件（不能按位置索引，见下）
            source_path: pen.source_path || '',
            unit_name: unit.unit_name,
            pig_count: pen.pig_count,
            original_pig_count: pen.original_pig_count,
            confidence: pen.confidence || 0,
            boxes: pen.boxes || [],
            record_id: pen.record_id || null,
            image_width: pen.image_width || 0,
            image_height: pen.image_height || 0,
            processing_time_ms: pen.processing_time_ms || 0,
            watermark: pen.watermark || null
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
      // 门牌照（命名固定为"单元号"）：只有栋舍信息、没有栏号和猪只，不参与识别
      if (nameNoExt === '单元号') continue
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
    store.dispatch('addLog', { msg: `已加载文件夹: ${tree.batchName}（${tree.totalFiles} 张，${tree.unitCount} 单元）`, type: 'info' })
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

    // 切批：每 CHUNK_SIZE 张一批，单批耗时远低于 nginx 600s，且请求体远低于 500M
    const totalFiles = batchFiles.value.length
    const chunks = []
    for (let start = 0; start < totalFiles; start += CHUNK_SIZE) {
      const files = batchFiles.value.slice(start, start + CHUNK_SIZE)
      const paths = files.map((f, i) => batchPaths.value?.[start + i] || f.webkitRelativePath || f.name)
      chunks.push({ files, paths })
    }
    const totalChunks = chunks.length

    let tickTimer = null
    const setProgress = (v) => {
      const p = Math.max(0, Math.min(100, Math.round(v)))
      store.commit('SET_PROGRESS', p)
      updateToastProgress(p)
    }
    const stopTick = () => { if (tickTimer) { clearInterval(tickTimer); tickTimer = null } }

    flushPendingRollback()   // 上次失败时后端不可用，回滚没做成，这里补做

    showToastWithProgress(totalChunks > 1 ? `批次检测中…（共 ${totalChunks} 批）` : '批次检测中…')
    // 取消令牌：取消、刷新、关页时告知服务端停手（否则服务端会继续跑完本批）
    const batchToken = (globalThis.crypto?.randomUUID && crypto.randomUUID()) || `b${Date.now()}${Math.random().toString(16).slice(2)}`
    const onPageHide = () => cancelOnServer(batchToken)
    window.addEventListener('pagehide', onPageHide)
    const chunkResults = []
    let cancelledByServer = false
    try {
      for (let i = 0; i < totalChunks; i++) {
        const ch = chunks[i]
        const spanStart = (i / totalChunks) * 100
        const span = 100 / totalChunks
        const expectedMs = Math.max(3000, ch.files.length * MS_PER_PHOTO)
        const startedAt = Date.now()
        let uploadFrac = 0
        // 批内进度：已用时间 ÷ 预计时间，封顶本批 95%，等真正收到响应才走满
        tickTimer = setInterval(() => {
          const elapsed = Math.min(0.95, (Date.now() - startedAt) / expectedMs)
          setProgress(spanStart + span * Math.max(elapsed, uploadFrac * 0.3))
        }, 250)

        const batchLabel = totalChunks > 1 ? `第 ${i + 1}/${totalChunks} 批` : ''
        // 大响应偶尔会被截断（前端表现为 “Unexpected end of JSON input”），
        // 这里做一次自动重试；仍失败才向上抛，并带上诊断信息。
        let chunkJson = null
        let lastErr = null
        for (let attempt = 1; attempt <= 2 && !chunkJson; attempt++) {
          let resp
          try {
            resp = await uploadChunk(ch.files, ch.paths, store.state.selectedFarmId, abortCtrl, frac => { uploadFrac = frac }, batchToken)
          } finally {
            stopTick()
          }
          if (!resp.ok) {
            let detail = ''
            try { detail = JSON.parse(resp.text)?.detail || '' } catch (_) {}
            lastErr = new Error(`${batchLabel}失败：${detail || `HTTP ${resp.status}`}`)
            // 4xx 属参数/体积问题，重试无意义
            if (resp.status >= 400 && resp.status < 500) break
          } else {
            const truncated = resp.contentLength > 0 && resp.received < resp.contentLength
            if (truncated) {
              lastErr = new Error(`${batchLabel}响应不完整：收到 ${resp.received} 字节，应为 ${resp.contentLength} 字节`)
            } else {
              try {
                chunkJson = JSON.parse(resp.text)
              } catch (e) {
                lastErr = new Error(`${batchLabel}响应解析失败（收到 ${resp.received} 字节）`)
              }
            }
          }
          if (!chunkJson && attempt < 2) {
            store.dispatch('addLog', { msg: `重试${batchLabel}（${lastErr?.message || '响应异常'}）`, type: 'warn' })
            await new Promise(r => setTimeout(r, 1200))
          }
        }
        if (!chunkJson) throw lastErr || new Error(`${batchLabel}失败`)
        chunkResults.push(chunkJson)
        setProgress(spanStart + span)
        if (chunkJson.cancelled) { cancelledByServer = true; break }
      }
      // 服务端因取消令牌停下：按“用户取消”处理，保留已完成批的结果
      if (cancelledByServer) throw new DOMException('cancelled', 'AbortError')

      // 合并多批结果（同批/跨批的同栏多图取识别数最多者）
      const merged = mergeChunkResults(chunkResults)
      batchFullLoading.value = true
      batchResults.value = {
        success: true,
        batch_name: chunkResults[0]?.batch_name || '未命名批次',
        units: merged.units,
        total_photos: merged.total_photos,
        total_pigs: merged.total_pigs
      }
      removeRecords(merged.superseded)
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
      store.dispatch('addLog', { msg: `批次检测完成: ${batchResults.value.total_pigs} 头猪（${totalChunks} 批）`, type: 'info' })
      loadBatchFullImages()
    } catch (e) {
      stopTick()

      if (e.name === 'AbortError') {
        // 用户主动取消/刷新：告知服务端停手，已完成部分仍然保留展示（用户自己中断）
        cancelOnServer(batchToken)
        if (chunkResults.length) {
          const merged = mergeChunkResults(chunkResults)
          batchFullLoading.value = true
          batchResults.value = {
            success: true,
            batch_name: chunkResults[0]?.batch_name || '未命名批次',
            units: merged.units,
            total_photos: merged.total_photos,
            total_pigs: merged.total_pigs
          }
          removeRecords(merged.superseded)
        } else if (prevBatchResults) {
          batchResults.value = prevBatchResults
          batchImageIndex.value = prevBatchImageIndex
        }
        closeNotify()
        const done = chunkResults.length
        const msg = done ? `已取消：完成 ${done}/${totalChunks} 批，结果仅含已完成部分` : '批量检测已取消'
        store.dispatch('addLog', { msg, type: 'info' })
        showNotify('info', '已取消', msg)
      } else {
        // 识别失败：清空结果、回滚本次已写入的记录，回到"已选文件夹、未识别"状态
        const writtenIds = collectRecordIds(chunkResults)
        batchResults.value = null
        batchImageIndex.value = 0
        batchFullLoading.value = false
        store.commit('SET_PROGRESS', 0)
        closeNotify()
        showNotify('error', '批量检测失败', '识别过程异常，请重新尝试')
        store.dispatch('addLog', { msg: '批次检测失败：' + e.message, type: 'error' })
        if (writtenIds.length) await removeRecords(writtenIds, '识别失败回滚')
      }
    } finally {
      stopTick()
      window.removeEventListener('pagehide', onPageHide)
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

  // 应用启动后补做上次未完成的回滚（后端恢复后才会成功）
  setTimeout(() => { flushPendingRollback() }, 3000)

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
