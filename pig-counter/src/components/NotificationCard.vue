<template>
  <transition name="notify-slide">
    <div v-if="visible" class="notify-card" :class="'notify-' + type">
      <div class="notify-icon">
        <svg v-if="type === 'success'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <svg v-else-if="type === 'error'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <svg v-else-if="type === 'warning'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      </div>
      <div class="notify-body">
        <div class="notify-title">{{ title }}</div>
        <div v-if="description" class="notify-desc">{{ description }}</div>
      </div>
      <button class="notify-close" @click="$emit('close')">&times;</button>
      <div class="notify-progress"></div>
    </div>
  </transition>
</template>

<script>
export default {
  name: 'NotificationCard',
  props: {
    visible: { type: Boolean, default: false },
    type: { type: String, default: 'info', validator: v => ['success', 'info', 'warning', 'error'].includes(v) },
    title: { type: String, default: '' },
    description: { type: String, default: '' }
  }
}
</script>

<style scoped>
.notify-card {
  position: fixed; top: 75px; right: 24px; z-index: 2000;
  display: flex; align-items: flex-start; gap: 12px;
  width: 300px; padding: 14px;
  border-radius: 8px; background: #fff;
  box-shadow: 0 6px 16px rgba(0,0,0,0.12), 0 3px 6px rgba(0,0,0,0.08);
  border: 1px solid rgba(0,0,0,0.06);
  overflow: hidden;
}
.notify-icon { flex-shrink: 0; margin-top: 2px; }
.notify-success .notify-icon { color: var(--green, #52c41a); }
.notify-info .notify-icon { color: var(--blue, #1677ff); }
.notify-warning .notify-icon { color: var(--orange, #faad14); }
.notify-error .notify-icon { color: var(--red, #ff4d4f); }
.notify-body { flex: 1; min-width: 0; }
.notify-title { font-size: 14px; font-weight: 600; color: rgba(0,0,0,0.88); line-height: 1.4; margin-bottom: 2px; }
.notify-desc { font-size: 13px; color: rgba(0,0,0,0.45); line-height: 1.5; }
.notify-close { position: absolute; top: 12px; right: 12px; background: none; border: none; cursor: pointer; font-size: 16px; color: rgba(0,0,0,0.3); padding: 0; line-height: 1; }
.notify-close:hover { color: rgba(0,0,0,0.6); }
.notify-progress { position: absolute; bottom: 0; left: 0; height: 3px; background: var(--blue, #1677ff); animation: notifyCountdown 3s linear forwards; }
.notify-success .notify-progress { background: var(--green, #52c41a); }
.notify-warning .notify-progress { background: var(--orange, #faad14); }
.notify-error .notify-progress { background: var(--red, #ff4d4f); }
@keyframes notifyCountdown { from { width: 100%; } to { width: 0%; } }
.notify-slide-enter-active { animation: notifySlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.notify-slide-leave-active { animation: notifySlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) reverse; }
@keyframes notifySlideIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
@media (max-width: 768px) { .notify-card { right: 12px; left: 12px; width: auto; } }
</style>
