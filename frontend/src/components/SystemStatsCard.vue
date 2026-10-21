<template>
  <div class="system-stats-card glass-card">
    <div class="system-stats-header">
      <BarChart3 :size="18" class="system-stats-icon" />
      <span class="system-stats-title">系统统计</span>
    </div>
    <div class="system-stats-grid">
      <div class="system-stat-item">
        <span class="system-stat-value">{{ stats.total_images || 0 }}</span>
        <span class="system-stat-label">识别图片总数</span>
      </div>
      <div class="system-stat-item">
        <span class="system-stat-value">{{ stats.total_pigs || 0 }}</span>
        <span class="system-stat-label">识别猪只总数</span>
      </div>
      <div class="system-stat-item">
        <span class="system-stat-value">{{ stats.today_images || 0 }}</span>
        <span class="system-stat-label">今日识别图片</span>
      </div>
      <div class="system-stat-item">
        <span class="system-stat-value">{{ stats.today_pigs || 0 }}</span>
        <span class="system-stat-label">今日识别猪只</span>
      </div>
    </div>
  </div>
</template>

<script>
import { BarChart3 } from '@lucide/vue'

export default {
  name: 'SystemStatsCard',
  components: { BarChart3 },
  props: {
    stats: {
      type: Object,
      default: () => ({
        total_images: 0,
        total_pigs: 0,
        today_images: 0,
        today_pigs: 0,
        avg_processing_time_ms: 0
      })
    }
  }
}
</script>

<style scoped>
.system-stats-card {
  padding: 20px 24px;
  width: 100%;
  display: flex;
  flex-direction: column;
  animation: sectionIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
}

@keyframes sectionIn {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: none; }
}

.system-stats-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px
}

.system-stats-icon {
  color: var(--text-3)
}

.system-stats-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2)
}

.system-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  flex: 1;
  align-content: center
}

.system-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.04)
}

.system-stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  margin-bottom: 4px
}

.system-stat-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3)
}

@media (max-width: 768px) {
  .system-stats-grid {
    grid-template-columns: repeat(2, 1fr)
  }
}
</style>
