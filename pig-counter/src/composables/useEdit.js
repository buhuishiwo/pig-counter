import { ref } from 'vue'
import { useStore } from 'vuex'

export function useEdit({ showNotify, activeResult, batchResults, selectedBatchImage, batchFiles, previewUrl, imageMeta }) {
  const store = useStore()

  const showEditModal = ref(false)
  const editImageUrl = ref(null)
  const editImgKey = ref(0)
  const editRecordId = ref(null)
  const editBoxes = ref([])
  const editSelectedIndex = ref(null)
  const editIsDrawing = ref(false)
  const editDrawStart = ref(null)
  const editDrawEnd = ref(null)
  const editDrawing = ref(false)
  const editHint = ref('select')
  const editDraggingCorner = ref(null)
  const editMode = ref('add')

  function openEditModal() {
    let boxes, recordId, imageUrl
    if (batchResults?.value && selectedBatchImage?.value) {
      boxes = selectedBatchImage.value.boxes || []
      recordId = selectedBatchImage.value.record_id || null
      const matchFile = batchFiles?.value?.find(f => f.name === selectedBatchImage.value.pen_name)
      imageUrl = matchFile ? URL.createObjectURL(matchFile) : selectedBatchImage.value.url
    } else if (store.state.result) {
      boxes = store.state.result.boxes || []
      recordId = store.state.result.recordId || null
      imageUrl = previewUrl?.value
    } else {
      return
    }
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

  function drawEditCanvas(canvasRef, imgRef) {
    const canvas = canvasRef
    const img = imgRef
    if (!canvas || !img || !img.naturalWidth) return
    const imgW = imageMeta?.value?.width || selectedBatchImage?.value?.image_width || img.naturalWidth
    const imgH = imageMeta?.value?.height || selectedBatchImage?.value?.image_height || img.naturalHeight
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

  function getEditCanvasCoords(e, canvasRef, imgRef) {
    const canvas = canvasRef
    const img = imgRef
    if (!canvas || !img || !canvas.width) return null
    const rect = canvas.getBoundingClientRect()
    const canvasX = (e.clientX - rect.left) / rect.width * canvas.width
    const canvasY = (e.clientY - rect.top) / rect.height * canvas.height
    const imgW = imageMeta?.value?.width || selectedBatchImage?.value?.image_width || img.naturalWidth
    const imgH = imageMeta?.value?.height || selectedBatchImage?.value?.image_height || img.naturalHeight
    return {
      cx: canvasX, cy: canvasY,
      imgX: canvasX / canvas.width * imgW,
      imgY: canvasY / canvas.height * imgH,
      scaleX: canvas.width / imgW,
      scaleY: canvas.height / imgH
    }
  }

  function onEditCanvasMouseDown(e, canvasRef, imgRef) {
    if (editMode.value !== 'add') return
    const c = getEditCanvasCoords(e, canvasRef, imgRef)
    if (!c) return
    editDrawing.value = true
    editDrawStart.value = { x: c.imgX, y: c.imgY }
    editDrawEnd.value = { x: c.imgX, y: c.imgY }
  }

  function onEditCanvasMouseMove(e, canvasRef, imgRef) {
    if (!editDrawing.value) return
    const c = getEditCanvasCoords(e, canvasRef, imgRef)
    if (!c) return
    editDrawEnd.value = { x: c.imgX, y: c.imgY }
    drawEditCanvas(canvasRef, imgRef)
    const canvas = canvasRef
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const sx = editDrawStart.value.x * c.scaleX, sy = editDrawStart.value.y * c.scaleY
    const ex = editDrawEnd.value.x * c.scaleX, ey = editDrawEnd.value.y * c.scaleY
    ctx.strokeStyle = 'rgba(0, 122, 255, 0.7)'; ctx.lineWidth = 2; ctx.setLineDash([6, 3])
    ctx.strokeRect(Math.min(sx, ex), Math.min(sy, ey), Math.abs(ex - sx), Math.abs(ey - sy))
    ctx.setLineDash([])
  }

  function onEditCanvasMouseUp(e, canvasRef, imgRef) {
    if (!editDrawing.value) return
    editDrawing.value = false
    const s = editDrawStart.value, en = editDrawEnd.value
    if (!s || !en) return
    const x1 = Math.min(s.x, en.x), y1 = Math.min(s.y, en.y)
    const x2 = Math.max(s.x, en.x), y2 = Math.max(s.y, en.y)
    if (Math.abs(x2 - x1) < 10 || Math.abs(y2 - y1) < 10) return
    editBoxes.value.push({ x1, y1, x2, y2, score: 1.0, class_name: 'pig' })
    editSelectedIndex.value = editBoxes.value.length - 1
    drawEditCanvas(canvasRef, imgRef)
    store.commit('ADD_LOG', { msg: `已添加新识别框 #${editBoxes.value.length}`, type: 'info' })
  }

  function onEditCanvasClick(e, canvasRef, imgRef) {
    if (editMode.value !== 'delete') return
    const c = getEditCanvasCoords(e, canvasRef, imgRef)
    if (!c) return
    const { cx, cy, scaleX, scaleY } = c
    let clicked = null
    for (let i = editBoxes.value.length - 1; i >= 0; i--) {
      const box = editBoxes.value[i]
      const x1 = box.x1 * scaleX, y1 = box.y1 * scaleY
      const x2 = box.x2 * scaleX, y2 = box.y2 * scaleY
      if (cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) { clicked = i; break }
    }
    if (clicked !== null) {
      editBoxes.value.splice(clicked, 1)
      editSelectedIndex.value = null
      drawEditCanvas(canvasRef, imgRef)
      store.commit('ADD_LOG', { msg: '已删除识别框', type: 'info' })
    }
  }

  function addBoxInModal() {
    editBoxes.value.push({ x1: 100, y1: 100, x2: 200, y2: 200, score: 1.0, class_name: 'pig' })
    editSelectedIndex.value = editBoxes.value.length - 1
    store.commit('ADD_LOG', { msg: '已添加新识别框', type: 'info' })
  }

  function deleteBoxInModal() {
    if (editSelectedIndex.value === null) return
    editBoxes.value.splice(editSelectedIndex.value, 1)
    editSelectedIndex.value = null
    store.commit('ADD_LOG', { msg: '已删除识别框', type: 'info' })
  }

  async function saveBoxesToDb({ resultCardRef, nextTick }) {
    // 在 API 调用前保存原始快照（避免 batchResults 更新后 activeResult 变化导致误判）
    const originalBoxes = JSON.parse(JSON.stringify(activeResult?.value?.boxes || []))
    const currentBoxes = JSON.parse(JSON.stringify(editBoxes.value))
    if (JSON.stringify(originalBoxes) === currentBoxes) {
      showNotify('success', '保存成功', `已更新 ${editBoxes.value.length} 个识别框`)
      closeEditModal()
      return
    }
    if (!editRecordId.value) {
      try {
        const statsRes = await (await import('@/api/detectionApi')).getDetectionRecords({ page: 1, page_size: 1 })
        if (statsRes?.data?.length > 0) editRecordId.value = statsRes.data[0].id
      } catch (_) {}
    }
    if (!editRecordId.value) {
      store.commit('ADD_LOG', { msg: '保存失败：无 recordId，请先重新识别', type: 'error' })
      showNotify('error', '保存失败', '无 recordId，请先重新识别')
      return
    }
    try {
      const { updateDetectionRecord } = await import('@/api/detectionApi')
      let imageForApi = editImageUrl.value
      if (imageForApi && imageForApi.startsWith('blob:')) {
        const resp = await fetch(imageForApi)
        const blob = await resp.blob()
        imageForApi = await new Promise(resolve => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.readAsDataURL(blob)
        })
      }
      const res = await updateDetectionRecord(editRecordId.value, {
        boxes: editBoxes.value,
        original_image: previewUrl?.value || imageForApi,
        predicted_count: editBoxes.value.length
      })
      if (batchResults?.value && selectedBatchImage?.value) {
        for (const unit of batchResults.value.units) {
          for (const pen of unit.pens) {
            const match = selectedBatchImage.value.record_id
              ? pen.record_id === selectedBatchImage.value.record_id
              : (pen.pen_name === selectedBatchImage.value.pen_name && unit.unit_name === selectedBatchImage.value.unit_name)
            if (match) {
              pen.boxes = JSON.parse(JSON.stringify(editBoxes.value))
              pen.pig_count = editBoxes.value.length
              if (res.annotated_image) pen.annotated_image = res.annotated_image
              break
            }
          }
        }
        let totalPigs = 0
        for (const unit of batchResults.value.units) {
          let unitTotal = 0
          for (const pen of unit.pens) unitTotal += pen.pig_count || 0
          unit.subtotal = unitTotal
          totalPigs += unitTotal
        }
        batchResults.value.total_pigs = totalPigs
        batchResults.value = { ...batchResults.value }
      } else if (store.state.result) {
        store.state.result.boxes = JSON.parse(JSON.stringify(editBoxes.value))
        store.state.result.count = editBoxes.value.length
        const idx = store.state.currentImageIndex
        if (store.state.results[idx]) store.state.results[idx].count = editBoxes.value.length
        if (res.annotated_image) store.commit('SET_RESULT', { ...store.state.result, annotatedImage: res.annotated_image })
      }
      store.commit('ADD_LOG', { msg: `已保存 ${editBoxes.value.length} 个识别框到数据库`, type: 'success' })
      showNotify('success', '保存成功', `已更新 ${editBoxes.value.length} 个识别框`)
      const boxesSnapshot = JSON.parse(JSON.stringify(editBoxes.value))
      closeEditModal()
      if (nextTick && resultCardRef) {
        nextTick(() => {
          nextTick(() => {
            if (resultCardRef) resultCardRef.drawBoxesAnimated(boxesSnapshot)
          })
        })
      }
    } catch (e) {
      store.commit('ADD_LOG', { msg: '保存失败：' + e.message, type: 'error' })
      showNotify('error', '保存失败', e.message)
    }
  }

  function exportAnnotatedImage() {
    const src = (batchResults?.value && selectedBatchImage?.value ? selectedBatchImage.value.url : null) || store.state.result?.annotatedImage || activeResult?.value?.imageUrl
    if (!src) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const exportCanvas = document.createElement('canvas')
      exportCanvas.width = img.naturalWidth
      exportCanvas.height = img.naturalHeight
      const ctx = exportCanvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const link = document.createElement('a')
      let baseName = '识别结果'
      if (imageMeta?.value?.name) {
        baseName = imageMeta.value.name.replace(/\.[^.]+$/, '')
      } else if (selectedBatchImage?.value) {
        const unit = selectedBatchImage.value.unit_name || ''
        const pen = (selectedBatchImage.value.pen_name || '').replace(/\.[^.]+$/, '')
        baseName = unit ? `${unit}_${pen}` : pen
      }
      link.download = `${baseName}_标注结果.png`
      link.href = exportCanvas.toDataURL('image/png')
      link.click()
      store.commit('ADD_LOG', { msg: '已导出标注图片', type: 'success' })
    }
    img.src = src
  }

  return {
    showEditModal,
    editImageUrl,
    editImgKey,
    editRecordId,
    editBoxes,
    editSelectedIndex,
    editIsDrawing,
    editDrawStart,
    editDrawEnd,
    editDrawing,
    editHint,
    editDraggingCorner,
    editMode,
    openEditModal,
    closeEditModal,
    drawEditCanvas,
    getEditCanvasCoords,
    onEditCanvasMouseDown,
    onEditCanvasMouseMove,
    onEditCanvasMouseUp,
    onEditCanvasClick,
    addBoxInModal,
    deleteBoxInModal,
    saveBoxesToDb,
    exportAnnotatedImage
  }
}
