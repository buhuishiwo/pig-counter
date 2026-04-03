<template>
  <div
    class="upload-zone"
    :class="{ 'drag-over': isDragging, 'has-image': hasImage }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
    @click="triggerInput"
  >
    <!-- 图片预览 -->
    <div v-if="hasImage" class="preview-wrap">
      <img :src="previewUrl" class="preview-img" alt="预览图" />
      <div class="preview-overlay">
        <div class="preview-meta" v-if="imageMeta">
          <span class="meta-tag">{{ imageMeta.name }}</span>
          <span class="meta-tag">{{ imageMeta.width }}×{{ imageMeta.height }}</span>
          <span class="meta-tag">{{ imageMeta.size }}</span>
        </div>
      </div>
    </div>

    <!-- 占位内容 -->
    <div v-else class="placeholder">
      <div class="pig-float">🐷</div>
      <p class="placeholder-title">拖拽图片至此 / 点击上传</p>
      <p class="placeholder-sub">支持 JPG · PNG · WEBP · BMP &nbsp;|&nbsp; 最大 10MB</p>
      <div class="placeholder-hint">
        <span class="hint-icon">📷</span>
        建议使用正面或俯视拍摄的清晰图片
      </div>
    </div>

    <!-- 拖拽高亮提示 -->
    <div v-if="isDragging" class="drag-mask">
      <span>松开以上传 🐽</span>
    </div>

    <!-- 隐藏 input -->
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/bmp"
      style="display:none"
      @change="onInputChange"
    />
  </div>
</template>

<script>
import { validateImage, fileToDataURL, getImageDimensions, formatFileSize } from '@/utils/imageUtils'

export default {
  name: 'UploadZone',
  data() {
    return {
      isDragging: false
    }
  },
  computed: {
    hasImage()   { return this.$store.getters.hasImage },
    previewUrl() { return this.$store.state.previewUrl },
    imageMeta()  { return this.$store.state.imageMeta }
  },
  methods: {
    triggerInput() {
      // 有图片时不触发文件选择（让用户点击按钮操作）
      if (!this.hasImage) this.$refs.fileInput.click()
    },
    onDragOver()  { this.isDragging = true  },
    onDragLeave() { this.isDragging = false },
    onDrop(e) {
      this.isDragging = false
      const file = e.dataTransfer.files[0]
      if (file) this.processFile(file)
    },
    onInputChange(e) {
      const file = e.target.files[0]
      if (file) this.processFile(file)
      this.$refs.fileInput.value = ''
    },
    async processFile(file) {
      const { valid, error } = validateImage(file)
      if (!valid) {
        this.$store.commit('ADD_LOG', { msg: error, type: 'error' })
        this.$emit('error', error)
        return
      }

      try {
        const dataURL    = await fileToDataURL(file)
        const dimensions = await getImageDimensions(dataURL)
        const meta = {
          name:   file.name,
          size:   formatFileSize(file.size),
          width:  dimensions.width,
          height: dimensions.height
        }
        this.$store.commit('SET_IMAGE', { file, previewUrl: dataURL, meta })
        this.$store.commit('ADD_LOG', {
          msg:  `已加载：${file.name}（${meta.size}，${meta.width}×${meta.height}）`,
          type: 'info'
        })
        this.$emit('loaded', { file, meta })
      } catch (err) {
        this.$store.commit('ADD_LOG', { msg: `图片加载失败：${err.message}`, type: 'error' })
      }
    }
  }
}
</script>

<style scoped>
.upload-zone {
  width: 100%;
  aspect-ratio: 4 / 3;
  border: 2px dashed var(--border);
  border-radius: 12px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  background: var(--surface);
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-zone:hover:not(.has-image) {
  border-color: var(--pig-pink);
  background: rgba(242, 167, 176, 0.04);
}

.upload-zone.drag-over {
  border-color: var(--accent);
  background: rgba(232, 200, 74, 0.06);
  box-shadow: 0 0 0 4px rgba(232, 200, 74, 0.1);
}

.upload-zone.has-image {
  border-style: solid;
  border-color: var(--border);
  cursor: default;
}

/* Preview */
.preview-wrap {
  width: 100%;
  height: 100%;
  position: relative;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.preview-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 10px;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  opacity: 0;
  transition: opacity 0.2s;
}

.preview-wrap:hover .preview-overlay { opacity: 1; }

.preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.meta-tag {
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(4px);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 10px;
  color: rgba(255,255,255,0.85);
  font-family: 'Space Mono', monospace;
  letter-spacing: 0.04em;
}

/* Placeholder */
.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px;
  text-align: center;
}

.pig-float {
  font-size: 56px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(-3deg); }
  50%       { transform: translateY(-10px) rotate(3deg); }
}

.placeholder-title {
  font-size: 15px;
  color: var(--text);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.placeholder-sub {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.placeholder-hint {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted);
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 12px;
}

.hint-icon { font-size: 14px; }

/* Drag mask */
.drag-mask {
  position: absolute;
  inset: 0;
  background: rgba(232, 200, 74, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.05em;
  backdrop-filter: blur(2px);
}
</style>
