<template>
  <transition name="modal-fade">
    <div v-if="visible" class="image-preview-modal" @click="$emit('close')">
      <div class="preview-backdrop"></div>
      <div class="preview-container" @click.stop>
        <button class="preview-close" @click="$emit('close')" title="关闭">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div class="preview-content">
          <img :src="annotatedImage" class="preview-image" alt="识别结果大图" />
          <div class="preview-info">
            <span class="preview-badge">检测到 {{ pigCount }} 头猪</span>
            <span class="preview-badge">置信度 {{ confidencePct }}%</span>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
export default {
  name: 'ImagePreviewModal',
  props: {
    visible: { type: Boolean, default: false },
    annotatedImage: { type: String, default: null },
    pigCount: { type: Number, default: 0 },
    confidencePct: { type: Number, default: 0 }
  }
}
</script>

<style scoped>
.image-preview-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px
}

.preview-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px)
}

.preview-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2)
}

.preview-close {
  position: absolute;
  top: -40px;
  right: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s
}

.preview-close:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1)
}

.preview-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px
}

.preview-image {
  max-width: 100%;
  max-height: calc(90vh - 80px);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5)
}

.preview-info {
  display: flex;
  gap: 12px
}

.preview-badge {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  backdrop-filter: blur(4px)
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0
}

.modal-fade-enter-active .preview-container,
.modal-fade-leave-active .preview-container {
  transition: transform 0.3s ease
}

.modal-fade-enter-from .preview-container,
.modal-fade-leave-to .preview-container {
  transform: scale(0.9)
}
</style>
