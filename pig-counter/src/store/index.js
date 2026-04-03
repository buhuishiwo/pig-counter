import Vue  from 'vue'
import Vuex from 'vuex'
import { getTimeString } from '@/utils/imageUtils'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    // 图片相关
    imageFile:   null,    // File 对象
    previewUrl:  null,    // Data URL
    imageMeta:   null,    // { name, size, width, height }

    // 分析状态
    isAnalyzing:  false,
    uploadProgress: 0,

    // 结果
    result: null,         // { count, confidence, boxes, inferenceTime }

    // 系统日志
    logs: [],

    // 模型服务状态
    serviceOnline: null   // null=未知, true=在线, false=离线
  },

  getters: {
    hasImage:       state => !!state.previewUrl,
    hasResult:      state => state.result !== null,
    pigCount:       state => state.result?.count      ?? null,
    confidence:     state => state.result?.confidence ?? null,
    confidencePct:  state => state.result
      ? Math.round(state.result.confidence * 100)
      : null,
    inferenceTime:  state => state.result?.inferenceTime ?? null,
    recentLogs:     state => state.logs.slice(0, 30)
  },

  mutations: {
    SET_IMAGE(state, { file, previewUrl, meta }) {
      state.imageFile  = file
      state.previewUrl = previewUrl
      state.imageMeta  = meta
      state.result     = null   // 清除旧结果
    },
    CLEAR_IMAGE(state) {
      state.imageFile  = null
      state.previewUrl = null
      state.imageMeta  = null
      state.result     = null
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
