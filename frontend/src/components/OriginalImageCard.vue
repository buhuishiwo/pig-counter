<template>
  <div class="img-card glass-card" :class="{ floating: hasImage }">
    <div class="img-card-header">
      <div class="img-card-header-left">
        <span class="traffic-dot dot-yellow"></span>
        <span class="img-card-title">原图</span>
        <a-popover trigger="hover" placement="bottomLeft" overlay-class-name="photo-guide-popover" class="photo-guide-popover-wrap">
          <template #content>
            <div class="photo-guide">
              <div class="photo-guide-title">拍照规范</div>
              <div class="photo-guide-sub">请按以下方式拍摄，确保识别准确</div>
              <div class="photo-guide-list">
                <div class="photo-guide-item">
                  <img src="/guide-landscape.png" class="photo-guide-img" alt="横屏示例" />
                  <div class="photo-guide-label">横屏</div>
                </div>
                <div class="photo-guide-item">
                  <img src="/guide-portrait.jpg" class="photo-guide-img" alt="竖屏示例" />
                  <div class="photo-guide-label">竖屏</div>
                </div>
              </div>
            </div>
          </template>
          <span class="photo-guide-trigger">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
            </svg>
          </span>
        </a-popover>
      </div>
      <div class="img-card-header-right">
        <transition name="meta-slide">
          <span class="img-card-chip" v-if="imageMeta">{{ imageMeta.name }}</span>
        </transition>
        <transition name="meta-slide">
          <span class="img-card-chip" v-if="imageMeta">{{ imageMeta.size }}</span>
        </transition>
        <transition name="meta-slide">
          <span class="img-card-chip" v-if="imageMeta">{{ imageMeta.width }} × {{ imageMeta.height }} px</span>
        </transition>
        <transition name="meta-slide">
          <span v-if="imageCount > 1" class="img-card-count">
            {{ currentImageIndex + 1 }}/{{ imageCount }}
          </span>
        </transition>
      </div>
    </div>
    <div class="img-card-body">
      <div class="dropzone" :class="{ 'dropzone--filled': hasImage, 'dropzone--drag': isDragging, 'dropzone--disabled': !farmSelected }"
        @dragover.prevent="isDragging = true" @dragleave="isDragging = false" @drop.prevent="onDrop"
        @click="handleClick">
        <div class="dz-border-anim"></div>
        <transition name="img-fade">
          <img v-if="hasImage" :src="previewUrl" class="img-preview" alt="原图" key="img" />
          <div v-else class="dropzone-placeholder" key="ph">
            <p class="dz-title">拖拽或点击上传猪群图片</p>
            <p class="dz-sub">支持拖拽/点选图片或拖拽文件夹 · JPG · PNG · WEBP · BMP</p>
          </div>
        </transition>
        <transition name="drag-fade">
          <div v-if="isDragging" class="drag-overlay">
            <div class="drag-ring"></div>
            <span>松开以上传</span>
          </div>
        </transition>
        <input ref="dropInput" type="file" accept="image/*" multiple
          style="display:none" @change="onInputChange" />
        <input ref="folderInput" type="file" webkitdirectory directory multiple
          style="display:none" @change="onFolderInputChange" />
      </div>
    </div>
    <div v-if="imageCount > 1" class="img-navigation">
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
import { PiggyBank } from '@lucide/vue'
import { Popover } from 'ant-design-vue'
import 'ant-design-vue/es/popover/style'

export default {
  name: 'OriginalImageCard',
  components: { PiggyBank, APopover: Popover },
  props: {
    hasImage: { type: Boolean, default: false },
    previewUrl: { type: String, default: '' },
    imageMeta: { type: Object, default: null },
    imageCount: { type: Number, default: 0 },
    currentImageIndex: { type: Number, default: 0 },
    farmSelected: { type: Boolean, default: false }
  },
  data() {
    return { isDragging: false }
  },
  methods: {
    handleClick() {
      if (!this.farmSelected) { this.$emit('need-farm'); return }
      if (this.hasImage) { this.$emit('open-preview'); return }
      this.$refs.dropInput.click()
    },
    onInputChange(e) {
      const files = Array.from(e.target.files)
      if (!files.length) { e.target.value = ''; return }
      const images = files.filter(f => f.type.startsWith('image/'))
      if (images.length > 0) this.$emit('files-selected', images)
      e.target.value = ''
    },
    onFolderInputChange(e) {
      const files = Array.from(e.target.files)
      if (!files.length) { e.target.value = ''; return }
      this.$emit('batch-folder-selected', files)
      e.target.value = ''
    },
    async onDrop(e) {
      this.isDragging = false
      const items = e.dataTransfer.items
      if (items) {
        for (const item of items) {
          const entry = item.webkitGetAsEntry?.() || item.getAsEntry?.()
          if (entry && entry.isDirectory) {
            const filesWithPaths = await this.readDirectory(entry, entry.name)
            const images = filesWithPaths.filter(fp => fp.file.type.startsWith('image/'))
            if (images.length > 0) this.$emit('batch-folder-selected', images)
            return
          }
        }
      }
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
      if (files.length > 0) this.$emit('files-selected', files)
    },
    readDirectory(entry, basePath) {
      return new Promise(resolve => {
        const reader = entry.createReader()
        const allFiles = []
        const readBatch = () => {
          reader.readEntries(async entries => {
            if (!entries.length) { resolve(allFiles); return }
            for (const ent of entries) {
              if (ent.isFile) {
                const file = await new Promise(r => ent.file(r))
                allFiles.push({ file, path: basePath + '/' + ent.name })
              } else if (ent.isDirectory) {
                const sub = await this.readDirectory(ent, basePath + '/' + ent.name)
                allFiles.push(...sub)
              }
            }
            readBatch()
          })
        }
        readBatch()
      })
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
  gap: 8px
}

.img-card-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  min-width: 0
}

.traffic-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0
}

.dot-yellow { background: #ffbd44 }

.img-card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2)
}

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

.dropzone {
  width: 100%;
  flex: 1;
  min-height: 0;
  border-radius: var(--r-md);
  position: relative;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.02);
  border: 1.5px dashed var(--sep-opaque);
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: center
}

.dropzone:hover:not(.dropzone--filled) {
  border-color: var(--blue);
  background: rgba(0, 122, 255, 0.025)
}

.dropzone--drag {
  border-color: var(--blue);
  background: rgba(0, 122, 255, 0.04);
  box-shadow: inset 0 0 0 2px rgba(0, 122, 255, 0.12)
}

.dropzone--filled {
  border-style: solid;
  border-color: var(--sep);
  cursor: pointer
}

.dropzone--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: auto
}

.dropzone--disabled:hover {
  border-color: var(--sep-opaque);
  background: rgba(0, 0, 0, 0.02)
}

.img-preview { width: 100%; height: 100%; object-fit: contain; display: block; position: absolute; top: 0; left: 0 }

.dropzone-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 28px;
  text-align: center;
  position: absolute;
  inset: 0
}

.dz-pig { color: var(--text-4) }

@keyframes iconBreath {
  0%, 100% { opacity: 0.15; transform: scale(0.95) }
  50% { opacity: 0.35; transform: scale(1.05) }
}

@keyframes pigFloat {
  0%, 100% { transform: translateY(0) rotate(-3deg) }
  50% { transform: translateY(-8px) rotate(3deg) }
}

.dz-title { font-size: 14px; font-weight: 600; color: var(--text-2) }
.dz-sub { font-size: 11px; color: var(--text-4) }

.dz-folder-link {
  font-size: 11px;
  color: var(--blue);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  opacity: 0.7;
  transition: opacity 0.2s
}

.dz-folder-link:hover { opacity: 1 }

.dz-border-anim {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  border: 1.5px dashed transparent;
  background: linear-gradient(var(--bg), var(--bg)) padding-box, linear-gradient(135deg, var(--blue), var(--pig), var(--blue)) border-box;
  opacity: 0;
  transition: opacity 0.3s
}

.dropzone:hover:not(.dropzone--filled) .dz-border-anim { opacity: 1 }

.drag-overlay {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: rgba(0, 122, 255, 0.07);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--blue)
}

.drag-ring {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 2px solid var(--blue);
  opacity: 0.5;
  animation: ringPulse 1s ease-in-out infinite
}

@keyframes ringPulse {
  0%, 100% { transform: scale(0.9); opacity: 0.3 }
  50% { transform: scale(1.1); opacity: 0.8 }
}

.img-meta-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 2px 0;
  font-size: 11px;
  color: var(--text-4)
}

.meta-sep { color: var(--sep-opaque) }

.floating {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06)
}

@keyframes sectionIn {
  from { opacity: 0 }
  to { opacity: 1 }
}

.photo-guide-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: #c7c7cc;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
  flex-shrink: 0;
  margin-left: -2px
}

.photo-guide-trigger:hover {
  color: var(--accent);
  background: rgba(0, 122, 255, 0.08)
}

.photo-guide-popover-wrap {
  margin-left: -8px;
  margin-top: 2px
}
</style>

<style>
.photo-guide-popover .ant-popover-inner { padding: 0 !important }
.photo-guide { padding: 16px 18px; width: 340px }
.photo-guide-title { font-size: 14px; font-weight: 600; color: #1d1d1f; margin-bottom: 4px }
.photo-guide-sub { font-size: 12px; color: #86868b; margin-bottom: 14px }
.photo-guide-list { display: flex; gap: 14px }
.photo-guide-item { flex: 1; text-align: center }
.photo-guide-img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #e5e5ea;
  background: #f5f5f7;
  margin-bottom: 8px;
  display: block
}
.photo-guide-item:last-child .photo-guide-img {
  aspect-ratio: 3 / 4;
  width: 56%;
  display: block;
  margin-left: auto;
  margin-right: auto
}
.photo-guide-label { font-size: 12px; color: #636366; font-weight: 500 }
</style>
