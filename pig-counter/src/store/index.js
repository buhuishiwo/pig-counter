import Vue  from 'vue'
import Vuex from 'vuex'
import { getTimeString } from '@/utils/imageUtils'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    // 图片相关
    imageFile:   null,    // File 对象（单张）
    imageFiles:  [],      // File 对象数组（多张）
    previewUrls: [],      // Data URL 数组（多张）
    imageMetas:  [],      // 元数据数组（多张）
    currentImageIndex: 0, // 当前显示的图片索引
    previewUrl:  null,    // Data URL（单张，保持兼容）
    imageMeta:   null,    // { name, size, width, height }（单张，保持兼容）

    // 分析状态
    isAnalyzing:  false,
    uploadProgress: 0,

    // 结果
    result: null,         // { count, confidence, boxes, inferenceTime }（单张，保持兼容）
    results: [],          // 结果数组（多张）
    totalPigs: 0,         // 总猪只数

    // 系统日志
    logs: [],

    // 模型服务状态
    serviceOnline: null   // null=未知, true=在线, false=离线
  },

  getters: {
    hasImage:       state => !!state.previewUrl || state.imageFiles.length > 0,
    hasResult:      state => state.result !== null || state.results.length > 0,
    pigCount:       state => state.result?.count      ?? null,
    confidence:     state => state.result?.confidence ?? null,
    confidencePct:  state => state.result
      ? Math.round(state.result.confidence * 100)
      : null,
    inferenceTime:  state => state.result?.inferenceTime ?? null,
    recentLogs:     state => state.logs.slice(0, 30),
    currentResult:  state => state.results[state.currentImageIndex] || null,
    currentPigCount: state => state.results[state.currentImageIndex]?.count ?? 0
  },

  mutations: {
    SET_IMAGE(state, { file, previewUrl, meta }) {
      state.imageFile  = file
      state.previewUrl = previewUrl
      state.imageMeta  = meta
      state.result     = null   // 清除旧结果
      // 清除批量状态
      state.imageFiles = []
      state.previewUrls = []
      state.imageMetas = []
      state.currentImageIndex = 0
      state.results = []
      state.totalPigs = 0
    },
    SET_IMAGES(state, { files, previewUrls, metas }) {
      state.imageFiles = files
      state.previewUrls = previewUrls
      state.imageMetas = metas
      state.currentImageIndex = 0
      // 更新单张状态以保持兼容
      if (files.length > 0) {
        state.imageFile = files[0]
        state.previewUrl = previewUrls[0]
        state.imageMeta = metas[0]
      } else {
        state.imageFile = null
        state.previewUrl = null
        state.imageMeta = null
      }
      // 清除旧结果
      state.result = null
      state.results = []
      state.totalPigs = 0
    },
    SET_CURRENT_IMAGE_INDEX(state, index) {
      state.currentImageIndex = index
      // 更新单张状态以保持兼容
      if (state.imageFiles[index]) {
        state.imageFile = state.imageFiles[index]
        state.previewUrl = state.previewUrls[index]
        state.imageMeta = state.imageMetas[index]
      }
      if (state.results[index]) {
        state.result = state.results[index]
      }
    },
    CLEAR_IMAGE(state) {
      state.imageFile  = null
      state.previewUrl = null
      state.imageMeta  = null
      state.result     = null
      state.imageFiles = []
      state.previewUrls = []
      state.imageMetas = []
      state.currentImageIndex = 0
      state.results = []
      state.totalPigs = null
      state.uploadProgress = 0
    },
    SET_ANALYZING(state, val) {
      state.isAnalyzing = val
    },
    SET_PROGRESS(state, val) {
      state.uploadProgress = val
    },
    SET_RESULT(state, result) {
      state.result = result
    },
    SET_RESULTS(state, { results, totalPigs }) {
      state.results = results
      state.totalPigs = totalPigs
      // 更新单张状态以保持兼容
      if (results.length > 0) {
        state.result = results[0]
      } else {
        state.result = null
      }
    },
    ADD_LOG(state, { msg, type = 'info' }) {
      state.logs.unshift({ id: Date.now(), time: getTimeString(), msg, type })
      if (state.logs.length > 50) state.logs.pop()
    },
    CLEAR_LOGS(state) {
      state.logs = []
    },
    SET_SERVICE_STATUS(state, online) {
      state.serviceOnline = online
    }
  },

  actions: {
    addLog({ commit }, payload) {
      commit('ADD_LOG', typeof payload === 'string' ? { msg: payload } : payload)
    }
  }
})
