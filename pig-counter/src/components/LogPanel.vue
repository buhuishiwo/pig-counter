<template>
  <div class="log-panel glass-card">
    <div class="log-header">
      <div class="log-header-left">
        <span class="log-dot"></span>
        <span class="log-title">系统日志</span>
      </div>
      <button class="log-clear" @click="clearLogs" title="清空">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="log-body">
      <div v-if="logs.length === 0" class="log-empty">等待操作…</div>
      <transition-group name="log-in" tag="div">
        <div v-for="log in logs" :key="log.id" class="log-line">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-pip" :class="log.type"></span>
          <span class="log-msg" :class="log.type">{{ log.msg }}</span>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LogPanel',
  computed: { logs() { return this.$store.getters.recentLogs } },
  methods: { clearLogs() { this.$store.commit('CLEAR_LOGS') } }
}
</script>

<style scoped>
.log-panel { overflow: hidden; }

.log-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 13px 18px; border-bottom: 1px solid rgba(60,60,67,0.1);
}
.log-header-left { display: flex; align-items: center; gap: 8px; }
.log-dot { width: 7px; height: 7px; border-radius: 50%; background: #d1d1d6; }
.log-title { font-size: 12px; font-weight: 600; color: #6e6e73; letter-spacing: 0.01em; }

.log-clear {
  background: none; border: none; cursor: pointer;
  color: #aeaeb2; padding: 3px; border-radius: 4px;
  transition: all 0.15s; display: flex; align-items: center; justify-content: center;
}
.log-clear:hover { color: #ff3b30; background: rgba(255,59,48,0.08); }

.log-body {
  padding: 10px 16px; max-height: 160px; overflow-y: auto;
  scrollbar-width: thin; scrollbar-color: #d1d1d6 transparent;
}
.log-body::-webkit-scrollbar { width: 3px; }
.log-body::-webkit-scrollbar-thumb { background: #d1d1d6; border-radius: 2px; }

.log-empty { font-size: 11px; color: #aeaeb2; padding: 6px 0; }

.log-line { display: flex; align-items: flex-start; gap: 8px; padding: 3px 0; font-size: 11px; }

.log-time { color: #c7c7cc; flex-shrink: 0; font-size: 10px; margin-top: 1px; font-variant-numeric: tabular-nums; font-family: 'SF Mono', monospace; }

.log-pip { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; margin-top: 3px; }
.log-pip.info    { background: #007aff; }
.log-pip.success { background: #34c759; }
.log-pip.error   { background: #ff3b30; }
.log-pip.warn    { background: #ff9500; }

.log-msg { line-height: 1.5; color: #6e6e73; }
.log-msg.success { color: #34c759; }
.log-msg.error   { color: #ff3b30; }
.log-msg.warn    { color: #ff9500; }

.log-in-enter-active { transition: all 0.25s ease; }
.log-in-enter { opacity: 0; transform: translateY(-6px); }
</style>
