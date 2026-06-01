<template>
  <div class="service-pill" :class="serviceClass">
    <div class="service-dot"></div>
    <span>{{ serviceLabel }}</span>
    <button class="service-recheck" @click="checkServiceHealth" :disabled="checking">↺</button>
  </div>
</template>

<script>
import { checkHealth } from '@/api/pigModel'

export default {
  name: 'ServiceStatusPill',
  data() {
    return { checking: false }
  },
  computed: {
    serviceClass() {
      const s = this.$store.state.serviceOnline
      if (s === null) return 'service-unknown'
      return s ? 'service-online' : 'service-offline'
    },
    serviceLabel() {
      if (this.checking) return '检测中…'
      const s = this.$store.state.serviceOnline
      if (s === null) return '状态未知'
      return s ? '服务正常' : '离线 / Mock'
    }
  },
  created() {
    this.checkServiceHealth()
  },
  methods: {
    async checkServiceHealth() {
      if (this.checking) return
      this.checking = true
      try {
        const online = await checkHealth()
        this.$store.commit('SET_SERVICE_STATUS', online)
        this.$store.commit('ADD_LOG', {
          msg: online ? '服务在线' : '服务未响应（Mock 模式）',
          type: online ? 'success' : 'warn'
        })
        if (online) this.$emit('service-online')
      } catch {
        this.$store.commit('SET_SERVICE_STATUS', false)
      } finally {
        this.checking = false
      }
    }
  }
}
</script>

<style scoped>
.service-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--sep);
  background: rgba(255, 255, 255, 0.7);
  transition: all 0.3s ease
}

.service-online {
  border-color: rgba(52, 199, 89, 0.3);
  background: rgba(52, 199, 89, 0.08)
}

.service-offline {
  border-color: rgba(255, 59, 48, 0.3);
  background: rgba(255, 59, 48, 0.06)
}

.service-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-4)
}

.service-online .service-dot {
  background: var(--green);
  animation: dotPulse 2s infinite
}

.service-offline .service-dot {
  background: var(--red)
}

@keyframes dotPulse {
  0%, 100% { opacity: 1 }
  50% { opacity: 0.4 }
}

.service-pill span {
  color: var(--text-3)
}

.service-online span {
  color: var(--green)
}

.service-offline span {
  color: var(--red)
}

.service-recheck {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-4);
  padding: 0 2px;
  transition: transform 0.3s;
  line-height: 1
}

.service-recheck:hover {
  transform: rotate(180deg);
  color: var(--blue)
}

.service-recheck:disabled {
  opacity: 0.4;
  cursor: not-allowed
}
</style>
