<template>
  <div id="app" :class="{ 'has-result': hasResult }">
    <div class="ambient-wrap" aria-hidden="true">
      <div class="ambient-orb orb-1"></div>
      <div class="ambient-orb orb-2"></div>
      <div class="ambient-orb orb-3" :class="{ pulse: hasResult }"></div>
      <div class="ambient-grid"></div>
    </div>

    <nav class="topbar" :class="{ 'topbar--scrolled': scrolled }">
      <div class="topbar-inner">
        <div class="topbar-brand">
          <div class="brand-logo">
            <span class="brand-emoji">
              <img src="/icon/icon-48x48.png" alt="智慧猪群识别系统" />
            </span>
            <div class="brand-glow"></div>
          </div>
          <div class="brand-text">
            <span class="brand-name">智慧猪群识别系统</span>
            <span class="brand-tag">AI</span>
          </div>
          <div class="brand-sep"></div>
          <span class="brand-sub">v0.1</span>
        </div>

        <div class="service-pill" :class="serviceClass">
          <div class="service-dot"></div>
          <span>{{ serviceLabel }}</span>
          <button class="service-recheck" @click="checkServiceHealth" :disabled="checkingService">↺</button>
        </div>

        <!-- 猪场选择器 -->
        <div class="farm-selector">
          <div class="farm-select-wrap" ref="farmSelectWrap" @click="toggleFarmDropdown">
            <div class="farm-select" :class="{ 'farm-select--open': showFarmDropdown }">
              <span class="farm-select-value">
                {{ currentFarmName === '未选择' ? '请选择猪场' : currentFarmName }}
              </span>
              <span class="farm-select-arrow" :class="{ 'farm-select-arrow--open': showFarmDropdown }">▼</span>
            </div>
            <div class="farm-dropdown" v-if="showFarmDropdown">
              <div class="farm-dropdown-item" :class="{ 'farm-dropdown-item--active': selectedFarmId === null }"
                @click.stop="selectFarm(null)">
                <span class="farm-dropdown-item-icon">🏠</span>
                <span class="farm-dropdown-item-text">请选择猪场</span>
              </div>
              <div class="farm-dropdown-item" v-for="farm in farms" :key="farm.id"
                :class="{ 'farm-dropdown-item--active': selectedFarmId === farm.id }" @click.stop="selectFarm(farm.id)">
                <span class="farm-dropdown-item-icon">🏭</span>
                <span class="farm-dropdown-item-text">{{ farm.name }}</span>
              </div>
            </div>
          </div>
          <button class="btn-farm-manage" @click="showFarmModal = true" title="管理猪场">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
        </div>

        <div class="topbar-actions">
          <label class="btn-ghost" for="top-file-input">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            上传图片
          </label>
          <input id="top-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/bmp" style="display:none"
            multiple @change="onTopFileChange" />

          <button class="btn-primary"
            :disabled="!hasImage || !selectedFarmId || isAnalyzing || !$store.state.serviceOnline" @click="runAnalysis"
            ref="analyzeBtn" :title="getAnalyzeBtnTitle()">
            <span class="btn-primary-inner">
              <span v-if="isAnalyzing" class="btn-spinner"></span>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {{ isAnalyzing ? '识别中…' : '开始识别' }}
            </span>
            <div class="btn-shine"></div>
          </button>
          <span v-if="!selectedFarmId && hasImage" class="btn-hint btn-hint--warning">⚠️ 请先选择猪场</span>
          <span v-else-if="!$store.state.serviceOnline && hasImage" class="btn-hint btn-hint--error">⚠️ 服务离线，无法识别</span>

          <button v-if="hasImage && !isAnalyzing" class="btn-ghost btn-clear" @click="clearImage">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <router-link v-if="$route.path === '/'" to="/stats" class="btn-ghost" title="查看统计数据">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            统计页面
          </router-link>
          <router-link v-else-if="$route.path === '/stats'" to="/" class="btn-ghost" title="返回识别页面">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            识别页面
          </router-link>
        </div>
      </div>
      <div class="topbar-scan" v-if="isAnalyzing">
        <div class="topbar-scan-fill" :style="{ width: uploadProgress + '%' }"></div>
        <div class="topbar-scan-glow" :style="{ left: uploadProgress + '%' }"></div>
      </div>
    </nav>
    <transition name="capsule-drop">
      <div class="capsule-nav" v-show="scrolled">
        <div class="capsule-inner">


          <!-- 服务状态 -->
          <div class="service-pill" :class="serviceClass" style="padding:5px 11px;font-size:11px;">
            <div class="service-dot"></div>
            <span>{{ serviceLabel }}</span>
            <button class="service-recheck" @click="checkServiceHealth" :disabled="checkingService">↺</button>
          </div>
          <div class="capsule-sep"></div>

          <!-- 猪场选择 -->
          <div class="capsule-farm-wrap" ref="capsuleFarmWrap" @click="toggleFarmDropdown">
            <div class="capsule-farm">
               🏠{{ currentFarmName === '未选择' ? '请选择猪场' : currentFarmName }}
              <!-- <span class="farm-select-arrow" :class="{ 'farm-select-arrow--open': showFarmDropdown }"></span> -->
            </div>
            <!-- 复用已有的下拉菜单逻辑 -->
            <div class="farm-dropdown" v-if="showFarmDropdown">
              <div class="farm-dropdown-item" v-for="farm in farms" :key="farm.id"
                :class="{ 'farm-dropdown-item--active': selectedFarmId === farm.id }" @click.stop="selectFarm(farm.id)">
                <span class="farm-dropdown-item-icon">🏭</span>
                <span class="farm-dropdown-item-text">{{ farm.name }}</span>
              </div>
            </div>
          </div>


          <!-- 管理猪场 -->
          <button class="capsule-btn-ghost" @click="showFarmModal = true" title="管理猪场">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
          <div class="capsule-sep"></div>
          <!-- 上传图片，复用同一个 input -->
          <label class="capsule-btn-ghost" for="top-file-input" style="cursor:pointer;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            上传图片
          </label>

          <!-- 清除图片 -->
          <button v-if="hasImage && !isAnalyzing" class="capsule-btn-ghost capsule-btn-clear" @click="clearImage"
            title="清除图片">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <!-- 开始识别 -->
          <button class="capsule-btn-primary"
            :disabled="!hasImage || !selectedFarmId || isAnalyzing || !$store.state.serviceOnline" @click="runAnalysis"
            :title="getAnalyzeBtnTitle()">
            <span v-if="isAnalyzing" class="btn-spinner"></span>
            <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {{ isAnalyzing ? '识别中…' : '开始识别' }}
          </button>

          <!-- 统计页面跳转 -->
          <router-link v-if="$route.path === '/'" to="/stats" class="capsule-btn-ghost">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            统计
          </router-link>
          <router-link v-else-if="$route.path === '/stats'" to="/" class="capsule-btn-ghost">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            识别
          </router-link>

        </div>
      </div>
    </transition>
    <!-- 路由视图 -->
    <router-view v-if="$route.path !== '/'" />
    <div v-else class="page-wrap">
      <!-- 顶部信息行：猪场信息 + 系统统计 -->
      <div class="top-info-row">
        <!-- 当前猪场信息卡片 -->
        <div class="current-farm-section">
          <div class="farm-info-card glass-card" :class="{ 'farm-info-card--warning': !selectedFarmId }">
            <div v-if="!selectedFarmId" class="farm-warning-banner">
              <span class="farm-warning-icon">⚠️</span>
              <span class="farm-warning-text">请先在上方选择猪场，才能进行图片识别</span>
            </div>
            <div class="farm-info-header">
              <div class="farm-info-icon">🏭</div>
              <div class="farm-info-title">
                <span class="farm-info-label">当前猪场</span>
                <span class="farm-info-name" :class="{ 'farm-info-name--placeholder': !selectedFarmId }">{{
                  currentFarmName }}</span>
              </div>
            </div>
            <div class="farm-info-meta">
              <span v-if="selectedFarmId" class="farm-info-id">ID: {{ selectedFarmId }}</span>
              <span v-else class="farm-info-hint">未选择</span>
            </div>
          </div>
        </div>

        <!-- 系统统计信息卡片 -->
        <div class="system-stats-section">
          <div class="system-stats-card glass-card">
            <div class="system-stats-header">
              <span class="system-stats-icon">📊</span>
              <span class="system-stats-title">系统统计</span>
            </div>
            <div class="system-stats-grid">
              <div class="system-stat-item">
                <span class="system-stat-value">{{ systemStats.total_images || 0 }}</span>
                <span class="system-stat-label">识别图片总数</span>
              </div>
              <div class="system-stat-item">
                <span class="system-stat-value">{{ systemStats.total_pigs || 0 }}</span>
                <span class="system-stat-label">识别猪只总数</span>
              </div>
              <div class="system-stat-item">
                <span class="system-stat-value">{{ systemStats.today_images || 0 }}</span>
                <span class="system-stat-label">今日识别图片</span>
              </div>
              <div class="system-stat-item">
                <span class="system-stat-value">{{ systemStats.today_pigs || 0 }}</span>
                <span class="system-stat-label">今日识别猪只</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="stat-row">
        <div v-for="(card, i) in statCards" :key="i" class="stat-card glass-card"
          :class="{ 'stat-card--active': card.active }" :style="{ '--delay': (i * 60) + 'ms' }">
          <div class="stat-card-shimmer"></div>
          <div class="stat-icon-wrap"><span class="stat-icon">{{ card.icon }}</span></div>
          <div class="stat-body">
            <div class="stat-val">
              <span v-if="card.value !== null" class="stat-num" :class="card.cls">{{ i === 0 ? animatedCount :
                card.value }}</span>
              <span v-else class="stat-num stat-empty">—</span>
              <span v-if="card.unit" class="stat-unit">{{ card.unit }}</span>
            </div>
            <div class="stat-label">{{ card.label }}</div>
          </div>
          <div class="stat-card-border"></div>
        </div>
      </div>

      <div class="image-row">
        <div class="img-card glass-card" :class="{ floating: hasImage }">
          <div class="img-card-header">
            <div class="img-card-header-left">
              <span class="traffic-dot dot-yellow"></span>
              <span class="img-card-title">原图</span>
            </div>
            <div class="img-card-header-right">
              <transition name="meta-slide">
                <span class="img-card-chip" v-if="imageMeta">{{ imageMeta.name }}</span>
              </transition>
              <transition name="meta-slide">
                <span v-if="$store.state.imageFiles.length > 1" class="img-card-count">
                  {{ $store.state.currentImageIndex + 1 }}/{{ $store.state.imageFiles.length }}
                </span>
              </transition>
            </div>
          </div>
          <div class="img-card-body">
            <div class="dropzone" :class="{ 'dropzone--filled': hasImage, 'dropzone--drag': isDragging }"
              @dragover.prevent="isDragging = true" @dragleave="isDragging = false" @drop.prevent="onDrop"
              @click="!hasImage && $refs.dropInput.click()">
              <div class="dz-border-anim"></div>
              <transition name="img-fade">
                <img v-if="hasImage" :src="previewUrl" class="img-preview" alt="原图" key="img" />
                <div v-else class="dropzone-placeholder" key="ph">
                  <div class="dz-pig">🐷</div>
                  <p class="dz-title">拖拽或点击上传猪群图片</p>
                  <p class="dz-sub">JPG · PNG · WEBP · BMP &nbsp;·&nbsp; ≤ 10 MB</p>
                </div>
              </transition>
              <transition name="drag-fade">
                <div v-if="isDragging" class="drag-overlay">
                  <div class="drag-ring"></div>
                  <span>松开以上传</span>
                </div>
              </transition>
              <input ref="dropInput" type="file" accept="image/*" style="display:none" multiple
                @change="onDropInputChange" />
            </div>
            <transition name="meta-slide">
              <div class="img-meta-bar" v-if="imageMeta">
                <span>{{ imageMeta.size }}</span>
                <span class="meta-sep">·</span>
                <span>{{ imageMeta.width }} × {{ imageMeta.height }} px</span>
              </div>
            </transition>
          </div>
          <div v-if="$store.state.imageFiles.length > 1" class="img-navigation">
            <button class="nav-btn nav-btn-prev" @click="prevImage" title="上一张">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button class="nav-btn nav-btn-next" @click="nextImage" title="下一张">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>

        <div class="img-card glass-card result-img-card"
          :class="{ 'result-img-card--ready': hasResult, floating: hasImage }">
          <div class="img-card-header">
            <div class="img-card-header-left">
              <span class="traffic-dot" :class="hasResult ? 'dot-green' : 'dot-gray'"></span>
              <span class="img-card-title">标注结果</span>
            </div>
            <div class="img-card-header-right">
              <transition name="meta-slide">
                <span class="img-card-chip chip-green" v-if="hasResult">检测到 {{ $store.getters.currentPigCount }}
                  头猪</span>
              </transition>
              <transition name="meta-slide">
                <span v-if="$store.state.results.length > 1" class="img-card-count">
                  {{ $store.state.currentImageIndex + 1 }}/{{ $store.state.results.length }}
                </span>
              </transition>
            </div>
          </div>
          <div class="img-card-body">
            <div class="result-zone" :class="{ 'result-zone--active': hasResult }">
              <div class="canvas-wrap" v-if="hasImage" @click="openImagePreview"
                :class="{ 'canvas-wrap--clickable': hasResult }">
                <img :src="previewUrl" class="img-preview img-result-base" alt="result" ref="baseImg"
                  @load="onResultImgLoad" />
                <canvas ref="boxCanvas" class="box-canvas"></canvas>
                <transition name="overlay-fade">
                  <div class="result-overlay" v-if="!hasResult && !isAnalyzing">
                    <div class="overlay-content">
                      <div class="overlay-icon">✦</div>
                      <span>点击「开始识别」分析图片</span>
                    </div>
                  </div>
                </transition>
                <transition name="overlay-fade">
                  <div class="result-overlay result-overlay--scanning" v-if="isAnalyzing">
                    <div class="scan-line"></div>
                    <div class="scan-corners">
                      <span class="sc sc-tl"></span>
                      <span class="sc sc-tr"></span>
                      <span class="sc sc-bl"></span>
                      <span class="sc sc-br"></span>
                    </div>
                    <div class="scan-label">
                      <div class="scan-spinner"></div>
                      AI 扫描中…
                    </div>
                  </div>
                </transition>
              </div>
              <div v-else class="dropzone-placeholder result-placeholder">
                <div class="dz-pig" style="opacity:.7;font-size:36px">✦</div>
                <p class="dz-title" style="opacity:.85;color:#000">识别结果将在此展示</p>
              </div>
            </div>
            <transition name="meta-slide">
              <div class="img-meta-bar" v-if="hasResult && inferenceTime">
                <span>推理耗时 {{ inferenceTime }} ms</span>
                <span class="meta-sep">·</span>
                <span>置信度 <span :class="confClass">{{ confidencePct }}%</span></span>
              </div>
            </transition>
          </div>
          <div v-if="$store.state.results.length > 1" class="img-navigation">
            <button class="nav-btn nav-btn-prev" @click="prevImage" title="上一张">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button class="nav-btn nav-btn-next" @click="nextImage" title="下一张">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <transition name="section-rise">
        <div class="glass-card detail-card" v-if="hasResult">
          <div class="detail-header">
            <div class="detail-title-wrap">
              <div class="detail-pulse"></div>
              <span class="detail-title">检测明细</span>
            </div>
            <div class="detail-pills">
              <span class="detail-pill">共 {{ pigCount }} 头</span>
              <span class="detail-pill" :class="confClass">置信度 {{ confidencePct }}%</span>
            </div>
          </div>
          <div class="table-scroll">
            <table class="det-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>类别</th>
                  <th>置信度</th>
                  <th>坐标</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(box, i) in result.boxes" :key="i" class="det-row"
                  :class="{ 'det-row--hover': hoveredBox === i }" :style="{ '--row-delay': (i * 30) + 'ms' }"
                  @mouseenter="onRowHover(i)" @mouseleave="hoveredBox = null">
                  <td class="td-idx">{{ i + 1 }}</td>
                  <td><span class="cls-pill">{{ box.class_name === 'pig' ? '猪' : box.class_name }}</span></td>
                  <td>
                    <div class="conf-cell">
                      <div class="conf-track">
                        <div class="conf-fill" :class="getConfClass(box.score)"
                          :style="{ width: (box.score * 100) + '%' }">
                        </div>
                      </div>
                      <span class="conf-val" :class="getConfClass(box.score)">{{ (box.score * 100).toFixed(1) }}%</span>
                    </div>
                  </td>
                  <td class="td-coord">{{ formatCoord(box) }}</td>
                  <td>
                    <span class="status-chip" :class="box.score >= 0.7 ? 'chip-ok' : 'chip-warn'">{{ box.score >= 0.7 ?
                      '有效' : '低置信' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </transition>

      <LogPanel />

      <footer class="footer">
        <span class="footer-brand">智慧猪群识别系统</span>
        <span class="footer-dot">·</span>
        <span>Powered By 智能数猪大模型</span>
        <span class="footer-dot">·</span>
        <span>© {{ year }}</span>
      </footer>
    </div>

    <!-- 顶部提示栏 -->
    <transition name="toast-slide">
      <div v-if="showToast" class="toast-bar" :class="toastType">
        <div class="toast-content">
          <div class="toast-icon">{{ toastIcon }}</div>
          <div class="toast-message">{{ toastMessage }}</div>
          <div v-if="showToastProgress" class="toast-progress">
            <div class="toast-progress-fill" :style="{ width: toastProgress + '%' }"></div>
          </div>
        </div>
        <button v-if="toastType !== 'toast-info'" class="toast-close" @click="closeToast">×</button>
      </div>
    </transition>

    <!-- 猪场管理弹窗 -->
    <transition name="overlay-bloom">
      <div class="modal-backdrop farm-modal" v-if="showFarmModal" @click.self="closeFarmModal">
        <div class="modal-glass farm-modal-content">
          <div class="farm-modal-header">
            <h3>🏭 猪场管理</h3>
            <button class="btn-close" @click="closeFarmModal">×</button>
          </div>

          <!-- 添加新猪场 -->
          <div class="farm-add-section">
            <input v-model="newFarmName" type="text" class="farm-input" placeholder="输入新猪场名称" @keyup.enter="addFarm"
              maxlength="100" />
            <button class="btn-add-farm" @click="addFarm" :disabled="!newFarmName.trim() || isAddingFarm">
              <span v-if="isAddingFarm" class="btn-spinner-small"></span>
              <span v-else>+ 添加</span>
            </button>
          </div>

          <!-- 猪场列表 -->
          <div class="farm-list">
            <div v-if="farms.length === 0" class="farm-empty">
              暂无猪场，请添加
            </div>
            <div v-for="farm in farms" :key="farm.id" class="farm-item"
              :class="{ 'farm-item--editing': editingFarmId === farm.id }">
              <template v-if="editingFarmId === farm.id">
                <input v-model="editingFarmName" type="text" class="farm-input farm-input--edit"
                  @keyup.enter="saveEditFarm" @keyup.esc="cancelEditFarm" ref="editInput" maxlength="100" />
                <div class="farm-actions">
                  <button class="btn-farm-save" @click="saveEditFarm" title="保存">✓</button>
                  <button class="btn-farm-cancel" @click="cancelEditFarm" title="取消">✕</button>
                </div>
              </template>
              <template v-else>
                <span class="farm-name">{{ farm.name }}</span>
                <span class="farm-date">{{ formatFarmDate(farm.created_at) }}</span>
                <div class="farm-actions">
                  <button class="btn-farm-edit" @click="startEditFarm(farm)" title="编辑">✎</button>
                  <button class="btn-farm-delete" @click="deleteFarmById(farm.id)" title="删除">🗑</button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 图片预览模态框 -->
    <transition name="modal-fade">
      <div v-if="showImagePreview" class="image-preview-modal" @click="closeImagePreview">
        <div class="preview-backdrop"></div>
        <div class="preview-container" @click.stop>
          <button class="preview-close" @click="closeImagePreview" title="关闭">
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
  </div>
</template>

<script>
import LogPanel from '@/components/LogPanel.vue'
import { validateImage, fileToDataURL, getImageDimensions, formatFileSize } from '@/utils/imageUtils'
import { analyzeImage, checkHealth } from '@/api/pigModel'
import { getFarms, createFarm, updateFarm, deleteFarm } from '@/api/farmApi'
import { getDetectionStats } from '@/api/detectionApi'

export default {
  name: 'App',
  components: { LogPanel },
  data() {
    return {
      scrolled: false,
      checkingService: false,
      isDragging: false,
      hoveredBox: null,
      animatedCount: 0,
      showImagePreview: false,
      // 猪场相关数据
      farms: [],
      selectedFarmId: null,
      showFarmModal: false,
      newFarmName: '',
      isAddingFarm: false,
      editingFarmId: null,
      editingFarmName: '',
      // 系统统计数据
      systemStats: {
        total_images: 0,
        total_pigs: 0,
        today_images: 0,
        today_pigs: 0,
        avg_processing_time_ms: 0
      },
      // 自定义下拉状态
      showFarmDropdown: false,
      // 顶部提示栏
      showToast: false,
      toastMessage: '',
      toastType: 'toast-info', // toast-info, toast-error, toast-success
      toastIcon: 'ℹ️',
      showToastProgress: false,
      toastProgress: 0
    }
  },
  computed: {
    hasImage() { return this.$store.getters.hasImage },
    hasResult() { return this.$store.getters.hasResult },
    previewUrl() { return this.$store.state.previewUrl },
    imageMeta() { return this.$store.state.imageMeta },
    isAnalyzing() { return this.$store.state.isAnalyzing },
    uploadProgress() { return this.$store.state.uploadProgress },
    result() { return this.$store.state.result },
    pigCount() { return this.$store.getters.pigCount },
    confidencePct() { return this.$store.getters.confidencePct },
    inferenceTime() { return this.$store.getters.inferenceTime },
    annotatedImage() { return this.$store.state.result?.annotatedImage || null },
    year() { return new Date().getFullYear() },
    confClass() {
      const p = this.confidencePct
      if (p >= 85) return 'conf-high'
      if (p >= 65) return 'conf-mid'
      return 'conf-low'
    },
    serviceClass() {
      const s = this.$store.state.serviceOnline
      if (s === null) return 'service-unknown'
      return s ? 'service-online' : 'service-offline'
    },
    serviceLabel() {
      if (this.checkingService) return '检测中…'
      const s = this.$store.state.serviceOnline
      if (s === null) return '状态未知'
      return s ? '服务正常' : '离线 / Mock'
    },
    currentFarmName() {
      const farm = this.farms.find(f => f.id === this.selectedFarmId)
      return farm ? farm.name : '未选择'
    },
    statCards() {
      return [
        { icon: '🐷', label: '预测数量', value: this.hasResult ? this.pigCount : null, unit: this.hasResult ? '头' : null, cls: '', active: this.hasResult },
        { icon: '⚡', label: '处理耗时', value: this.inferenceTime, unit: this.inferenceTime ? 'ms' : null, cls: '', active: !!this.inferenceTime },
        { icon: '🎯', label: '平均置信度', value: this.hasResult ? this.confidencePct + '%' : null, unit: null, cls: this.confClass, active: this.hasResult },
        { icon: '🐖', label: '当次识别总数', value: this.$store.state.totalPigs, unit: '头', cls: '', active: this.$store.state.totalPigs !== null }
      ]
    }
  },
  watch: {
    pigCount(val) { if (val === null) { this.animatedCount = 0; return } this.animateNumber(val) },
    hasResult(val) { if (val) this.$nextTick(() => this.drawBoxesAnimated()) },
    '$route.path'(newPath) {
      // 当路由切换到主页面，且autoAnalyze为true时，自动执行识别操作
      if (newPath === '/' && this.$store.state.autoAnalyze) {
        // 重置autoAnalyze标志
        this.$store.commit('SET_AUTO_ANALYZE', false)
        // 延迟执行，确保页面完全加载
        setTimeout(() => {
          this.runAnalysis()
        }, 500)
      }
    }
  },
  created() { this.checkServiceHealth() },
  mounted() {
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('click', this.handleClickOutside)

    const scroller = document.querySelector('.page-wrap') // 或其他容器
    this._scroller = scroller || window
    this._scroller.addEventListener('scroll', this.onScroll)
    window.addEventListener('scroll', this.onScroll)
  },
  beforeDestroy() {
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('click', this.handleClickOutside)
    this._scroller.removeEventListener('scroll', this.onScroll)
  },
  methods: {
    onScroll() {
      this.scrolled = window.scrollY > 80
    },
    toggleFarmDropdown() {
      this.showFarmDropdown = !this.showFarmDropdown
    },
    handleClickOutside(e) {
      const wrap = this.$refs.farmSelectWrap
      const capsuleWrap = this.$refs.capsuleFarmWrap
      if (
        wrap && !wrap.contains(e.target) &&
        (!capsuleWrap || !capsuleWrap.contains(e.target))
      ) {
        this.showFarmDropdown = false
      }
    },
    selectFarm(farmId) {
      this.selectedFarmId = farmId
      this.showFarmDropdown = false
      this.onFarmChange()
    },
    onKeyDown(e) {
      if (e.key === 'Escape' && this.showImagePreview) {
        this.closeImagePreview()
      }
    },
    getAnalyzeBtnTitle() {
      if (!this.selectedFarmId) return '请先选择猪场'
      if (!this.$store.state.serviceOnline) return '后端服务离线，请检查服务状态'
      return ''
    },
    onMouseMove(e) {
      const mx = e.clientX / window.innerWidth - 0.5
      const my = e.clientY / window.innerHeight - 0.5
      const o1 = document.querySelector('.orb-1')
      const o2 = document.querySelector('.orb-2')
      if (o1) o1.style.transform = 'translate(' + (mx * 30) + 'px,' + (my * 30) + 'px)'
      if (o2) o2.style.transform = 'translate(' + (-mx * 20) + 'px,' + (-my * 20) + 'px)'
    },

    openImagePreview() {
      if (this.hasResult && this.annotatedImage) {
        this.showImagePreview = true
        document.body.style.overflow = 'hidden'
      }
    },
    closeImagePreview() {
      this.showImagePreview = false
      document.body.style.overflow = ''
    },
    showToastMessage(message, type = 'toast-info', duration = 3000) {
      this.toastMessage = message
      this.toastType = type
      this.toastIcon = type === 'toast-info' ? 'ℹ️' : type === 'toast-error' ? '⚠️' : '✅'
      this.showToast = true
      this.showToastProgress = false

      // 延长错误提示的显示时间
      if (type === 'toast-error') {
        duration = 6000 // 错误提示显示6秒
      }

      if (duration > 0) {
        setTimeout(() => this.closeToast(), duration)
      }
    },
    showToastWithProgress(message, type = 'toast-info') {
      this.toastMessage = message
      this.toastType = type
      this.toastIcon = type === 'toast-info' ? 'ℹ️' : type === 'toast-error' ? '⚠️' : '✅'
      this.showToast = true
      this.showToastProgress = true
      this.toastProgress = 0
    },
    updateToastProgress(progress) {
      this.toastProgress = progress
    },
    closeToast() {
      this.showToast = false
    },
    // 图片导航方法
    prevImage() {
      const currentIndex = this.$store.state.currentImageIndex
      const totalImages = this.$store.state.imageFiles.length
      if (totalImages > 0) {
        const newIndex = (currentIndex - 1 + totalImages) % totalImages
        this.$store.commit('SET_CURRENT_IMAGE_INDEX', newIndex)
      }
    },
    nextImage() {
      const currentIndex = this.$store.state.currentImageIndex
      const totalImages = this.$store.state.imageFiles.length
      if (totalImages > 0) {
        const newIndex = (currentIndex + 1) % totalImages
        this.$store.commit('SET_CURRENT_IMAGE_INDEX', newIndex)
      }
    },
    onTopFileChange(e) {
      const files = Array.from(e.target.files);
      if (files.length > 0) this.processFiles(files);
      e.target.value = ''
    },
    onDropInputChange(e) {
      const files = Array.from(e.target.files);
      if (files.length > 0) this.processFiles(files);
      e.target.value = ''
    },
    onDrop(e) {
      this.isDragging = false;
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length > 0) this.processFiles(files);
    },
    async processFiles(files) {
      // 验证所有文件
      for (const file of files) {
        const { valid, error } = validateImage(file);
        if (!valid) {
          this.$store.commit('ADD_LOG', { msg: `文件 ${file.name} 验证失败：${error}`, type: 'error' });
          return;
        }
      }

      // 处理所有文件
      const previewUrls = [];
      const metas = [];

      for (const file of files) {
        const dataURL = await fileToDataURL(file);
        const dim = await getImageDimensions(dataURL);
        const meta = { name: file.name, size: formatFileSize(file.size), width: dim.width, height: dim.height };
        previewUrls.push(dataURL);
        metas.push(meta);
        this.$store.commit('ADD_LOG', { msg: '已加载：' + file.name + '（' + meta.size + '，' + meta.width + '×' + meta.height + '）', type: 'info' });
      }

      this.$store.commit('SET_IMAGES', { files, previewUrls, metas });
    },
    async processFile(file) {
      const { valid, error } = validateImage(file);
      if (!valid) {
        this.$store.commit('ADD_LOG', { msg: error, type: 'error' });
        return;
      }
      const dataURL = await fileToDataURL(file);
      const dim = await getImageDimensions(dataURL);
      const meta = { name: file.name, size: formatFileSize(file.size), width: dim.width, height: dim.height };
      this.$store.commit('SET_IMAGE', { file, previewUrl: dataURL, meta });
      this.$store.commit('ADD_LOG', { msg: '已加载：' + file.name + '（' + meta.size + '，' + meta.width + '×' + meta.height + '）', type: 'info' });
    },
    clearImage() {
      this.$store.commit('CLEAR_IMAGE')
      this.$store.commit('ADD_LOG', { msg: '已清除图片', type: 'info' })
      this.clearCanvas()
    },
    async runAnalysis() {
      // 检查是否在StatsPage页面
      if (this.$route.path === '/stats') {
        // 设置自动执行识别的标志
        this.$store.commit('SET_AUTO_ANALYZE', true)
        // 跳转到主页面
        this.$router.push('/')
        return
      }

      if (!this.hasImage || this.isAnalyzing || !this.selectedFarmId) return
      if (!this.$store.state.serviceOnline) {
        this.$store.commit('ADD_LOG', { msg: '⚠️ 后端服务离线，无法识别图片', type: 'error' })
        this.showToastMessage('后端服务离线，无法识别图片', 'toast-error', 4000)
        return
      }
      const btn = this.$refs.analyzeBtn
      if (btn) { btn.style.transform = 'scale(0.93)'; setTimeout(() => { btn.style.transform = '' }, 150) }
      this.$store.commit('SET_ANALYZING', true)
      this.$store.commit('SET_PROGRESS', 0)

      const imageFiles = this.$store.state.imageFiles.length > 0 ? this.$store.state.imageFiles : [this.$store.state.imageFile]
      this.$store.commit('ADD_LOG', { msg: `发送 ${imageFiles.length} 张图片至数猪大模型…`, type: 'info' })

      // 显示带进度的顶部提示栏
      this.showToastWithProgress('正在识别图片...', 'toast-info')

      try {
        const result = await analyzeImage(imageFiles, (p) => {
          this.$store.commit('SET_PROGRESS', p)
          this.updateToastProgress(p)
        }, this.selectedFarmId)

        // 处理批量结果
        if (result.totalImages) {
          this.$store.commit('SET_RESULTS', { results: result.results, totalPigs: result.totalPigs })
          this.$store.commit('SET_PROGRESS', 100)
          this.updateToastProgress(100)

          // 显示识别成功提示
          setTimeout(() => {
            this.showToastMessage(`识别完成：${result.totalImages} 张图片，共检测到 ${result.totalPigs} 头猪`, 'toast-success', 3000)
          }, 500)

          this.$store.commit('ADD_LOG', { msg: `识别完成：${result.totalImages} 张图片，共检测到 ${result.totalPigs} 头猪`, type: 'success' })
          result.results.forEach((r, index) => {
            this.$store.commit('ADD_LOG', { msg: `图片 ${index + 1}：检测到 ${r.count} 头猪，置信度 ${Math.round(r.confidence * 100)}%，耗时 ${r.inferenceTime}ms`, type: 'success' })
          })
        } else {
          // 处理单张结果
          this.$store.commit('SET_RESULT', result)
          this.$store.commit('SET_PROGRESS', 100)
          this.updateToastProgress(100)

          // 显示识别成功提示
          setTimeout(() => {
            this.showToastMessage(`识别完成：检测到 ${result.count} 头猪`, 'toast-success', 3000)
          }, 500)

          this.$store.commit('ADD_LOG', { msg: '识别完成：检测到 ' + result.count + ' 头猪', type: 'success' })
          this.$store.commit('ADD_LOG', { msg: '置信度 ' + Math.round(result.confidence * 100) + '%' + (result.inferenceTime ? '  耗时 ' + result.inferenceTime + 'ms' : ''), type: 'success' })
        }

        // 识别成功后刷新统计数据
        await this.loadDetectionStats()
      } catch (err) {
        this.$store.commit('ADD_LOG', { msg: '识别失败：' + err.message, type: 'error' })
        this.showToastMessage('识别失败：' + err.message, 'toast-error', 4000)
      } finally {
        this.$store.commit('SET_ANALYZING', false)
        // 延迟关闭提示栏，让用户看到完成状态
        setTimeout(() => this.closeToast(), 1000)
      }
    },
    onResultImgLoad() { if (this.hasResult) this.drawBoxesAnimated() },
    drawBoxesAnimated() {
      const canvas = this.$refs.boxCanvas
      const img = this.$refs.baseImg
      if (!canvas || !img || !this.hasResult) return
      const boxes = this.result && this.result.boxes ? this.result.boxes : []
      canvas.width = img.clientWidth; canvas.height = img.clientHeight
      const ctx = canvas.getContext('2d')
      let prog = 0; const total = 60
      const draw = () => {
        prog++
        const t = Math.min(prog / total, 1)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        boxes.forEach((box, i) => {
          const bd = i / boxes.length * 0.4
          const lt = Math.max(0, Math.min(1, (t - bd) / 0.6))
          if (lt <= 0) return
          const c = this.resolveCoords(box, canvas)
          const w = c.x2 - c.x1; const h = c.y2 - c.y1
          const isH = this.hoveredBox === i
          const col = isH ? 'rgba(255,149,0,' + lt + ')' : 'rgba(52,199,89,' + lt + ')'
          ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = isH ? 2.5 : 1.8
          ctx.shadowColor = col; ctx.shadowBlur = isH ? 10 : 5; ctx.globalAlpha = lt
          ctx.strokeRect(c.x1, c.y1, w, h); ctx.restore()
          if (lt > 0.6) {
            const la = (lt - 0.6) / 0.4
            ctx.save(); ctx.globalAlpha = la
            const label = (i + 1) + '  ' + (box.score * 100).toFixed(0) + '%'
            ctx.font = 'bold 11px -apple-system,monospace'
            const tw = ctx.measureText(label).width
            ctx.fillStyle = isH ? 'rgba(255,149,0,0.88)' : 'rgba(52,199,89,0.88)'
            ctx.beginPath(); ctx.roundRect(c.x1, c.y1 - 22, tw + 12, 20, 4); ctx.fill()
            ctx.fillStyle = '#fff'; ctx.fillText(label, c.x1 + 6, c.y1 - 7); ctx.restore()
          }
        })
        if (prog < total) requestAnimationFrame(draw)
      }
      requestAnimationFrame(draw)
    },
    clearCanvas() { const c = this.$refs.boxCanvas; if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height) },
    resolveCoords(box, canvas) {
      const isN = box.x1 <= 1 && box.y1 <= 1
      const sw = canvas.width; const sh = canvas.height
      const mw = (this.imageMeta && this.imageMeta.width) || 1
      const mh = (this.imageMeta && this.imageMeta.height) || 1
      if (isN) return { x1: box.x1 * sw, y1: box.y1 * sh, x2: (box.x1 + box.x2) * sw, y2: (box.y1 + box.y2) * sh }
      return { x1: box.x1 / mw * sw, y1: box.y1 / mh * sh, x2: box.x2 / mw * sw, y2: box.y2 / mh * sh }
    },
    onRowHover(i) { this.hoveredBox = i; this.$nextTick(() => this.drawBoxesAnimated()) },
    animateNumber(target) {
      const dur = 800; const start = Date.now()
      const tick = () => {
        const t = Math.min((Date.now() - start) / dur, 1)
        this.animatedCount = Math.round(target * (1 - Math.pow(1 - t, 4)))
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    },
    getConfClass(score) { if (score >= 0.85) return 'conf-high'; if (score >= 0.65) return 'conf-mid'; return 'conf-low' },
    formatCoord(box) {
      const isN = box.x1 <= 1 && box.y1 <= 1
      const w = (this.imageMeta && this.imageMeta.width) || 1
      const h = (this.imageMeta && this.imageMeta.height) || 1
      if (isN) return Math.round(box.x1 * w) + ', ' + Math.round(box.y1 * h) + ', ' + Math.round((box.x1 + box.x2) * w) + ', ' + Math.round((box.y1 + box.y2) * h)
      return Math.round(box.x1) + ', ' + Math.round(box.y1) + ', ' + Math.round(box.x2) + ', ' + Math.round(box.y2)
    },
    async checkServiceHealth() {
      this.checkingService = true
      try {
        const online = await checkHealth()
        this.$store.commit('SET_SERVICE_STATUS', online)
        this.$store.commit('ADD_LOG', { msg: online ? '服务在线' : '服务未响应（Mock 模式）', type: online ? 'success' : 'warn' })
        // 服务在线时加载猪场列表和统计数据
        if (online) {
          await this.loadFarms()
          await this.loadDetectionStats()
        }
      } catch { this.$store.commit('SET_SERVICE_STATUS', false) }
      finally { this.checkingService = false }
    },

    // ========== 统计数据方法 ==========
    async loadDetectionStats() {
      try {
        const response = await getDetectionStats(this.selectedFarmId)
        if (response.success) {
          this.systemStats = response.data
        }
      } catch (err) {
        console.error('加载统计数据失败:', err)
      }
    },

    // ========== 猪场管理方法 ==========
    async loadFarms() {
      try {
        const response = await getFarms()
        if (response.success) {
          this.farms = response.data
          this.$store.commit('ADD_LOG', { msg: `已加载 ${this.farms.length} 个猪场`, type: 'info' })

          // 检查是否没有养殖场，第一次使用时提示
          if (this.farms.length === 0) {
            this.showToastMessage('第一次使用请先创建养殖场！', 'toast-info', 5000)
          }
        }
      } catch (err) {
        this.$store.commit('ADD_LOG', { msg: '加载猪场列表失败：' + err.message, type: 'error' })
      }
    },
    async onFarmChange() {
      const farm = this.farms.find(f => f.id === this.selectedFarmId)
      if (farm) {
        this.$store.commit('ADD_LOG', { msg: `已选择猪场：${farm.name}`, type: 'info' })
      }
      // 切换猪场后刷新统计数据
      await this.loadDetectionStats()
    },
    closeFarmModal() {
      this.showFarmModal = false
      this.newFarmName = ''
      this.editingFarmId = null
      this.editingFarmName = ''
    },
    async addFarm() {
      const name = this.newFarmName.trim()
      if (!name) return
      this.isAddingFarm = true
      try {
        const response = await createFarm(name)
        if (response.success) {
          this.farms.unshift(response.data)
          this.newFarmName = ''
          this.$store.commit('ADD_LOG', { msg: `成功添加猪场：${response.data.name}`, type: 'success' })
        }
      } catch (err) {
        this.$store.commit('ADD_LOG', { msg: '添加猪场失败：' + err.message, type: 'error' })
      } finally {
        this.isAddingFarm = false
      }
    },
    startEditFarm(farm) {
      this.editingFarmId = farm.id
      this.editingFarmName = farm.name
      this.$nextTick(() => {
        const input = this.$refs.editInput
        if (input && input[0]) input[0].focus()
      })
    },
    cancelEditFarm() {
      this.editingFarmId = null
      this.editingFarmName = ''
    },
    async saveEditFarm() {
      const name = this.editingFarmName.trim()
      if (!name || name === this.farms.find(f => f.id === this.editingFarmId)?.name) {
        this.cancelEditFarm()
        return
      }
      try {
        const response = await updateFarm(this.editingFarmId, name)
        if (response.success) {
          const index = this.farms.findIndex(f => f.id === this.editingFarmId)
          if (index !== -1) {
            this.farms.splice(index, 1, response.data)
          }
          this.$store.commit('ADD_LOG', { msg: `成功更新猪场：${response.data.name}`, type: 'success' })
        }
      } catch (err) {
        this.$store.commit('ADD_LOG', { msg: '更新猪场失败：' + err.message, type: 'error' })
      } finally {
        this.editingFarmId = null
        this.editingFarmName = ''
      }
    },
    async deleteFarmById(farmId) {
      const farm = this.farms.find(f => f.id === farmId)
      if (!farm) return
      if (!confirm(`确定要删除猪场"${farm.name}"吗？`)) return
      try {
        const response = await deleteFarm(farmId)
        if (response.success) {
          this.farms = this.farms.filter(f => f.id !== farmId)
          if (this.selectedFarmId === farmId) {
            this.selectedFarmId = null
          }
          this.$store.commit('ADD_LOG', { msg: `成功删除猪场：${farm.name}`, type: 'success' })
        }
      } catch (err) {
        this.$store.commit('ADD_LOG', { msg: '删除猪场失败：' + err.message, type: 'error' })
      }
    },
    formatFarmDate(dateStr) {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    }
  }
}
</script>

<style>
:root {
  --bg: #f2f2f7;
  --bg-2: #ffffff;
  --glass-bg: rgba(255, 255, 255, 0.65);
  --glass-border: rgba(255, 255, 255, 0.88);
  --glass-shadow: 0 2px 20px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04);
  --glass-hover: 0 8px 40px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.05);
  --text: #1c1c1e;
  --text-2: #3a3a3c;
  --text-3: #6e6e73;
  --text-4: #aeaeb2;
  --sep: rgba(60, 60, 67, 0.12);
  --sep-opaque: #d1d1d6;
  --blue: #007aff;
  --green: #34c759;
  --orange: #ff9500;
  --red: #ff3b30;
  --pig: #ff6b81;
  --r-sm: 10px;
  --r-md: 16px;
  --r-lg: 20px;
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0
}

html {
  font-size: 16px
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden
}

#app {
  position: relative;
  min-height: 100vh
}

.ambient-wrap {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden
}

.ambient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  transition: transform 1.2s var(--ease-out)
}

.orb-1 {
  width: 600px;
  height: 600px;
  top: -200px;
  left: -100px;
  background: radial-gradient(circle, rgba(255, 107, 129, 0.28) 0%, rgba(255, 149, 0, 0.12) 60%, transparent 100%)
}

.orb-2 {
  width: 500px;
  height: 500px;
  bottom: -150px;
  right: -100px;
  background: radial-gradient(circle, rgba(0, 122, 255, 0.18) 0%, rgba(88, 86, 214, 0.10) 60%, transparent 100%)
}

.orb-3 {
  width: 400px;
  height: 400px;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(52, 199, 89, 0.14) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 1.5s ease
}

.orb-3.pulse {
  opacity: 0.6;
  animation: orbPulse 4s ease-in-out infinite
}

@keyframes orbPulse {

  0%,
  100% {
    transform: translate(-50%, -50%) scale(1)
  }

  50% {
    transform: translate(-50%, -50%) scale(1.15)
  }
}

.ambient-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(0, 0, 0, 0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.018) 1px, transparent 1px);
  background-size: 48px 48px
}

.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--glass-border);
  border-radius: var(--r-lg);
  box-shadow: var(--glass-shadow);
  transition: box-shadow 0.35s var(--ease-out), transform 0.35s var(--ease-out);
  position: relative;
  overflow: hidden
}

/* 图片卡片动画 */
.img-card {
  animation: sectionIn 0.3s var(--ease-out) 0.4s both;
}

/* 结果卡片动画 */
.result-img-card {
  animation: sectionIn 0.3s var(--ease-out) 0.5s both;
}

/* 检测明细卡片动画 */
.detail-card {
  animation: sectionIn 0.3s var(--ease-out) 0.6s both;
}

.glass-card:hover {
  box-shadow: var(--glass-hover)
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 200;
  background: rgba(242, 242, 247, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid var(--sep);
  transition: opacity 0.3s ease;
}

.topbar--scrolled {
  opacity: 0;
  pointer-events: none;
}

.topbar-inner {
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 28px;
  height: 58px;
  display: flex;
  align-items: center;
  gap: 14px
}

.topbar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-right: 4px
}

.brand-logo {
  position: relative;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 9px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)
}

.brand-emoji {
  font-size: 19px;
  line-height: 1
}

.brand-glow {
  position: absolute;
  inset: -4px;
  border-radius: 13px;
  background: radial-gradient(circle, rgba(255, 107, 129, 0.2) 0%, transparent 70%);
  animation: brandGlow 3s ease-in-out infinite
}

@keyframes brandGlow {

  0%,
  100% {
    opacity: 0.5
  }

  50% {
    opacity: 1
  }
}

.brand-text {
  display: flex;
  align-items: baseline;
  gap: 3px
}

.brand-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--text)
}

.brand-tag {
  font-size: 10px;
  font-weight: 600;
  color: var(--blue);
  letter-spacing: 0.04em
}

.brand-sep {
  width: 1px;
  height: 18px;
  background: var(--sep-opaque);
  margin: 0 4px
}

.brand-sub {
  font-size: 12px;
  color: var(--text-3)
}

.capsule-nav {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
}

.capsule-inner {
  overflow: visible;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(28px) saturate(200%);
  -webkit-backdrop-filter: blur(28px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.92);
  border-radius: 100px;
  box-shadow: 0 6px 32px rgba(0, 0, 0, 0.12), 0 1px 6px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.85);
  white-space: nowrap;
}

.capsule-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.capsule-name {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: var(--text);
}

.capsule-sep {
  width: 1px;
  height: 20px;
  background: var(--sep);
  flex-shrink: 0;
}

.capsule-farm-wrap {
  position: relative;
}
.capsule-farm-wrap .farm-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  /* 固定最小宽度，撑开到与原版一致 */
  min-width: 200px;
  width: max-content;
  /* 重置被胶囊容器继承的属性 */
  white-space: normal;
  font-size: 13px;
  font-weight: 400;
  /* 确保层级高于其他胶囊元素 */
  z-index: 1100;
}

.capsule-farm-wrap .farm-dropdown-item {
  padding: 12px 14px;
  font-size: 13px;
  font-weight: 500;
}

.capsule-farm-wrap .farm-dropdown-item-icon {
  font-size: 18px;
}

.capsule-farm-wrap .farm-dropdown-item-text {
  font-size: 13px;
}

.capsule-farm {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  background: rgba(0, 0, 0, 0.04);
  border-radius: 20px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;
}

.capsule-farm:hover {
  background: rgba(0, 0, 0, 0.08);
}

.capsule-btn-ghost {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  background: rgba(0, 0, 0, 0.04);
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  text-decoration: none;
}

.capsule-btn-ghost:hover {
  background: rgba(0, 0, 0, 0.08);
}

.capsule-btn-clear:hover {
  background: rgba(255, 59, 48, 0.08);
  color: var(--red);
}

.capsule-btn-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  background: var(--blue);
  color: white;
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 122, 255, 0.35);
  transition: all 0.2s ease;
}

.capsule-btn-primary:hover:not(:disabled) {
  background: #0071f3;
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 122, 255, 0.45);
}

.capsule-btn-primary:disabled {
  background: var(--sep-opaque);
  color: var(--text-4);
  box-shadow: none;
  cursor: not-allowed;
}

/* 入场动画 */
.capsule-drop-enter-active {
  transition: transform 0.5s cubic-bezier(0.34, 1.35, 0.64, 1), opacity 0.3s ease;
}

.capsule-drop-leave-active {
  transition: transform 0.28s ease, opacity 0.22s ease;
}

.capsule-drop-enter-from,
.capsule-drop-leave-to {
  transform: translateX(-50%) translateY(-64px);
  opacity: 0;
}

.capsule-drop-enter-to,
.capsule-drop-leave-from {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}

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

  0%,
  100% {
    opacity: 1
  }

  50% {
    opacity: 0.4
  }
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

.topbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px
}

.btn-ghost {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--r-sm);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid var(--sep);
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none
}

.btn-ghost:hover {
  background: white;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  color: var(--text)
}

.btn-primary {
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;
  padding: 7px 18px;
  border-radius: var(--r-sm);
  background: var(--blue);
  color: white;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s var(--spring);
  box-shadow: 0 2px 12px rgba(0, 122, 255, 0.35)
}

.btn-primary:hover:not(:disabled) {
  background: #0071f3;
  box-shadow: 0 4px 20px rgba(0, 122, 255, 0.45);
  transform: translateY(-1px)
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.96)
}

.btn-primary:disabled {
  background: var(--sep-opaque);
  color: var(--text-4);
  box-shadow: none;
  cursor: not-allowed
}

.btn-hint {
  font-size: 12px;
  font-weight: 500;
  color: var(--orange);
  margin-left: 8px;
  animation: pulse 2s infinite
}

.btn-hint--error {
  color: #ff3b30;
  font-weight: 600;
  background: rgba(255, 59, 48, 0.08);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 59, 48, 0.2)
}

.btn-hint--warning {
  color: #ff9500;
  font-weight: 600;
  background: rgba(255, 149, 0, 0.08);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 149, 0, 0.2)
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1
  }

  50% {
    opacity: 0.6
  }
}

.btn-primary-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  z-index: 1
}

.btn-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
  transform: skewX(-20deg);
  transition: left 0.5s ease
}

.btn-primary:hover .btn-shine {
  left: 150%
}

.btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite
}

.btn-clear {
  width: 34px;
  height: 34px;
  padding: 0;
  justify-content: center;
  border-radius: 8px
}

.btn-clear:hover {
  background: rgba(255, 59, 48, 0.08);
  border-color: rgba(255, 59, 48, 0.2);
  color: var(--red)
}

.topbar-scan {
  height: 2px;
  background: var(--sep);
  position: relative;
  overflow: visible
}

.topbar-scan-fill {
  height: 100%;
  background: var(--blue);
  transition: width 0.3s ease;
  border-radius: 1px
}

.topbar-scan-glow {
  position: absolute;
  top: -3px;
  width: 24px;
  height: 8px;
  background: radial-gradient(circle, var(--blue), transparent);
  transform: translateX(-50%);
  transition: left 0.3s ease;
  filter: blur(3px)
}

.page-wrap {
  max-width: 1440px;
  margin: 0 auto;
  padding: 28px 28px 80px;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 18px
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  animation: rowReveal 0.5s var(--ease-out) both
}

@media(max-width:900px) {
  .stat-row {
    grid-template-columns: repeat(2, 1fr)
  }
}

@keyframes rowReveal {
  from {
    opacity: 0;
    transform: translateY(12px)
  }

  to {
    opacity: 1;
    transform: none
  }
}

.stat-card {
  padding: 20px 22px;
  cursor: default;
  animation: cardReveal 0.3s var(--ease-out) calc(0.3s + var(--delay, 0ms)) both
}

@keyframes cardReveal {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.97)
  }

  to {
    opacity: 1;
    transform: none
  }
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

/* .stat-card--active .stat-card-border {
  border-color: rgba(255, 107, 129, 0.22)
} */

.stat-icon-wrap {
  margin-bottom: 12px
}

.stat-icon {
  font-size: 22px;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.08))
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

.image-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px
}

@media(max-width:720px) {
  .image-row {
    grid-template-columns: 1fr
  }
}

.img-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--sep)
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
}

.traffic-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0
}

.dot-yellow {
  background: #ffbd44
}

.dot-green {
  background: var(--green);
  box-shadow: 0 0 6px rgba(52, 199, 89, 0.45)
}

.dot-gray {
  background: var(--sep-opaque)
}

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
  padding: 3px 8px;
}

.chip-green {
  background: rgba(52, 199, 89, 0.1);
  border-color: rgba(52, 199, 89, 0.25);
  color: var(--green)
}

.img-card-body {
  padding: 14px
}

/* 图片导航 */
.img-navigation {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 10;
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.nav-btn:hover {
  background: white;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.nav-btn svg {
  width: 16px;
  height: 16px;
  color: var(--text-2);
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

.dropzone {
  width: 100%;
  aspect-ratio: 16/10;
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
  cursor: default
}

.img-preview {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block
}

.dropzone-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px;
  text-align: center;
  position: relative
}

.dz-pig {
  font-size: 44px;
  animation: pigFloat 4s ease-in-out infinite
}

@keyframes pigFloat {

  0%,
  100% {
    transform: translateY(0) rotate(-3deg)
  }

  50% {
    transform: translateY(-8px) rotate(3deg)
  }
}

.dz-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2)
}

.dz-sub {
  font-size: 11px;
  color: var(--text-4)
}

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

.dropzone:hover:not(.dropzone--filled) .dz-border-anim {
  opacity: 1
}

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

  0%,
  100% {
    transform: scale(0.9);
    opacity: 0.3
  }

  50% {
    transform: scale(1.1);
    opacity: 0.8
  }
}

.img-meta-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 2px 0;
  font-size: 11px;
  color: var(--text-4)
}

.meta-sep {
  color: var(--sep-opaque)
}

.result-zone {
  width: 100%;
  aspect-ratio: 16/10;
  border-radius: var(--r-md);
  position: relative;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.02);
  border: 1.5px solid var(--sep);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.4s ease
}

.result-zone--active {
  border-color: rgba(52, 199, 89, 0.3)
}

.canvas-wrap {
  width: 100%;
  height: 100%;
  position: relative
}

.canvas-wrap .img-preview {
  width: 100%;
  height: 100%;
  object-fit: contain
}

.box-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none
}

.result-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(6px)
}

.result-overlay--scanning {
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(2px)
}

.overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-3);
  font-weight: 500
}

.overlay-icon {
  font-size: 28px;
  opacity: 0.25;
  animation: iconBreath 3s ease-in-out infinite
}

@keyframes iconBreath {

  0%,
  100% {
    opacity: 0.15;
    transform: scale(0.95)
  }

  50% {
    opacity: 0.35;
    transform: scale(1.05)
  }
}

.result-placeholder {
  opacity: 0.35
}

.scan-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--green), transparent);
  box-shadow: 0 0 12px var(--green);
  animation: scanLine 1.8s ease-in-out infinite
}

@keyframes scanLine {
  0% {
    top: 0%
  }

  100% {
    top: 100%
  }
}

.scan-corners {
  position: absolute;
  inset: 12px
}

.sc {
  position: absolute;
  width: 16px;
  height: 16px;
  border-color: var(--green);
  border-style: solid
}

.sc-tl {
  top: 0;
  left: 0;
  border-width: 2px 0 0 2px;
  border-radius: 3px 0 0 0
}

.sc-tr {
  top: 0;
  right: 0;
  border-width: 2px 2px 0 0;
  border-radius: 0 3px 0 0
}

.sc-bl {
  bottom: 0;
  left: 0;
  border-width: 0 0 2px 2px;
  border-radius: 0 0 0 3px
}

.sc-br {
  bottom: 0;
  right: 0;
  border-width: 0 2px 2px 0;
  border-radius: 0 0 3px 0
}

.scan-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--green);
  font-weight: 600;
  letter-spacing: 0.05em;
  text-shadow: 0 0 8px rgba(52, 199, 89, 0.5)
}

.scan-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(52, 199, 89, 0.3);
  border-top-color: var(--green);
  border-radius: 50%;
  animation: spin 0.7s linear infinite
}

@keyframes spin {
  to {
    transform: rotate(360deg)
  }
}

/* ========== 当前猪场信息卡片样式 ========== */
.top-info-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  align-items: stretch
}

.current-farm-section {
  flex: 1 1 50%;
  min-width: 0;
  display: flex
}

.system-stats-section {
  flex: 1 1 50%;
  min-width: 0;
  display: flex
}

@media (max-width: 1024px) {
  .top-info-row {
    flex-direction: column;
    gap: 16px
  }

  .current-farm-section,
  .system-stats-section {
    flex: 1 1 100%
  }
}

.farm-info-card {
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  width: 100%;
  animation: sectionIn 0.3s var(--ease-out) 0.1s both;
}

@keyframes sectionIn {
  from {
    opacity: 0;
    transform: translateY(15px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

.farm-info-card--warning {
  border: 2px solid rgba(255, 149, 0, 0.3);
  background: rgba(255, 149, 0, 0.05)
}

.farm-warning-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: rgba(255, 149, 0, 0.12);
  border-radius: 10px;
  border: 1px solid rgba(255, 149, 0, 0.2)
}

.farm-warning-icon {
  font-size: 18px
}

.farm-warning-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--orange)
}

.farm-info-name--placeholder {
  color: var(--text-4);
  font-style: italic
}

.farm-info-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px
}

.farm-info-icon {
  font-size: 36px;
  line-height: 1;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1))
}

.farm-info-title {
  display: flex;
  flex-direction: column;
  gap: 4px
}

.farm-info-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-4);
  text-transform: uppercase;
  letter-spacing: 0.5px
}

.farm-info-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.5px
}

.farm-info-meta {
  display: flex;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--sep)
}

.farm-info-id {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  font-variant-numeric: tabular-nums
}

/* ========== 系统统计信息样式 ========== */
.system-stats-card {
  padding: 20px 24px;
  width: 100%;
  display: flex;
  flex-direction: column;
  animation: sectionIn 0.3s var(--ease-out) 0.2s both;
}

.system-stats-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--sep)
}

.system-stats-icon {
  font-size: 20px
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
  color: var(--text-4)
}

@media (max-width: 768px) {
  .system-stats-grid {
    grid-template-columns: repeat(2, 1fr)
  }
}

.farm-info-hint {
  font-size: 12px;
  font-weight: 500;
  color: var(--orange)
}

/* ========== 图片预览模态框样式 ========== */
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

.canvas-wrap--clickable {
  cursor: pointer
}

.canvas-wrap--clickable:hover {
  box-shadow: 0 0 0 3px rgba(30, 190, 110, 0.3);
  border-radius: 8px
}

.detail-card {
  overflow: hidden
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  border-bottom: 1px solid var(--sep);
  flex-wrap: wrap;
  gap: 8px
}

.detail-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px
}

.detail-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 5px rgba(52, 199, 89, 0.5);
  animation: dotPulse 2s infinite
}

.detail-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2)
}

.detail-pills {
  display: flex;
  gap: 6px
}

.detail-pill {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid var(--sep);
  border-radius: 20px;
  padding: 3px 10px
}

.detail-pill.conf-high {
  background: rgba(52, 199, 89, 0.1);
  border-color: rgba(52, 199, 89, 0.2);
  color: var(--green)
}

.detail-pill.conf-mid {
  background: rgba(255, 149, 0, 0.1);
  border-color: rgba(255, 149, 0, 0.2);
  color: var(--orange)
}

.detail-pill.conf-low {
  background: rgba(255, 59, 48, 0.1);
  border-color: rgba(255, 59, 48, 0.2);
  color: var(--red)
}

.table-scroll {
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--sep) transparent;
}

.table-scroll::-webkit-scrollbar {
  width: 6px;
}

.table-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.table-scroll::-webkit-scrollbar-thumb {
  background: var(--sep);
  border-radius: 3px;
}

.table-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--text-3);
}

.det-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px
}

.det-table th {
  padding: 10px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-3);
  border-bottom: 1px solid var(--sep);
  background: rgba(0, 0, 0, 0.012)
}

.det-row {
  transition: background 0.15s ease;
  animation: rowAppear 0.4s var(--ease-out) var(--row-delay, 0ms) both
}

@keyframes rowAppear {
  from {
    opacity: 0;
    transform: translateX(-8px)
  }

  to {
    opacity: 1;
    transform: none
  }
}

.det-row td {
  padding: 10px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04)
}

.det-row:last-child td {
  border-bottom: none
}

.det-row--hover td {
  background: rgba(0, 122, 255, 0.03)
}

.td-idx {
  color: var(--text-4);
  font-size: 12px;
  font-weight: 600;
  width: 40px;
  font-variant-numeric: tabular-nums
}

.cls-pill {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  background: rgba(52, 199, 89, 0.1);
  border: 1px solid rgba(52, 199, 89, 0.2);
  color: var(--green);
  border-radius: 6px;
  padding: 2px 8px
}

.conf-cell {
  display: flex;
  align-items: center;
  gap: 10px
}

.conf-track {
  width: 72px;
  height: 4px;
  background: var(--sep);
  border-radius: 2px;
  overflow: hidden
}

.conf-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s var(--ease-out)
}

.conf-fill.conf-high {
  background: var(--green)
}

.conf-fill.conf-mid {
  background: var(--orange)
}

.conf-fill.conf-low {
  background: var(--red)
}

.conf-val {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums
}

.conf-high {
  color: var(--green)
}

.conf-mid {
  color: var(--orange)
}

.conf-low {
  color: var(--red)
}

.td-coord {
  font-size: 11px;
  color: var(--text-4);
  font-variant-numeric: tabular-nums;
  font-family: 'SF Mono', monospace
}

.status-chip {
  font-size: 11px;
  font-weight: 500;
  border-radius: 6px;
  padding: 2px 8px;
  border: 1px solid
}

.chip-ok {
  background: rgba(52, 199, 89, 0.08);
  border-color: rgba(52, 199, 89, 0.2);
  color: var(--green)
}

.chip-warn {
  background: rgba(255, 149, 0, 0.08);
  border-color: rgba(255, 149, 0, 0.2);
  color: var(--orange)
}

.footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-4);
  margin-top: 12px
}

.footer-brand {
  font-weight: 600;
  color: var(--text-3)
}

.footer-dot {
  color: var(--sep-opaque)
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 500;
  background: rgba(242, 242, 247, 0.55);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  display: flex;
  align-items: center;
  justify-content: center
}

.modal-glass {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(32px);
  border: 1px solid rgba(255, 255, 255, 0.92);
  border-radius: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.10), 0 4px 16px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  padding: 44px 56px;
  text-align: center;
  min-width: 300px;
  position: relative;
  overflow: hidden
}

.modal-rings {
  position: absolute;
  inset: 0;
  pointer-events: none
}

.modal-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 50%;
  border: 1px solid rgba(0, 122, 255, 0.1);
  transform: translate(-50%, -50%);
  animation: ringExpand 3s ease-out infinite
}

.r1 {
  width: 100px;
  height: 100px;
  animation-delay: 0s
}

.r2 {
  width: 200px;
  height: 200px;
  animation-delay: 0.6s
}

.r3 {
  width: 320px;
  height: 320px;
  animation-delay: 1.2s
}

@keyframes ringExpand {
  0% {
    opacity: 0.5;
    transform: translate(-50%, -50%) scale(0.7)
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.3)
  }
}

.modal-pig {
  font-size: 48px;
  position: relative;
  z-index: 1;
  animation: modalPig 1.5s ease-in-out infinite;
  margin-bottom: 16px
}

@keyframes modalPig {

  0%,
  100% {
    transform: translateY(0) rotate(-5deg)
  }

  50% {
    transform: translateY(-6px) rotate(5deg)
  }
}

.modal-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 6px;
  letter-spacing: -0.5px
}

.modal-sub {
  font-size: 13px;
  color: var(--text-3);
  margin-bottom: 24px
}

.modal-prog-wrap {
  display: flex;
  align-items: center;
  gap: 12px
}

.modal-prog-track {
  flex: 1;
  height: 4px;
  background: var(--sep);
  border-radius: 2px;
  overflow: visible;
  position: relative
}

.modal-prog-fill {
  height: 100%;
  background: var(--blue);
  border-radius: 2px;
  transition: width 0.3s ease
}

.modal-prog-glow {
  position: absolute;
  top: -4px;
  width: 16px;
  height: 12px;
  background: radial-gradient(circle, var(--blue), transparent);
  transform: translateX(-50%);
  filter: blur(4px);
  transition: left 0.3s ease
}

.modal-pct {
  font-size: 12px;
  font-weight: 600;
  color: var(--blue);
  min-width: 32px;
  text-align: right;
  font-variant-numeric: tabular-nums
}

.img-fade-enter-active,
.img-fade-leave-active {
  transition: opacity 0.3s ease
}

.img-fade-enter,
.img-fade-leave-to {
  opacity: 0
}

.meta-slide-enter-active {
  transition: all 0.35s var(--ease-out)
}

.meta-slide-leave-active {
  transition: all 0.2s ease
}

.meta-slide-enter {
  opacity: 0;
  transform: translateY(-6px)
}

.meta-slide-leave-to {
  opacity: 0;
  transform: translateY(4px)
}

.drag-fade-enter-active,
.drag-fade-leave-active {
  transition: opacity 0.2s ease
}

.drag-fade-enter,
.drag-fade-leave-to {
  opacity: 0
}

.overlay-fade-enter-active {
  transition: opacity 0.4s ease
}

.overlay-fade-leave-active {
  transition: opacity 0.25s ease
}

.overlay-fade-enter,
.overlay-fade-leave-to {
  opacity: 0
}

.section-rise-enter-active {
  transition: all 0.5s var(--ease-out)
}

.section-rise-enter {
  opacity: 0;
  transform: translateY(20px)
}

.overlay-bloom-enter-active {
  transition: all 0.4s var(--ease-out)
}

.overlay-bloom-leave-active {
  transition: all 0.25s ease
}

.overlay-bloom-enter {
  opacity: 0
}

.overlay-bloom-leave-to {
  opacity: 0
}

/* ========== 猪场选择器样式 ========== */
.farm-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  margin-right: 12px
}

.farm-select-wrap {
  position: relative;
  display: flex;
  align-items: center
}

.farm-select {
  appearance: none;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  padding: 8px 36px 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  min-width: 150px;
  height: 42px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: space-between
}

.farm-select:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%);
  border-color: rgba(0, 122, 255, 0.3);
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transform: translateY(-1px)
}

.farm-select--open {
  border-color: var(--blue);
  box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.15), 0 4px 12px rgba(0, 122, 255, 0.15);
  transform: translateY(-1px)
}

.farm-select-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap
}

.farm-select-arrow {
  position: absolute;
  right: 14px;
  font-size: 12px;
  color: var(--text-3);
  pointer-events: none;
  transition: all 0.3s ease;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))
}

.farm-select-arrow--open {
  transform: rotate(180deg);
  color: var(--blue)
}

.farm-select-wrap:hover .farm-select-arrow:not(.farm-select-arrow--open) {
  color: var(--blue);
  transform: translateY(-1px)
}

.farm-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
  z-index: 1000;
  overflow: hidden;
  animation: dropdownIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)
}

@keyframes dropdownIn {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.96);
    transform-origin: top center
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1)
  }
}

.farm-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  cursor: pointer;
  transition: all 0.15s ease
}

.farm-dropdown-item:hover {
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.08) 0%, rgba(0, 122, 255, 0.04) 100%);
  color: var(--blue)
}

.farm-dropdown-item--active {
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.12) 0%, rgba(0, 122, 255, 0.06) 100%);
  color: var(--blue)
}

.farm-dropdown-item-icon {
  font-size: 18px;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))
}

.farm-dropdown-item-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap
}

.btn-farm-manage {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--text-3);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8)
}

.btn-farm-manage:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%);
  border-color: rgba(0, 122, 255, 0.3);
  color: var(--blue);
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transform: translateY(-1px)
}

.btn-farm-manage:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)
}

/* ========== 猪场管理弹窗样式 ========== */
.farm-modal .modal-glass {
  padding: 28px;
  min-width: 420px;
  max-width: 520px;
  max-height: 70vh;
  overflow-y: auto;
  text-align: left
}

.farm-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--sep)
}

.farm-modal-header h3 {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  margin: 0
}

.btn-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: rgba(0, 0, 0, 0.04);
  font-size: 20px;
  color: var(--text-3);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1
}

.btn-close:hover {
  background: rgba(0, 0, 0, 0.08);
  color: var(--text)
}

.farm-add-section {
  display: flex;
  gap: 10px;
  margin-bottom: 20px
}

.farm-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.6);
  outline: none;
  transition: all 0.2s ease
}

.farm-input:focus {
  border-color: var(--blue);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.08)
}

.farm-input--edit {
  padding: 8px 12px;
  font-size: 13px
}

.btn-add-farm {
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  background: var(--blue);
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px
}

.btn-add-farm:hover:not(:disabled) {
  background: #0056d6;
  transform: translateY(-1px)
}

.btn-add-farm:disabled {
  opacity: 0.5;
  cursor: not-allowed
}

.btn-spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite
}

.farm-list {
  display: flex;
  flex-direction: column;
  gap: 8px
}

.farm-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-4);
  font-size: 14px
}

.farm-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 12px;
  transition: all 0.2s ease
}

.farm-item:hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: rgba(0, 0, 0, 0.08);
  transform: translateX(2px)
}

.farm-item--editing {
  background: rgba(0, 122, 255, 0.05);
  border-color: rgba(0, 122, 255, 0.2)
}

.farm-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap
}

.farm-date {
  font-size: 12px;
  color: var(--text-4);
  font-variant-numeric: tabular-nums
}

.farm-actions {
  display: flex;
  gap: 6px
}

.farm-actions button {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px
}

.btn-farm-edit {
  color: var(--blue)
}

.btn-farm-edit:hover {
  background: rgba(0, 122, 255, 0.1)
}

.btn-farm-delete {
  color: var(--red)
}

.btn-farm-delete:hover {
  background: rgba(255, 59, 48, 0.1)
}

.btn-farm-save {
  color: var(--green)
}

.btn-farm-save:hover {
  background: rgba(52, 199, 89, 0.1)
}

.btn-farm-cancel {
  color: var(--text-3)
}

.btn-farm-cancel:hover {
  background: rgba(0, 0, 0, 0.06)
}

@keyframes spin {
  to {
    transform: rotate(360deg)
  }
}

/* ========== 顶部提示栏样式 ========== */
.toast-bar {
  position: fixed;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  min-width: 300px;
  max-width: 500px;
  width: fit-content;
  background: rgba(255, 255, 255, 0.95);
}

.toast-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.toast-icon {
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
}

.toast-message {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toast-progress {
  width: 60px;
  height: 4px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-left: 12px;
  flex-shrink: 0;
}

.toast-progress-fill {
  height: 100%;
  background: var(--green);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.toast-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.05);
  border: none;
  border-radius: 50%;
  color: var(--text-3);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
  transition: all 0.2s;
}

.toast-close:hover {
  background: rgba(0, 0, 0, 0.1);
  color: var(--text-2);
}

/* 不同类型的提示样式 */
.toast-info {
  background: rgba(30, 144, 255, 0.05);
  border-color: rgba(30, 144, 255, 0.3);
  box-shadow: 0 8px 32px rgba(30, 144, 255, 0.2);
}

.toast-info .toast-message {
  color: #1e90ff;
}

.toast-error {
  background: rgba(255, 59, 48, 0.05);
  border-color: rgba(255, 59, 48, 0.3);
  box-shadow: 0 8px 32px rgba(255, 59, 48, 0.2);
}

.toast-error .toast-message {
  color: #ff3b30;
}

.toast-success {
  background: rgba(52, 199, 89, 0.05);
  border-color: rgba(52, 199, 89, 0.3);
  box-shadow: 0 8px 32px rgba(52, 199, 89, 0.2);
}

.toast-success .toast-message {
  color: #34c759;
}

/* 动画效果 */
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.toast-slide-enter-from {
  transform: translateX(-50%) translateY(-30px) scale(0.9);
  opacity: 0;
  box-shadow: 0 0 0 rgba(0, 0, 0, 0);
}

.toast-slide-leave-to {
  transform: translateX(-50%) translateY(-30px) scale(0.9);
  opacity: 0;
  box-shadow: 0 0 0 rgba(0, 0, 0, 0);
}

@media (max-width: 768px) {
  .toast-bar {
    left: 20px;
    right: 20px;
    transform: none;
    max-width: none;
    min-width: 0;
  }

  .toast-message {
    font-size: 13px;
  }

  .toast-progress {
    width: 40px;
  }
}
</style>
