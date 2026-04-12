<template>
  <div class="stats-page">
    <!-- 背景装饰 -->
    <div class="stats-bg" aria-hidden="true">
      <div class="bg-orb bg-orb--1"></div>
      <div class="bg-orb bg-orb--2"></div>
      <div class="bg-grid"></div>
    </div>

    <!-- 页面标题 -->
    <div class="stats-header">
      <div class="stats-header-left">
        <div class="stats-title-icon">📊</div>
        <div>
          <h1 class="stats-title">数据统计中心</h1>
          <p class="stats-subtitle">各猪场识别数据汇总 · 结果回看</p>
        </div>
      </div>
      <div class="stats-header-right">
        <button class="refresh-btn" @click="loadAll" :disabled="loading">
          <svg :class="{ spinning: loading }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          <span>{{ loading ? '加载中…' : '刷新数据' }}</span>
        </button>
        <div class="last-update" v-if="lastUpdateTime">
          更新于 {{ lastUpdateTime }}
        </div>
      </div>
    </div>

    <!-- 全局汇总卡片 -->
    <div class="global-summary">
      <div class="summary-card summary-card--blue" v-for="(item, i) in globalSummaryCards" :key="i" :style="{ '--d': i * 80 + 'ms' }">
        <div class="summary-card-icon">{{ item.icon }}</div>
        <div class="summary-card-body">
          <div class="summary-card-val">{{ item.value }}</div>
          <div class="summary-card-label">{{ item.label }}</div>
        </div>
        <div class="summary-card-shine"></div>
      </div>
    </div>

    <!-- 时间序列图表 -->
    <div class="section-card glass-card">
      <div class="section-header">
        <div class="section-header-left">
          <span class="section-dot section-dot--green"></span>
          <span class="section-title">数据趋势分析</span>
        </div>
        <div class="section-header-right">
          <div class="granularity-selector">
            <button 
              class="granularity-btn" 
              :class="{ 'granularity-btn--active': timeSeriesGranularity === 'day' }"
              @click="changeTimeSeriesGranularity('day')"
            >
              按日
            </button>
            <button 
              class="granularity-btn" 
              :class="{ 'granularity-btn--active': timeSeriesGranularity === 'month' }"
              @click="changeTimeSeriesGranularity('month')"
            >
              按月
            </button>
          </div>
        </div>
      </div>

      <div v-if="timeSeriesLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载趋势数据…</span>
      </div>

      <div v-else-if="timeSeriesData.length === 0" class="empty-state">
        <div class="empty-icon">📈</div>
        <p>暂无趋势数据，请先进行图片识别</p>
      </div>

      <div v-else class="chart-container">
        <canvas ref="timeSeriesChartRef" id="timeSeriesChart"></canvas>
      </div>
    </div>

    <!-- 猪场统计表格 -->
    <div class="section-card glass-card">
      <div class="section-header">
        <div class="section-header-left">
          <span class="section-dot"></span>
          <span class="section-title">各猪场识别统计</span>
          <span class="section-badge">{{ farmStats.length }} 个猪场</span>
        </div>
      </div>

      <div v-if="farmStatsLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载统计数据…</span>
      </div>

      <div v-else-if="farmStats.length === 0" class="empty-state">
        <div class="empty-icon">🐷</div>
        <p>暂无统计数据，请先进行图片识别</p>
      </div>

      <div v-else class="farm-stats-table-wrap">
        <table class="farm-stats-table">
          <thead>
            <tr>
              <th>猪场名称</th>
              <th>图片总量</th>
              <th>猪只总量</th>
              <th>今日图片</th>
              <th>今日猪只</th>
              <th>平均耗时</th>
              <th>最近识别</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(farm, i) in farmStats"
              :key="farm.farm_id || 'null'"
              class="farm-stats-row"
              :style="{ '--ri': i }"
              :class="{ 'farm-stats-row--active': selectedFarmId === farm.farm_id }"
            >
              <td>
                <div class="farm-name-cell">
                  <span class="farm-icon-sm">🏭</span>
                  <span class="farm-name-text">{{ farm.farm_name || '未分配猪场' }}</span>
                </div>
              </td>
              <td>
                <div class="num-cell">
                  <span class="num-val">{{ farm.total_images }}</span>
                  <span class="num-unit">张</span>
                </div>
              </td>
              <td>
                <div class="num-cell num-cell--highlight">
                  <span class="num-val">{{ farm.total_pigs }}</span>
                  <span class="num-unit">头</span>
                </div>
              </td>
              <td>
                <div class="num-cell">
                  <span class="num-val today-val">{{ farm.today_images }}</span>
                  <span class="num-unit">张</span>
                </div>
              </td>
              <td>
                <div class="num-cell">
                  <span class="num-val today-val">{{ farm.today_pigs }}</span>
                  <span class="num-unit">头</span>
                </div>
              </td>
              <td>
                <span class="time-chip">{{ farm.avg_processing_time_ms }} ms</span>
              </td>
              <td>
                <span class="date-text">{{ formatDate(farm.last_detection_at) }}</span>
              </td>
              <td>
                <button
                  class="view-btn"
                  @click="selectFarmForGallery(farm.farm_id)"
                  :class="{ 'view-btn--active': selectedFarmId === farm.farm_id }"
                >
                  {{ selectedFarmId === farm.farm_id ? '✓ 已选中' : '查看记录' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 识别记录回看区 -->
    <div class="section-card glass-card gallery-section">
      <div class="section-header">
        <div class="section-header-left">
          <span class="section-dot section-dot--green"></span>
          <span class="section-title">识别结果回看</span>
          <span class="section-badge" v-if="selectedFarmName">{{ selectedFarmName }}</span>
          <span class="section-badge section-badge--gray" v-else>全部猪场</span>
        </div>
        <div class="section-header-right">
          <button
            v-if="selectedFarmId !== null"
            class="clear-filter-btn"
            @click="clearFarmFilter"
          >
            × 清除筛选
          </button>
          <span class="total-badge" v-if="galleryTotal > 0">共 {{ galleryTotal }} 条记录</span>
        </div>
      </div>

      <div v-if="galleryLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载图片记录…</span>
      </div>

      <div v-else-if="gallery.length === 0" class="empty-state">
        <div class="empty-icon">🖼️</div>
        <p>{{ selectedFarmId !== null ? '该猪场暂无识别记录' : '暂无识别记录' }}</p>
      </div>

      <div v-else>
        <div class="gallery-grid">
          <div
            v-for="(record, i) in gallery"
            :key="record.id"
            class="gallery-card"
            :style="{ '--gi': i % 12 }"
            @click="openRecord(record)"
          >
            <div class="gallery-img-wrap">
              <img
                v-if="record.annotated_image"
                :src="record.annotated_image"
                :alt="record.image_name"
                class="gallery-img"
                loading="lazy"
              />
              <div v-else class="gallery-img-placeholder">
                <span>🐷</span>
              </div>
              <div class="gallery-overlay">
                <div class="gallery-overlay-icon">🔍</div>
                <span>点击查看</span>
              </div>
            </div>
            <div class="gallery-card-info">
              <div class="gallery-count">
                <span class="pig-badge">🐷 {{ record.predicted_count }} 头</span>
              </div>
              <div class="gallery-meta">
                <span class="gallery-farm" v-if="record.farm_name">{{ record.farm_name }}</span>
                <span class="gallery-date">{{ formatDateShort(record.created_at) }}</span>
              </div>
              <div class="gallery-filename" :title="record.image_name">{{ record.image_name }}</div>
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <div class="pagination" v-if="galleryTotalPages > 1">
          <button
            class="page-btn"
            :disabled="galleryPage === 1"
            @click="goToPage(1)"
          >«</button>
          <button
            class="page-btn"
            :disabled="galleryPage === 1"
            @click="goToPage(galleryPage - 1)"
          >‹</button>
          <button
            v-for="p in visiblePages"
            :key="p"
            class="page-btn"
            :class="{ 'page-btn--active': p === galleryPage }"
            @click="goToPage(p)"
          >{{ p }}</button>
          <button
            class="page-btn"
            :disabled="galleryPage === galleryTotalPages"
            @click="goToPage(galleryPage + 1)"
          >›</button>
          <button
            class="page-btn"
            :disabled="galleryPage === galleryTotalPages"
            @click="goToPage(galleryTotalPages)"
          >»</button>
        </div>
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <transition name="modal-fade">
      <div v-if="previewRecord" class="preview-modal" @click.self="closePreview">
        <div class="preview-panel">
          <div class="preview-panel-header">
            <div class="preview-panel-title">
              <span class="preview-panel-icon">🐷</span>
              <div>
                <div class="preview-panel-name">{{ previewRecord.image_name }}</div>
                <div class="preview-panel-meta">
                  {{ previewRecord.farm_name || '未分配猪场' }} · {{ formatDate(previewRecord.created_at) }}
                </div>
              </div>
            </div>
            <button class="preview-close-btn" @click="closePreview">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="preview-panel-body">
            <div class="preview-img-area">
              <img
                v-if="previewRecord.annotated_image"
                :src="previewRecord.annotated_image"
                :alt="previewRecord.image_name"
                class="preview-full-img"
              />
              <div v-else class="preview-no-img">
                <span>🐷</span>
                <p>暂无标注图片</p>
              </div>
            </div>

            <div class="preview-detail-panel">
              <div class="preview-stat-grid">
                <div class="preview-stat">
                  <div class="preview-stat-val">{{ previewRecord.predicted_count }}</div>
                  <div class="preview-stat-label">识别头数</div>
                </div>
                <div class="preview-stat">
                  <div class="preview-stat-val">{{ previewRecord.processing_time_ms }}</div>
                  <div class="preview-stat-label">耗时 (ms)</div>
                </div>
              </div>

              <div class="preview-info-list">
                <div class="preview-info-item">
                  <span class="preview-info-label">猪场</span>
                  <span class="preview-info-val">{{ previewRecord.farm_name || '未分配' }}</span>
                </div>
                <div class="preview-info-item">
                  <span class="preview-info-label">文件名</span>
                  <span class="preview-info-val preview-info-val--mono">{{ previewRecord.image_name }}</span>
                </div>
                <div class="preview-info-item">
                  <span class="preview-info-label">识别时间</span>
                  <span class="preview-info-val">{{ formatDate(previewRecord.created_at) }}</span>
                </div>
                <div class="preview-info-item">
                  <span class="preview-info-label">记录 ID</span>
                  <span class="preview-info-val preview-info-val--mono">#{{ previewRecord.id }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
    
    <footer class="footer">
      <span class="footer-brand">智慧猪群识别系统</span>
      <span class="footer-dot">·</span>
      <span>Powered By 智能数猪大模型</span>
      <span class="footer-dot">·</span>
      <span>© {{ year }}</span>
    </footer>
  </div>
</template>

<script>
import { Chart, registerables } from 'chart.js'
import { getStatsByFarm, getDetectionStats, getDetectionRecordsWithImages, getTimeSeriesStats } from '@/api/statsApi'

// 注册 Chart.js 组件
Chart.register(...registerables)

export default {
  name: 'StatsPage',

  data() {
    return {
      loading: false,
      lastUpdateTime: null,

      // 全局汇总
      globalStats: { total_images: 0, total_pigs: 0, today_images: 0, today_pigs: 0 },

      // 猪场统计
      farmStats: [],
      farmStatsLoading: false,

      // 时间序列数据
      timeSeriesData: [],
      timeSeriesLoading: false,
      timeSeriesGranularity: 'day', // day 或 month
      timeSeriesChart: null,

      // 图片回看
      selectedFarmId: null,
      gallery: [],
      galleryTotal: 0,
      galleryPage: 1,
      galleryPageSize: 12,
      galleryLoading: false,

      // 预览弹窗
      previewRecord: null,
    }
  },

  computed: {
    year() {
      return new Date().getFullYear()
    },
    
    globalSummaryCards() {
      return [
        { icon: '🖼️', label: '识别图片总数', value: this.globalStats.total_images.toLocaleString() },
        { icon: '🐷', label: '识别猪只总数', value: this.globalStats.total_pigs.toLocaleString() },
        { icon: '📅', label: '今日识别图片', value: this.globalStats.today_images.toLocaleString() },
        { icon: '🐖', label: '今日识别猪只', value: this.globalStats.today_pigs.toLocaleString() },
      ]
    },
    selectedFarmName() {
      if (this.selectedFarmId === null) return null
      const farm = this.farmStats.find(f => f.farm_id === this.selectedFarmId)
      return farm ? (farm.farm_name || '未分配猪场') : null
    },
    galleryTotalPages() {
      return Math.ceil(this.galleryTotal / this.galleryPageSize) || 1
    },
    visiblePages() {
      const cur = this.galleryPage
      const total = this.galleryTotalPages
      const pages = []
      for (let p = Math.max(1, cur - 2); p <= Math.min(total, cur + 2); p++) {
        pages.push(p)
      }
      return pages
    },
  },

  created() {
    this.loadAll()
  },

  mounted() {
    // 组件挂载后初始化图表
    this.$nextTick(() => {
      if (this.timeSeriesData.length > 0) {
        this.updateTimeSeriesChart()
      }
    })
  },

  watch: {
    // 监听时间序列数据变化，自动更新图表
    timeSeriesData: {
      handler() {
        this.$nextTick(() => {
          this.updateTimeSeriesChart()
        })
      },
      deep: true
    }
  },

  methods: {
    async loadAll() {
      this.loading = true
      await Promise.all([this.loadGlobalStats(), this.loadFarmStats(), this.loadGallery(), this.loadTimeSeriesData()])
      this.lastUpdateTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      this.loading = false
    },

    async loadTimeSeriesData() {
      this.timeSeriesLoading = true
      try {
        const res = await getTimeSeriesStats({
          granularity: this.timeSeriesGranularity,
          farmId: this.selectedFarmId
        })
        console.log('Time series data response:', res)
        if (res && res.success) {
          this.timeSeriesData = res.data
          console.log('Updated timeSeriesData:', this.timeSeriesData)
          this.$nextTick(() => {
            this.updateTimeSeriesChart()
          })
        } else {
          console.error('Invalid response format:', res)
          this.timeSeriesData = []
        }
      } catch (e) { console.error(e) }
      finally { this.timeSeriesLoading = false }
    },

    updateTimeSeriesChart() {
      console.log('Updating time series chart...')
      console.log('Data:', this.timeSeriesData)
      
      // 使用ref获取canvas元素
      const canvasElement = this.$refs.timeSeriesChartRef
      console.log('Canvas element:', canvasElement)
      
      if (!canvasElement) {
        console.error('Chart canvas element not found')
        return
      }
      
      const ctx = canvasElement.getContext('2d')
      console.log('Chart context:', ctx)
      
      if (!ctx) {
        console.error('Failed to get canvas context')
        return
      }

      // 销毁旧图表
      if (this.timeSeriesChart) {
        console.log('Destroying old chart')
        this.timeSeriesChart.destroy()
      }

      // 准备数据
      const labels = this.timeSeriesData.map(item => item.date)
      const imageData = this.timeSeriesData.map(item => item.images)
      const pigData = this.timeSeriesData.map(item => item.pigs)
      
      console.log('Labels:', labels)
      console.log('Image data:', imageData)
      console.log('Pig data:', pigData)

      try {
        // 创建新图表
        this.timeSeriesChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: '上传图片数',
                data: imageData,
                borderColor: '#007aff',
                backgroundColor: 'rgba(0, 122, 255, 0.1)',
                tension: 0.4,
                fill: true
              },
              {
                label: '识别猪只数',
                data: pigData,
                borderColor: '#34c759',
                backgroundColor: 'rgba(52, 199, 89, 0.1)',
                tension: 0.4,
                fill: true
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: this.timeSeriesGranularity === 'day' ? '每日数据统计' : '每月数据统计',
                font: {
                  size: 14,
                  weight: '600'
                }
              },
              legend: {
                position: 'top'
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  precision: 0
                }
              }
            }
          }
        })
        console.log('Chart created successfully')
      } catch (error) {
        console.error('Error creating chart:', error)
      }
    },

    changeTimeSeriesGranularity(granularity) {
      this.timeSeriesGranularity = granularity
      this.loadTimeSeriesData()
    },

    async loadGlobalStats() {
      try {
        const res = await getDetectionStats(null)
        if (res.success) this.globalStats = res.data
      } catch (e) { console.error(e) }
    },

    async loadFarmStats() {
      this.farmStatsLoading = true
      try {
        const res = await getStatsByFarm()
        if (res.success) this.farmStats = res.data
      } catch (e) { console.error(e) }
      finally { this.farmStatsLoading = false }
    },

    async loadGallery() {
      this.galleryLoading = true
      try {
        const res = await getDetectionRecordsWithImages({
          farmId: this.selectedFarmId,
          page: this.galleryPage,
          pageSize: this.galleryPageSize,
        })
        if (res.success) {
          this.gallery = res.data
          this.galleryTotal = res.total
        }
      } catch (e) { console.error(e) }
      finally { this.galleryLoading = false }
    },

    selectFarmForGallery(farmId) {
      if (this.selectedFarmId === farmId) {
        this.clearFarmFilter()
        return
      }
      this.selectedFarmId = farmId
      this.galleryPage = 1
      this.loadGallery()
      this.loadTimeSeriesData()
    },

    clearFarmFilter() {
      this.selectedFarmId = null
      this.galleryPage = 1
      this.loadGallery()
      this.loadTimeSeriesData()
    },

    goToPage(page) {
      this.galleryPage = page
      this.loadGallery()
      this.$nextTick(() => {
        const el = document.querySelector('.gallery-section')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    },

    openRecord(record) {
      this.previewRecord = record
      document.body.style.overflow = 'hidden'
    },

    closePreview() {
      this.previewRecord = null
      document.body.style.overflow = ''
    },

    formatDate(dateStr) {
      if (!dateStr) return '—'
      return new Date(dateStr).toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      })
    },

    formatDateShort(dateStr) {
      if (!dateStr) return '—'
      return new Date(dateStr).toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      })
    },
  },
}
</script>

<style scoped>
/* ====== 全局变量（与 App.vue 保持一致） ====== */
.stats-page {
  --bg: #f2f2f7;
  --glass-bg: rgba(255,255,255,0.65);
  --glass-border: rgba(255,255,255,0.88);
  --glass-shadow: 0 2px 20px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04);
  --text: #000000;
  --text-2: #3a3a3c;
  --text-3: #6e6e73;
  --text-4: #aeaeb2;
  --sep: rgba(60,60,67,0.12);
  --sep-opaque: #d1d1d6;
  --blue: #007aff;
  --green: #34c759;
  --orange: #ff9500;
  --red: #ff3b30;
  --r-md: 16px;
  --r-lg: 20px;
  --ease-out: cubic-bezier(0.16,1,0.3,1);
  --spring: cubic-bezier(0.34,1.56,0.64,1);

  min-height: 100vh;
  padding: 28px 28px 80px;
  position: relative;
  max-width: 1440px;
  margin: 0 auto;
}

/* ====== 背景 ====== */
.stats-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
}
.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
}
.bg-orb--1 {
  width: 500px; height: 500px;
  top: -150px; right: -100px;
  background: radial-gradient(circle, rgba(0,122,255,0.2) 0%, transparent 70%);
}
.bg-orb--2 {
  width: 400px; height: 400px;
  bottom: -100px; left: -80px;
  background: radial-gradient(circle, rgba(52,199,89,0.18) 0%, transparent 70%);
}
.bg-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(0,0,0,0.018) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.018) 1px, transparent 1px);
  background-size: 48px 48px;
}

/* ====== 页面头部 ====== */
.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}
.stats-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.stats-title-icon {
  font-size: 36px;
  filter: drop-shadow(0 4px 10px rgba(0,0,0,0.1));
}
.stats-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.8px;
  color: var(--text);
  margin: 0;
}
.stats-subtitle {
  font-size: 13px;
  color: var(--text-3);
  margin: 3px 0 0;
}
.stats-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.refresh-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid var(--sep);
  background: rgba(255,255,255,0.7);
  backdrop-filter: blur(12px);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.2s ease;
}
.refresh-btn:hover:not(:disabled) {
  background: white;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.refresh-btn svg.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.last-update {
  font-size: 12px;
  color: var(--text-4);
}

/* ====== 全局汇总卡片 ====== */
.global-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}
@media (max-width: 900px) { .global-summary { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 500px) { .global-summary { grid-template-columns: 1fr; } }

.summary-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-lg);
  box-shadow: var(--glass-shadow);
  padding: 22px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  overflow: hidden;
  animation: cardIn 0.5s var(--ease-out) calc(var(--d, 0ms)) both;
  transition: transform 0.25s var(--spring), box-shadow 0.25s ease;
}
.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 40px rgba(0,0,0,0.10);
}
@keyframes cardIn {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: none; }
}
.summary-card-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.55) 0%, transparent 60%);
  pointer-events: none;
}
.summary-card-icon { font-size: 28px; flex-shrink: 0; }
.summary-card-val {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -1px;
  color: var(--text);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.summary-card-label {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 500;
  margin-top: 4px;
}

/* ====== Section 卡片 ====== */
.section-card {
  background: var(--glass-bg);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-lg);
  box-shadow: var(--glass-shadow);
  overflow: hidden;
  margin-bottom: 20px;
  animation: sectionIn 0.5s var(--ease-out) 0.2s both;
}
@keyframes sectionIn {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: none; }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  border-bottom: 1px solid var(--sep);
  flex-wrap: wrap;
  gap: 8px;
}
.section-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.section-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.section-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--blue);
  box-shadow: 0 0 6px rgba(0,122,255,0.4);
}
.section-dot--green {
  background: var(--green);
  box-shadow: 0 0 6px rgba(52,199,89,0.4);
}
.section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-2);
}
.section-badge {
  font-size: 11px;
  font-weight: 500;
  background: rgba(0,122,255,0.08);
  border: 1px solid rgba(0,122,255,0.15);
  color: var(--blue);
  border-radius: 20px;
  padding: 3px 10px;
}
.section-badge--gray {
  background: rgba(0,0,0,0.04);
  border-color: var(--sep);
  color: var(--text-3);
}
.total-badge {
  font-size: 12px;
  color: var(--text-3);
}
.clear-filter-btn {
  font-size: 12px;
  font-weight: 500;
  color: var(--red);
  background: rgba(255,59,48,0.06);
  border: 1px solid rgba(255,59,48,0.15);
  border-radius: 8px;
  padding: 5px 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.clear-filter-btn:hover { background: rgba(255,59,48,0.12); }

/* ====== 加载 / 空状态 ====== */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 56px 24px;
  color: var(--text-3);
  font-size: 14px;
}
.loading-spinner {
  width: 24px; height: 24px;
  border: 2.5px solid var(--sep);
  border-top-color: var(--blue);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
.empty-icon { font-size: 36px; opacity: 0.4; }

/* ====== 猪场统计表 ====== */
.farm-stats-table-wrap {
  overflow-x: auto;
}
.farm-stats-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.farm-stats-table th {
  padding: 10px 18px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 0.02em;
  border-bottom: 1px solid var(--sep);
  background: rgba(0,0,0,0.012);
  white-space: nowrap;
}
.farm-stats-row {
  transition: background 0.15s ease;
  animation: rowIn 0.4s var(--ease-out) calc(var(--ri, 0) * 40ms) both;
}
@keyframes rowIn {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: none; }
}
.farm-stats-row td {
  padding: 12px 18px;
  border-bottom: 1px solid rgba(0,0,0,0.04);
  vertical-align: middle;
}
.farm-stats-row:last-child td { border-bottom: none; }
.farm-stats-row:hover td { background: rgba(0,122,255,0.025); }
.farm-stats-row--active td { background: rgba(0,122,255,0.04); }

.farm-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.farm-icon-sm { font-size: 16px; }
.farm-name-text { font-weight: 600; color: var(--text); }

.num-cell { display: flex; align-items: baseline; gap: 3px; }
.num-val { font-size: 18px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
.num-cell--highlight .num-val { color: var(--green); }
.today-val { color: var(--blue); font-size: 18px; }
.num-unit { font-size: 12px; color: var(--text-3); }

.time-chip {
  font-size: 11px;
  font-weight: 500;
  background: rgba(255,149,0,0.08);
  border: 1px solid rgba(255,149,0,0.18);
  color: var(--orange);
  border-radius: 6px;
  padding: 3px 8px;
  font-variant-numeric: tabular-nums;
}
.date-text { font-size: 12px; color: var(--text-4); font-variant-numeric: tabular-nums; }

.view-btn {
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid rgba(0,122,255,0.25);
  background: rgba(0,122,255,0.06);
  color: var(--blue);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.view-btn:hover { background: rgba(0,122,255,0.12); transform: translateY(-1px); }
.view-btn--active {
  background: var(--blue);
  color: white;
  border-color: var(--blue);
  box-shadow: 0 2px 10px rgba(0,122,255,0.3);
}
.view-btn--active:hover { background: #0068d6; }

/* ====== 图片回看网格 ====== */
.gallery-section { animation-delay: 0.3s; }

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  padding: 18px;
}
@media (max-width: 1100px) { .gallery-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 750px)  { .gallery-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px)  { .gallery-grid { grid-template-columns: 1fr; } }

.gallery-card {
  background: rgba(255,255,255,0.5);
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.25s var(--spring);
  animation: galleryCardIn 0.45s var(--ease-out) calc(var(--gi, 0) * 30ms) both;
}
@keyframes galleryCardIn {
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
  to   { opacity: 1; transform: none; }
}
.gallery-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 28px rgba(0,0,0,0.12);
  border-color: rgba(0,122,255,0.2);
}

.gallery-img-wrap {
  position: relative;
  aspect-ratio: 4/3;
  background: rgba(0,0,0,0.04);
  overflow: hidden;
}
.gallery-img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}
.gallery-card:hover .gallery-img { transform: scale(1.04); }
.gallery-img-placeholder {
  width: 100%; height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  opacity: 0.3;
}
.gallery-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.gallery-card:hover .gallery-overlay { opacity: 1; }
.gallery-overlay-icon { font-size: 24px; }

.gallery-card-info {
  padding: 10px 12px;
}
.gallery-count { margin-bottom: 5px; }
.pig-badge {
  font-size: 12px;
  font-weight: 700;
  background: rgba(52,199,89,0.1);
  border: 1px solid rgba(52,199,89,0.2);
  color: #34c759;
  border-radius: 6px;
  padding: 2px 8px;
}
.gallery-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 4px;
}
.gallery-farm {
  font-size: 11px;
  color: var(--blue);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}
.gallery-date {
  font-size: 11px;
  color: var(--text-4);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.gallery-filename {
  font-size: 11px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ====== 分页 ====== */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px;
  border-top: 1px solid var(--sep);
}
.page-btn {
  min-width: 34px;
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--sep);
  background: rgba(255,255,255,0.6);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.2s ease;
  font-variant-numeric: tabular-nums;
}
.page-btn:hover:not(:disabled) {
  background: white;
  border-color: var(--blue);
  color: var(--blue);
}
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-btn--active {
  background: var(--blue);
  border-color: var(--blue);
  color: white;
  box-shadow: 0 2px 8px rgba(0,122,255,0.3);
}
.page-btn--active:hover { background: #0068d6; }

/* ====== 预览弹窗 ====== */
.preview-modal {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.preview-panel {
  background: rgba(255,255,255,0.96);
  backdrop-filter: blur(32px);
  border: 1px solid rgba(255,255,255,0.9);
  border-radius: 24px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.2);
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.preview-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--sep);
  gap: 12px;
}
.preview-panel-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.preview-panel-icon { font-size: 24px; }
.preview-panel-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}
.preview-panel-meta {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
}
.preview-close-btn {
  width: 34px; height: 34px;
  border-radius: 8px;
  border: none;
  background: rgba(0,0,0,0.05);
  color: var(--text-3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}
.preview-close-btn:hover { background: rgba(0,0,0,0.1); color: var(--text); }

.preview-panel-body {
  display: flex;
  gap: 0;
  flex: 1;
  overflow: hidden;
}
.preview-img-area {
  flex: 1;
  background: rgba(0,0,0,0.03);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 300px;
}
.preview-full-img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  display: block;
}
.preview-no-img {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  opacity: 0.3;
  font-size: 14px;
  color: var(--text-3);
}
.preview-no-img span { font-size: 48px; }

.preview-detail-panel {
  width: 220px;
  flex-shrink: 0;
  border-left: 1px solid var(--sep);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}
.preview-stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.preview-stat {
  background: rgba(0,0,0,0.03);
  border-radius: 10px;
  padding: 12px 10px;
  text-align: center;
}
.preview-stat-val {
  font-size: 24px;
  font-weight: 800;
  color: var(--green);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.preview-stat-label {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 4px;
}

.preview-info-list { display: flex; flex-direction: column; gap: 12px; }
.preview-info-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.preview-info-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-4);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.preview-info-val {
  font-size: 13px;
  color: var(--text-2);
  font-weight: 500;
}
.preview-info-val--mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  word-break: break-all;
}

/* ====== 弹窗动画 ====== */
.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.3s ease;
}
.modal-fade-enter-active .preview-panel,
.modal-fade-leave-active .preview-panel {
  transition: transform 0.3s var(--spring);
}
.modal-fade-enter-from { opacity: 0; }
.modal-fade-leave-to   { opacity: 0; }
.modal-fade-enter-from .preview-panel { transform: scale(0.93) translateY(10px); }
.modal-fade-leave-to   .preview-panel { transform: scale(0.93) translateY(10px); }

/* ====== 图表容器 ====== */
.chart-container {
  padding: 20px;
  height: 400px;
}

/* ====== 粒度选择器 ====== */
.granularity-selector {
  display: flex;
  gap: 8px;
  align-items: center;
}

.granularity-btn {
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--sep);
  background: rgba(255,255,255,0.7);
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.2s ease;
}

.granularity-btn:hover {
  background: white;
  border-color: var(--blue);
  color: var(--blue);
}

.granularity-btn--active {
  background: var(--blue);
  border-color: var(--blue);
  color: white;
  box-shadow: 0 2px 8px rgba(0,122,255,0.3);
}

.granularity-btn--active:hover {
  background: #0068d6;
  color: white;
}

/* ====== 页脚 ====== */
.footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-4);
  margin-top: 40px;
  padding-bottom: 24px;
}

.footer-brand {
  font-weight: 600;
  color: var(--text-3);
}

.footer-dot {
  color: var(--sep-opaque);
}
</style>