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
        <BarChart3 :size="28" class="stats-title-icon" />
        <div>
          <h1 class="stats-title">数据统计中心</h1>
          <p class="stats-subtitle">各猪场识别数据汇总 · 结果回看</p>
        </div>
      </div>
      <div class="stats-header-right">
        <div class="last-update" v-if="lastUpdateTime">
          更新于 {{ lastUpdateTime }}
        </div>
        <button class="refresh-btn" @click="loadAll" :disabled="loading">
          <svg :class="{ spinning: loading }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          <span>{{ loading ? '加载中…' : '刷新数据' }}</span>
        </button>
      </div>
    </div>

    <!-- 全局汇总卡片 -->
    <div class="global-summary">
      <div class="summary-card" v-for="(item, i) in globalSummaryCards" :key="i" :style="{ '--d': i * 80 + 'ms' }">
        <div class="summary-card-icon"><component :is="item.icon" :size="20" /></div>
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
          <div class="view-tabs">
            <button class="view-tab" :class="{ 'view-tab--active': timeSeriesGranularity === 'day' }" @click="changeTimeSeriesGranularity('day')">日</button>
            <button class="view-tab" :class="{ 'view-tab--active': timeSeriesGranularity === 'month' }" @click="changeTimeSeriesGranularity('month')">月</button>
            <button class="view-tab" :class="{ 'view-tab--active': timeSeriesGranularity === 'year' }" @click="changeTimeSeriesGranularity('year')">年</button>
          </div>
        </div>
      </div>

      <div v-if="timeSeriesLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载趋势数据…</span>
      </div>

      <div v-else-if="timeSeriesData.length === 0" class="empty-state">
        <BarChart3 :size="36" class="empty-icon" />
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
        <PiggyBank :size="40" class="empty-icon" />
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
                  <Warehouse :size="14" class="farm-icon-sm" />
                  <span class="farm-name-text" @mouseenter="checkTooltip($event)" @mouseleave="hideTooltip()">{{ (farm.farm_name || '未分配猪场').length > 11 ? (farm.farm_name || '未分配猪场').slice(0, 11) + '...' : (farm.farm_name || '未分配猪场') }}</span>
                </div>
              </td>
              <td>
                <div class="num-cell">
                  <span class="num-val num-val--blue">{{ farm.total_images }}</span>
                  <span class="num-unit">张</span>
                </div>
              </td>
              <td>
                <div class="num-cell">
                  <span class="num-val num-val--blue">{{ farm.total_pigs }}</span>
                  <span class="num-unit">头</span>
                </div>
              </td>
              <td>
                <div class="num-cell">
                  <span class="num-val">{{ farm.today_images }}</span>
                  <span class="num-unit">张</span>
                </div>
              </td>
              <td>
                <div class="num-cell">
                  <span class="num-val">{{ farm.today_pigs }}</span>
                  <span class="num-unit">头</span>
                </div>
              </td>
              <td class="avg-time-text">{{ farm.avg_processing_time_ms }} ms</td>
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
          <span class="total-badge" v-if="galleryTotal > 0">共 {{ galleryTotal }} 条</span>
        </div>
      </div>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <div class="filter-group">
          <div class="antd-select" :class="{ 'antd-select--open': farmDropdownOpen }" @click.stop="farmDropdownOpen = !farmDropdownOpen">
            <div class="antd-select-selector">
              <span class="antd-select-selection-item" :class="{ 'antd-select-selection-placeholder': !selectedFarmId }">
                {{ truncateFarm(selectedFarmId ? (farmStats.find(f => f.farm_id === selectedFarmId)?.farm_name || '未分配') : '全部猪场') }}
              </span>
              <span class="antd-select-arrow">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
              <span v-if="selectedFarmId" class="antd-select-clear" @click.stop="selectedFarmId = null; onFarmSelectChange(); farmDropdownOpen = false">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </span>
            </div>
            <transition name="dropdown-fade">
              <div v-if="farmDropdownOpen" class="antd-select-dropdown" @click.stop>
                <div class="antd-select-item" :class="{ 'antd-select-item--selected': !selectedFarmId }" @click="selectedFarmId = null; onFarmSelectChange(); farmDropdownOpen = false">全部猪场</div>
                <div v-for="f in farmStats" :key="f.farm_id" class="antd-select-item" :class="{ 'antd-select-item--selected': selectedFarmId === f.farm_id }" @click="selectedFarmId = f.farm_id; onFarmSelectChange(); farmDropdownOpen = false">
                  {{ truncateFarm(f.farm_name || '未分配') }}
                </div>
              </div>
            </transition>
          </div>
        </div>
        <div class="filter-group filter-group--search">
          <input class="filter-input" v-model="filterKeyword" placeholder="搜索文件名…" @keyup.enter="onKeywordSearch" />
          <button class="filter-search-btn" @click="onKeywordSearch">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
        </div>
        <div class="filter-group filter-group--time">
          <button v-for="r in [{k:'today',l:'今天'},{k:'week',l:'本周'},{k:'month',l:'本月'},{k:'all',l:'全部'}]"
            :key="r.k" class="filter-chip" :class="{ 'filter-chip--active': timeRange === r.k }"
            @click="setTimeRange(r.k)">{{ r.l }}</button>
          <div class="antd-range-picker" :class="{ 'antd-range-picker--focused': rangePickerOpen }" @click.stop="rangePickerOpen = !rangePickerOpen">
            <div class="antd-range-picker-input-wrapper">
              <input class="antd-range-picker-input" :value="customStartDate ? formatDateCN(customStartDate) : ''" placeholder="开始日期" readonly />
              <span class="antd-range-picker-separator">~</span>
              <input class="antd-range-picker-input" :value="customEndDate ? formatDateCN(customEndDate) : ''" placeholder="结束日期" readonly />
              <span class="antd-range-picker-suffix">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </span>
            </div>
            <transition name="dropdown-fade">
              <div v-if="rangePickerOpen" class="antd-range-picker-dropdown" @click.stop>
                <div class="cal-panels">
                  <!-- 左面板：开始月份 -->
                  <div class="cal-panel">
                    <div class="cal-panel-header">
                      <button class="cal-nav-btn" @click="calLeftMonth--">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                      <span class="cal-panel-title">{{ calLeftYear }}年{{ calLeftMonth + 1 }}月</span>
                      <span class="cal-nav-btn cal-nav-placeholder"></span>
                    </div>
                    <div class="cal-weekdays">
                      <span v-for="d in ['日','一','二','三','四','五','六']" :key="d" class="cal-weekday">{{ d }}</span>
                    </div>
                    <div class="cal-grid">
                      <div v-for="(day, i) in leftCalendarDays" :key="i"
                        class="cal-day"
                        :class="{
                          'cal-day--other': !day.current,
                          'cal-day--today': day.isToday,
                          'cal-day--range-start': day.dateStr === customStartDate && customEndDate,
                          'cal-day--range-end': day.dateStr === customEndDate && customStartDate,
                          'cal-day--in-range': customStartDate && customEndDate && day.dateStr > customStartDate && day.dateStr < customEndDate,
                          'cal-day--selected': day.dateStr === customStartDate || day.dateStr === customEndDate
                        }"
                        @click="onCalDayClick(day.dateStr)"
                      >{{ day.day }}</div>
                    </div>
                  </div>
                  <!-- 右面板：结束月份 -->
                  <div class="cal-panel">
                    <div class="cal-panel-header">
                      <span class="cal-nav-btn cal-nav-placeholder"></span>
                      <span class="cal-panel-title">{{ calRightYear }}年{{ calRightMonth + 1 }}月</span>
                      <button class="cal-nav-btn" @click="calLeftMonth++">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    </div>
                    <div class="cal-weekdays">
                      <span v-for="d in ['日','一','二','三','四','五','六']" :key="d" class="cal-weekday">{{ d }}</span>
                    </div>
                    <div class="cal-grid">
                      <div v-for="(day, i) in rightCalendarDays" :key="i"
                        class="cal-day"
                        :class="{
                          'cal-day--other': !day.current,
                          'cal-day--today': day.isToday,
                          'cal-day--range-start': day.dateStr === customStartDate && customEndDate,
                          'cal-day--range-end': day.dateStr === customEndDate && customStartDate,
                          'cal-day--in-range': customStartDate && customEndDate && day.dateStr > customStartDate && day.dateStr < customEndDate,
                          'cal-day--selected': day.dateStr === customStartDate || day.dateStr === customEndDate
                        }"
                        @click="onCalDayClick(day.dateStr)"
                      >{{ day.day }}</div>
                    </div>
                  </div>
                </div>
                <div class="antd-range-picker-footer">
                  <div class="cal-selected-info" v-if="customStartDate">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {{ formatDateCN(customStartDate) }}{{ customEndDate ? ' → ' + formatDateCN(customEndDate) : ' → 选择结束日期' }}
                  </div>
                  <div class="cal-footer-btns">
                    <button class="antd-range-picker-reset" @click="customStartDate = ''; customEndDate = ''">重置</button>
                    <button class="antd-range-picker-ok" @click="onCustomDateChange(); rangePickerOpen = false; timeRange = 'custom'">确定</button>
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>

      <div v-if="galleryLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载图片记录…</span>
      </div>

      <div v-else-if="gallery.length === 0" class="empty-state">
        <Camera :size="36" class="empty-icon" />
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
                <PiggyBank :size="32" />
              </div>
              <div class="gallery-overlay">
                <ZoomIn :size="24" class="gallery-overlay-icon" />
                <span>点击查看</span>
              </div>
            </div>
            <div class="gallery-card-info">
              <div class="gallery-count">
                <span class="pig-badge"><PiggyBank :size="12" /> {{ record.predicted_count }} 头</span>
                <span class="conf-badge" v-if="record.confidence">{{ Math.round(record.confidence * 100) }}%</span>
              </div>
              <div class="gallery-meta">
                <span class="gallery-farm" v-if="record.farm_name" @mouseenter="checkTooltip($event)" @mouseleave="hideTooltip()">{{ record.farm_name.length > 11 ? record.farm_name.slice(0, 11) + '...' : record.farm_name }}</span>
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
              <PiggyBank :size="22" class="preview-panel-icon" />
              <div>
                <div class="preview-panel-name">{{ previewRecord.image_name }}</div>
                <div class="preview-panel-meta">
                  {{ previewRecord.farm_name || '未分配猪场' }} · {{ formatDate(previewRecord.created_at) }}
                </div>
              </div>
            </div>
            <div class="preview-header-actions">
              <button class="preview-close-btn" @click="closePreview">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="preview-panel-body">
            <div class="preview-img-area" @click="openFullscreen">
              <img
                v-if="previewRecord.annotated_image"
                :src="previewRecord.annotated_image"
                :alt="previewRecord.image_name"
                class="preview-full-img"
              />
              <div v-else class="preview-no-img">
                <PiggyBank :size="32" />
                <p>暂无标注图片</p>
              </div>
              <div class="preview-img-overlay" v-if="previewRecord.annotated_image">
                <ZoomIn :size="20" />
                <span>点击放大</span>
              </div>
            </div>

            <div class="preview-detail-panel">
              <div class="preview-stat-grid">
                <div class="preview-stat">
                  <div class="preview-stat-val">{{ previewRecord.predicted_count }}</div>
                  <div class="preview-stat-label">识别头数</div>
                </div>
                <div class="preview-stat">
                  <div class="preview-stat-val">{{ previewRecord.confidence ? Math.round(previewRecord.confidence * 100) + '%' : '—' }}</div>
                  <div class="preview-stat-label">置信度</div>
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

    <!-- 全屏图片查看：1:1 复刻 ImagePreviewModal -->
    <transition name="modal-fade">
      <div v-if="fullscreenSrc" class="image-preview-modal" @click="closeFullscreen">
        <div class="preview-backdrop"></div>
        <div class="preview-container" @click.stop>
          <button class="preview-close" @click="closeFullscreen" title="关闭">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <div class="preview-content">
            <img :src="fullscreenSrc" class="preview-image" alt="识别结果大图" />
            <div class="preview-info" v-if="previewRecord">
              <span class="preview-badge">检测到 {{ previewRecord.predicted_count }} 头猪</span>
              <span class="preview-badge" v-if="previewRecord.confidence">置信度 {{ Math.round(previewRecord.confidence * 100) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <div v-if="tooltipVisible" class="custom-tooltip" :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }">{{ tooltipText }}</div>
  </div>
</template>

<script>
import { Chart, registerables } from 'chart.js'
import { getStatsByFarm, getDetectionStats, getDetectionRecordsWithImages, getTimeSeriesStats } from '@/api/statsApi'
import { BarChart3, PiggyBank, Camera, Warehouse, ZoomIn } from '@lucide/vue'

// 注册 Chart.js 组件
Chart.register(...registerables)

export default {
  name: 'StatsPage',
  components: { BarChart3, PiggyBank, Camera, Warehouse, ZoomIn },

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
      timeSeriesGranularity: 'day', // day, month 或 year
      timeSeriesChart: null,

      // 图片回看
      selectedFarmId: null,
      gallery: [],
      galleryTotal: 0,
      galleryPage: 1,
      galleryPageSize: 12,
      galleryLoading: false,

      // 筛选条件
      timeRange: 'all',
      farmDropdownOpen: false,
      rangePickerOpen: false,
      calYear: new Date().getFullYear(),
      calMonth: new Date().getMonth(),
      calLeftMonth: new Date().getMonth(),
      calLeftYear: new Date().getFullYear(),
      tooltipVisible: false,
      tooltipText: '',
      tooltipX: 0,
      tooltipY: 0,
      filterKeyword: '',
      customStartDate: '',
      customEndDate: '',

      // 预览弹窗
      previewRecord: null,

      // 全屏查看
      fullscreenSrc: null,
    }
  },

  computed: {
    calRightYear() {
      return this.calLeftMonth === 11 ? this.calLeftYear + 1 : this.calLeftYear
    },
    calRightMonth() {
      return this.calLeftMonth === 11 ? 0 : this.calLeftMonth + 1
    },
    leftCalendarDays() {
      return this._buildCalendarDays(this.calLeftYear, this.calLeftMonth)
    },
    rightCalendarDays() {
      return this._buildCalendarDays(this.calRightYear, this.calRightMonth)
    },
    year() {
      return new Date().getFullYear()
    },
    
    globalSummaryCards() {
      return [
        { icon: 'Camera', label: '识别图片总数', value: this.globalStats.total_images.toLocaleString() },
        { icon: 'PiggyBank', label: '识别猪只总数', value: this.globalStats.total_pigs.toLocaleString() },
        { icon: 'Camera', label: '今日识别图片', value: this.globalStats.today_images.toLocaleString() },
        { icon: 'PiggyBank', label: '今日识别猪只', value: this.globalStats.today_pigs.toLocaleString() },
      ]
    },
    selectedFarmName() {
      if (this.selectedFarmId === null) return null
      const farm = this.farmStats.find(f => f.farm_id === this.selectedFarmId)
      return farm ? (farm.farm_name || '未分配猪场') : null
    },
    dateRange() {
      const now = new Date()
      const fmt = d => d.toISOString().slice(0, 10)
      if (this.timeRange === 'today') {
        const d = fmt(now)
        return { startDate: d, endDate: d }
      }
      if (this.timeRange === 'week') {
        const start = new Date(now)
        start.setDate(start.getDate() - start.getDay() + 1)
        return { startDate: fmt(start), endDate: fmt(now) }
      }
      if (this.timeRange === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        return { startDate: fmt(start), endDate: fmt(now) }
      }
      if (this.timeRange === 'custom' && this.customStartDate && this.customEndDate) {
        return { startDate: this.customStartDate, endDate: this.customEndDate }
      }
      return { startDate: null, endDate: null }
    },
    hasActiveFilters() {
      return this.timeRange !== 'all' || this.selectedFarmId !== null || this.filterKeyword !== ''
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
    this.$nextTick(() => {
      if (this.timeSeriesData.length > 0) {
        this.updateTimeSeriesChart()
      }
    })
    this._closeDropdown = () => { this.farmDropdownOpen = false; this.rangePickerOpen = false }
    document.addEventListener('click', this._closeDropdown)
  },

  beforeUnmount() {
    document.removeEventListener('click', this._closeDropdown)
    if (this._chartMouseListeners) {
      this._chartMouseListeners.forEach(({ el, event, fn }) => el.removeEventListener(event, fn))
      this._chartMouseListeners = null
    }
    if (this.timeSeriesChart) {
      this.timeSeriesChart.stop()
      this.timeSeriesChart.destroy()
      this.timeSeriesChart = null
    }
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
        if (res && res.success) {
          this.timeSeriesData = res.data
        } else {
          this.timeSeriesData = []
        }
      } catch (e) { console.error(e); this.timeSeriesData = [] }
      finally {
        this.timeSeriesLoading = false
        // 等待 DOM 更新完成后再创建 chart，避免 canvas 未就绪
        await this.$nextTick()
        if (this.$refs.timeSeriesChartRef) {
          this.updateTimeSeriesChart()
        }
      }
    },

    updateTimeSeriesChart() {
      const canvasElement = this.$refs.timeSeriesChartRef
      if (!canvasElement || !canvasElement.isConnected) return
      const ctx = canvasElement.getContext('2d')
      if (!ctx) return

      if (this.timeSeriesChart) {
        this.timeSeriesChart.stop()
        this.timeSeriesChart.destroy()
        this.timeSeriesChart = null
      }
      // 清理旧的鼠标事件监听
      if (this._chartMouseListeners) {
        this._chartMouseListeners.forEach(({ el, event, fn }) => el.removeEventListener(event, fn))
        this._chartMouseListeners = null
      }

      const labels = this.timeSeriesData.map(item => item.date)
      const imageData = this.timeSeriesData.map(item => item.images)
      const pigData = this.timeSeriesData.map(item => item.pigs)

      // 创建渐变填充（延伸到 y=0）
      const greenGrad = ctx.createLinearGradient(0, 0, 0, canvasElement.height)
      greenGrad.addColorStop(0, 'rgba(34, 197, 94, 0.38)')
      greenGrad.addColorStop(0.3, 'rgba(34, 197, 94, 0.22)')
      greenGrad.addColorStop(0.6, 'rgba(34, 197, 94, 0.10)')
      greenGrad.addColorStop(1, 'rgba(34, 197, 94, 0.04)')

      const blueGrad = ctx.createLinearGradient(0, 0, 0, canvasElement.height)
      blueGrad.addColorStop(0, 'rgba(59, 130, 246, 0.32)')
      blueGrad.addColorStop(0.3, 'rgba(59, 130, 246, 0.18)')
      blueGrad.addColorStop(0.6, 'rgba(59, 130, 246, 0.08)')
      blueGrad.addColorStop(1, 'rgba(59, 130, 246, 0.04)')

      // 十字线 plugin + 鼠标跟踪
      const crosshairPlugin = {
        id: 'crosshair',
        afterDraw(chart) {
          try {
            const { ctx, chartArea } = chart
            if (!ctx || !chartArea) return
            const mouseX = chart._crosshairX
            if (mouseX == null || mouseX < chartArea.left || mouseX > chartArea.right) return

            // 画十字线
            ctx.save()
            ctx.beginPath()
            ctx.setLineDash([5, 4])
            ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)'
            ctx.lineWidth = 1
            ctx.moveTo(mouseX, chartArea.top)
            ctx.lineTo(mouseX, chartArea.bottom)
            ctx.stroke()
            ctx.restore()
          } catch (e) { /* ignore */ }
        }
      }

      // 绑定鼠标事件：进入区域即显示十字线
      const onMouseMove = (e) => {
        const rect = canvasElement.getBoundingClientRect()
        // CSS 像素坐标（Chart.js chartArea 用的是 CSS 像素）
        this.timeSeriesChart._crosshairX = e.clientX - rect.left
        this.timeSeriesChart.draw()
      }
      const onMouseLeave = () => {
        this.timeSeriesChart._crosshairX = null
        this.timeSeriesChart.draw()
      }
      canvasElement.addEventListener('mousemove', onMouseMove)
      canvasElement.addEventListener('mouseleave', onMouseLeave)
      this._chartMouseListeners = [
        { el: canvasElement, event: 'mousemove', fn: onMouseMove },
        { el: canvasElement, event: 'mouseleave', fn: onMouseLeave }
      ]

      try {
        this.timeSeriesChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: '上传图片数',
                data: imageData,
                borderColor: '#3B82F6',
                backgroundColor: blueGrad,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#3B82F6',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                borderWidth: 2.5
              },
              {
                label: '识别猪只数',
                data: pigData,
                borderColor: '#22C55E',
                backgroundColor: greenGrad,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#22C55E',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                borderWidth: 2.5
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false, axis: 'x' },
            animation: false,
            plugins: {
              title: {
                display: true,
                text: this.timeSeriesGranularity === 'day' ? '每日数据统计' : this.timeSeriesGranularity === 'month' ? '每月数据统计' : '每年数据统计',
                font: { size: 16, weight: '600' },
                color: '#1e293b',
                padding: { bottom: 16 }
              },
              legend: {
                position: 'top',
                align: 'end',
                labels: {
                  usePointStyle: true,
                  pointStyle: 'circle',
                  padding: 16,
                  font: { size: 13, weight: 'normal' },
                  color: '#475569'
                }
              },
              tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.92)',
                titleFont: { size: 13, weight: '600' },
                bodyFont: { size: 13 },
                padding: 14,
                cornerRadius: 10,
                usePointStyle: true,
                pointStyle: 'circle',
                boxPadding: 6
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  precision: 0,
                  color: '#94a3b8',
                  font: { size: 11 },
                  padding: 8
                },
                grid: {
                  color: '#f1f5f9',
                  drawBorder: false
                },
                border: { display: false }
              },
              x: {
                ticks: {
                  color: '#94a3b8',
                  font: { size: 11 },
                  padding: 8
                },
                grid: { display: false },
                border: { display: false }
              }
            }
          },
          plugins: [crosshairPlugin]
        })
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
          startDate: this.dateRange.startDate,
          endDate: this.dateRange.endDate,
          keyword: this.filterKeyword || undefined,
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

    onFarmSelectChange() {
      this.galleryPage = 1
      this.loadGallery()
      this.loadTimeSeriesData()
    },

    setTimeRange(range) {
      this.timeRange = range
      this.galleryPage = 1
      if (range !== 'custom') this.loadGallery()
    },

    onCustomDateChange() {
      if (this.customStartDate && this.customEndDate) {
        this.galleryPage = 1
        this.loadGallery()
      }
    },

    onKeywordSearch() {
      this.galleryPage = 1
      this.loadGallery()
    },

    clearAllFilters() {
      this.selectedFarmId = null
      this.timeRange = 'all'
      this.filterKeyword = ''
      this.customStartDate = ''
      this.customEndDate = ''
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

    openFullscreen() {
      if (this.previewRecord && this.previewRecord.annotated_image) {
        this.fullscreenSrc = this.previewRecord.annotated_image
      }
    },

    closeFullscreen() {
      this.fullscreenSrc = null
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
    formatDateCN(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
    },
    _fmtDate(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    },
    checkTooltip(e) {
      const el = e.target
      const fullText = el.getAttribute('data-full') || el.textContent
      // 判断文字是否被截断（含 ... 说明被截断了）
      if (fullText.length > 11 || el.textContent.includes('...')) {
        const rect = el.getBoundingClientRect()
        this.tooltipText = fullText.replace(/\.\.\.$/, '')
        this.tooltipX = rect.left + rect.width / 2
        this.tooltipY = rect.top - 8
        this.tooltipVisible = true
      }
    },
    hideTooltip() {
      this.tooltipVisible = false
    },
    truncateFarm(name) {
      return name && name.length > 11 ? name.slice(0, 11) + '...' : name
    },
    _buildCalendarDays(y, m) {
      const firstDay = new Date(y, m, 1).getDay()
      const daysInMonth = new Date(y, m + 1, 0).getDate()
      const daysInPrev = new Date(y, m, 0).getDate()
      const today = new Date()
      const todayStr = this._fmtDate(today)
      const days = []
      for (let i = firstDay - 1; i >= 0; i--) {
        const d = daysInPrev - i
        days.push({ day: d, current: false, dateStr: this._fmtDate(new Date(y, m - 1, d)), isToday: false })
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        days.push({ day: d, current: true, dateStr, isToday: dateStr === todayStr })
      }
      const remaining = 42 - days.length
      for (let d = 1; d <= remaining; d++) {
        days.push({ day: d, current: false, dateStr: this._fmtDate(new Date(y, m + 1, d)), isToday: false })
      }
      return days
    },
    onCalDayClick(dateStr) {
      if (!this.customStartDate || (this.customStartDate && this.customEndDate)) {
        this.customStartDate = dateStr
        this.customEndDate = ''
      } else if (dateStr < this.customStartDate) {
        this.customEndDate = this.customStartDate
        this.customStartDate = dateStr
      } else {
        this.customEndDate = dateStr
      }
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
  color: var(--text-2);
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
.summary-card-icon { color: var(--text-2); flex-shrink: 0; }
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
  background: var(--blue);
  border: 1px solid var(--blue);
  color: white;
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
.empty-icon { color: var(--text-4); opacity: 0.4; }

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
.farm-icon-sm { color: var(--text-3); vertical-align: middle; margin-right: 4px; }
.farm-name-text { font-weight: 600; color: var(--text); white-space: nowrap; max-width: 11ch; overflow: hidden; text-overflow: ellipsis; display: inline-block; vertical-align: middle; min-width: 0 }

.num-cell { display: flex; align-items: baseline; gap: 3px; }
.num-val { font-size: 18px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
.num-val--blue { color: var(--blue) }
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
.date-text { font-size: 13px; color: var(--text-3); font-variant-numeric: tabular-nums; }
.avg-time-text { font-size: 13px; color: var(--text-3); font-variant-numeric: tabular-nums; }

.view-btn {
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--blue);
  background: var(--blue);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.view-btn:hover { background: #0068d6; transform: translateY(-1px); }
.view-btn--active {
  background: var(--blue);
  color: white;
  border-color: var(--blue);
  box-shadow: 0 2px 10px rgba(0,122,255,0.3);
}
.view-btn--active:hover { background: #0068d6; }

/* ====== 筛选栏 ====== */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 22px;
  border-bottom: 1px solid var(--sep);
  flex-wrap: wrap
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 6px
}
.filter-group--search {
  max-width: 220px;
  margin-left: 0
}
.filter-group--time {
  margin-left: auto
}

/* Ant Design 风格 RangePicker */
.antd-range-picker {
  position: relative;
  font-size: 13px;
}
.antd-range-picker-input-wrapper {
  display: flex;
  align-items: center;
  padding: 4px 11px;
  border-radius: 6px;
  border: 1px solid #d9d9d9;
  background: #fff;
  transition: all 0.2s;
  min-height: 32px;
  gap: 4px;
}
.antd-range-picker:hover .antd-range-picker-input-wrapper { border-color: var(--blue) }
.antd-range-picker--focused .antd-range-picker-input-wrapper { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(0,122,255,0.1) }
.antd-range-picker-input {
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--text);
  width: 95px;
  text-align: center;
  font-family: inherit;
}
.antd-range-picker-input::placeholder { color: #bfbfbf }
.antd-range-picker-separator { color: #bfbfbf; font-size: 12px; padding: 0 2px }
.antd-range-picker-suffix { color: #bfbfbf; margin-left: 4px; flex-shrink: 0; display: flex }
.antd-range-picker-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.12);
  padding: 0;
  z-index: 1000;
}
.cal-panels {
  display: flex;
  gap: 0;
}
.cal-panel {
  padding: 8px 12px;
  min-width: 280px;
}
.cal-panel:first-child { border-right: 1px solid #f0f0f0 }
.cal-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0 10px;
}
.cal-panel-title { font-size: 13px; font-weight: 600; color: var(--text-2) }
.cal-nav-placeholder { width: 24px; height: 24px }
.cal-nav-btn {
  width: 24px; height: 24px;
  border: none; background: transparent;
  border-radius: 4px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-3); transition: all 0.15s;
}
.cal-nav-btn:hover { background: rgba(0,0,0,0.04); color: var(--text) }
.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  padding: 8px 8px 4px;
}
.cal-weekday {
  text-align: center;
  font-size: 12px;
  color: var(--text-4);
  font-weight: 500;
  padding: 2px 0;
}
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  padding: 0 8px 8px;
  gap: 2px;
}
.cal-day {
  text-align: center;
  font-size: 13px;
  padding: 6px 0;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text);
  transition: all 0.1s;
  user-select: none;
}
.cal-day:hover { background: rgba(0,122,255,0.08) }
.cal-day--other { color: var(--text-4) }
.cal-day--today { color: var(--blue); font-weight: 700 }
.cal-day--selected {
  background: var(--blue);
  color: white;
  font-weight: 600;
  border-radius: 6px;
}
.cal-day--range-start { border-radius: 6px 0 0 6px }
.cal-day--range-end { border-radius: 0 6px 6px 0 }
.cal-day--in-range {
  background: rgba(0,122,255,0.1);
  border-radius: 0;
}
.cal-selected-info {
  font-size: 12px;
  color: var(--text-3);
}
.cal-footer-btns { display: flex; gap: 8px }
.antd-range-picker-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-top: 1px solid #f0f0f0;
}
.antd-range-picker-ok {
  padding: 4px 16px;
  border-radius: 6px;
  border: none;
  background: var(--blue);
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.antd-range-picker-ok:hover { background: #0068d6 }
.antd-range-picker-reset {
  padding: 4px 16px;
  border-radius: 6px;
  border: 1px solid #d9d9d9;
  background: #fff;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.antd-range-picker-reset:hover { border-color: var(--blue); color: var(--blue) }

.filter-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
  flex-shrink: 0
}
.filter-chip {
  padding: 5px 14px;
  border-radius: 7px;
  border: 1px solid var(--sep);
  background: rgba(255,255,255,0.6);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.15s ease
}
.filter-chip:hover { background: white; border-color: var(--blue); color: var(--blue) }
.filter-chip--active {
  background: var(--blue);
  border-color: var(--blue);
  color: white;
  box-shadow: 0 2px 8px rgba(0,122,255,0.25)
}
.filter-chip--active:hover { background: #0068d6; color: white }
/* Ant Design 风格 Select */
.antd-select {
  position: relative;
  width: 180px;
  font-size: 13px;
  cursor: pointer;
}
.antd-select-selector {
  display: flex;
  align-items: center;
  padding: 5px 11px;
  border-radius: 6px;
  border: 1px solid #d9d9d9;
  background: #fff;
  transition: all 0.2s;
  min-height: 32px;
}
.antd-select:hover .antd-select-selector { border-color: var(--blue); }
.antd-select--open .antd-select-selector { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(0,122,255,0.1); }
.antd-select-selection-item {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}
.antd-select-selection-placeholder { color: #bfbfbf }
.antd-select-arrow {
  color: #bfbfbf;
  font-size: 10px;
  margin-left: 4px;
  transition: transform 0.2s;
  flex-shrink: 0;
}
.antd-select--open .antd-select-arrow { transform: rotate(180deg) }
.antd-select-clear {
  display: none;
  color: #bfbfbf;
  margin-left: 4px;
  flex-shrink: 0;
}
.antd-select:hover .antd-select-clear { display: flex }
.antd-select:hover .antd-select-arrow { display: none }
.antd-select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.12);
  padding: 4px 0;
  z-index: 1000;
  max-height: 250px;
  overflow-y: auto;
}
.antd-select-item {
  padding: 5px 12px;
  color: var(--text);
  transition: background 0.1s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.antd-select-item:hover { background: rgba(0,0,0,0.04) }
.antd-select-item--selected { color: var(--blue); font-weight: 600; background: rgba(0,122,255,0.06) }
.dropdown-fade-enter-active, .dropdown-fade-leave-active { transition: opacity 0.15s, transform 0.15s }
.dropdown-fade-enter-from, .dropdown-fade-leave-to { opacity: 0; transform: translateY(-4px) }
.filter-input {
  width: 100%;
  padding: 6px 12px;
  border-radius: 7px;
  border: 1px solid var(--sep);
  background: rgba(255,255,255,0.6);
  font-size: 13px;
  color: var(--text-2);
  outline: none
}
.filter-input:focus { border-color: var(--blue) }
.filter-input::placeholder { color: var(--text-4) }
.filter-search-btn {
  width: 32px;
  height: 32px;
  border-radius: 7px;
  border: 1px solid var(--sep);
  background: rgba(255,255,255,0.6);
  color: var(--text-3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s
}
.filter-search-btn:hover { background: white; border-color: var(--blue); color: var(--blue) }
.filter-clear-btn {
  padding: 5px 14px;
  border-radius: 7px;
  border: 1px solid rgba(255,59,48,0.2);
  background: rgba(255,59,48,0.06);
  font-size: 13px;
  font-weight: 500;
  color: var(--red);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0
}
.filter-clear-btn:hover { background: rgba(255,59,48,0.12) }
.filter-date {
  padding: 5px 10px;
  border-radius: 7px;
  border: 1px solid var(--sep);
  background: rgba(255,255,255,0.6);
  font-size: 13px;
  color: var(--text-2);
  outline: none;
  width: 130px
}
.filter-date:focus { border-color: var(--blue) }
.filter-date-sep { font-size: 13px; color: var(--text-4) }

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
.gallery-overlay-icon { color: white; }

.gallery-card-info {
  padding: 10px 12px;
}
.gallery-count { margin-bottom: 5px; display: flex; align-items: center; gap: 6px; }
.pig-badge {
  font-size: 12px;
  font-weight: 700;
  background: rgba(52,199,89,0.1);
  border: 1px solid rgba(52,199,89,0.2);
  color: #34c759;
  border-radius: 6px;
  padding: 2px 8px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.gallery-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 4px;
}
.conf-badge {
  font-size: 11px;
  font-weight: 600;
  background: rgba(0, 122, 255, 0.08);
  border: 1px solid rgba(0, 122, 255, 0.18);
  color: var(--blue);
  border-radius: 6px;
  padding: 2px 6px;
  font-variant-numeric: tabular-nums;
}
.gallery-farm {
  font-size: 11px;
  color: var(--blue);
  font-weight: 500;
  white-space: nowrap;
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
.preview-panel-icon { color: var(--text-2); }
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

.preview-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

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
  cursor: pointer;
  position: relative
}
.preview-img-overlay {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: rgba(0,0,0,0.5);
  border-radius: 8px;
  color: white;
  font-size: 12px;
  font-weight: 500;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none
}
.preview-img-area:hover .preview-img-overlay { opacity: 1 }
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

/* ====== 全屏图片查看（复刻 ImagePreviewModal） ====== */
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
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(8px)
}
.preview-container {
  position: relative;
  width: 90vw;
  height: 85vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2)
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
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 50%;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s
}
.preview-close:hover {
  background: rgba(255,255,255,0.2);
  transform: scale(1.1)
}
.preview-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  height: 100%
}
.preview-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5)
}
.preview-info {
  display: flex;
  gap: 12px
}
.preview-badge {
  padding: 8px 16px;
  background: rgba(255,255,255,0.15);
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  backdrop-filter: blur(4px)
}

/* ====== 弹窗动画 ====== */
.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.3s ease;
}
.modal-fade-enter-active .preview-panel,
.modal-fade-leave-active .preview-panel,
.modal-fade-enter-active .preview-container,
.modal-fade-leave-active .preview-container {
  transition: transform 0.3s var(--spring);
}
.modal-fade-enter-from { opacity: 0; }
.modal-fade-leave-to   { opacity: 0; }
.modal-fade-enter-from .preview-panel,
.modal-fade-enter-from .preview-container { transform: scale(0.93) translateY(10px); }
.modal-fade-leave-to .preview-panel,
.modal-fade-leave-to .preview-container { transform: scale(0.93) translateY(10px); }

/* ====== 图表容器 ====== */
.chart-container {
  padding: 20px 24px 24px;
  height: 400px;
}

/* ====== 粒度选择器 ====== */
.view-tabs {
  display: flex;
  gap: 2px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  padding: 2px;
}

.view-tab {
  padding: 6px 14px;
  border-radius: 6px;
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  cursor: pointer;
  transition: all 0.15s;
}

.view-tab--active {
  background: white;
  color: var(--text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.view-tab:hover:not(.view-tab--active) {
  color: var(--text-2);
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

/* 自定义 Tooltip */
.custom-tooltip {
  position: fixed;
  transform: translateX(-50%) translateY(-100%);
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: tooltipIn 0.15s ease;
}
.custom-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.85);
}
@keyframes tooltipIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-100%) scale(0.95); }
  to { opacity: 1; transform: translateX(-50%) translateY(-100%) scale(1); }
}
</style>