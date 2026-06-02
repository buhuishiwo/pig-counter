<template>
  <div class="stat-row">
    <div v-for="(card, i) in cards" :key="i" class="stat-card glass-card"
      :class="{ 'stat-card--active': card.active }" :style="{ '--delay': (i * 60) + 'ms' }">
      <div class="stat-card-shimmer"></div>
      <div class="stat-icon-wrap"><component :is="card.icon" :size="22" class="stat-icon" /></div>
      <div class="stat-body">
        <div class="stat-val">
          <span v-if="card.value !== null" class="stat-num" :class="card.cls">{{ card.animated ? animatedCount :
            card.value }}</span>
          <span v-else class="stat-num stat-empty">—</span>
          <span v-if="card.unit" class="stat-unit">{{ card.unit }}</span>
        </div>
        <div class="stat-label">{{ card.label }}</div>
      </div>
      <div class="stat-card-border"></div>
    </div>
  </div>
</template>

<script>
import { PiggyBank, Zap, Target, Sparkles, Camera, Folder } from '@lucide/vue'

export default {
  name: 'StatCardsRow',
  components: { PiggyBank, Zap, Target, Sparkles, Camera, Folder },
  props: {
    cards: { type: Array, default: () => [] },
    animatedCount: { type: Number, default: 0 }
  }
}
</script>

<style scoped>
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  animation: rowReveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) both
}

@media(max-width:900px) {
  .stat-row {
    grid-template-columns: repeat(2, 1fr)
  }
}

@keyframes rowReveal {
  from { opacity: 0; transform: translateY(12px) }
  to { opacity: 1; transform: none }
}

.stat-card {
  padding: 20px 22px;
  cursor: default;
  animation: cardReveal 0.3s cubic-bezier(0.16, 1, 0.3, 1) calc(0.3s + var(--delay, 0ms)) both
}

@keyframes cardReveal {
  from { opacity: 0; transform: translateY(16px) scale(0.97) }
  to { opacity: 1; transform: none }
}

.stat-card-shimmer {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, transparent 60%);
  opacity: 0;
  transition: opacity 0.3s
}

.stat-card:hover .stat-card-shimmer {
  opacity: 1
}

.stat-card-border {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  border: 1px solid transparent;
  transition: border-color 0.3s
}

.stat-icon-wrap {
  margin-bottom: 12px
}

.stat-icon {
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.08));
  color: var(--text-2)
}

.stat-body {
  display: flex;
  flex-direction: column;
  gap: 4px
}

.stat-val {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 42px
}

.stat-num {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -1.5px;
  line-height: 1;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  transition: color 0.4s ease
}

.stat-num.stat-empty {
  color: var(--text-4);
  font-size: 28px
}

.stat-num.stat-sm {
  font-size: 21px;
  letter-spacing: -0.5px
}

.stat-num.conf-high {
  color: var(--green)
}

.stat-num.conf-mid {
  color: var(--orange)
}

.stat-num.conf-low {
  color: var(--red)
}

.stat-num.stat-blue {
  color: var(--blue)
}

.stat-unit {
  font-size: 14px;
  color: var(--text-3);
  font-weight: 500
}

.stat-label {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 500
}

/* 当次识别总数卡片 */
.stat-card--total {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.stat-card--total .stat-icon {
  font-size: 24px;
}

.stat-card--total .stat-num {
  font-size: 34px;
  font-weight: 700;
  color: var(--green);
}

.stat-card--total .stat-card-border {
  border-color: rgba(52, 199, 89, 0.2);
}

.stat-card--active .stat-card-border {
  border-color: rgba(0, 122, 255, 0.12)
}
</style>
