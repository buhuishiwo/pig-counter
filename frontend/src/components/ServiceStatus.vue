<template>
  <div class="service-status" :class="statusClass">
    <span class="status-dot"></span>
    <span class="status-text">{{ statusText }}</span>
    <button class="btn-check" @click="$emit('check')" :disabled="checking">
      {{ checking ? '检测中' : '重检' }}
    </button>
  </div>
</template>

<script>
export default {
  name: 'ServiceStatus',
  props: {
    checking: { type: Boolean, default: false }
  },
  computed: {
    online()      { return this.$store.state.serviceOnline },
    statusClass() {
      if (this.online === null) return 'unknown'
      return this.online ? 'online' : 'offline'
    },
    statusText() {
      if (this.checking)     return '正在检测服务...'
      if (this.online === null) return '服务状态未知'
      return this.online ? '模型服务在线' : '服务离线 / 未配置'
    }
  }
}
</script>

<style scoped>
.service-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 11px;
  border: 1px solid var(--border);
  background: var(--surface);
  letter-spacing: 0.04em;
}

.service-status.online  { border-color: rgba(109,204,128,0.3); background: rgba(109,204,128,0.05); }
.service-status.offline { border-color: rgba(232,112,112,0.3); background: rgba(232,112,112,0.05); }

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--border);
  transition: background 0.3s;
}

.online  .status-dot { background: var(--success); box-shadow: 0 0 5px var(--success); animation: pulse 2s infinite; }
.offline .status-dot { background: #e87070; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}

.status-text { flex: 1; color: var(--text-muted); }
.online  .status-text { color: var(--success); }
.offline .status-text { color: #e87070; }

.btn-check {
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  padding: 2px 8px;
  cursor: pointer;
  transition: all 0.15s;
  letter-spacing: 0.04em;
}

.btn-check:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-check:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
