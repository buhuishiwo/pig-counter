import axios from 'axios'

const http = axios.create({
  baseURL: '/api',
  timeout: 30000
})

// 请求拦截器
http.interceptors.request.use(
  config => config,
  error => Promise.reject(error)
)

// 响应拦截器
http.interceptors.response.use(
  response => response.data,
  error => {
    let msg = '网络请求失败'
    
    // 处理不同的 HTTP 错误码
    if (error.response) {
      switch (error.response.status) {
        case 400:
          msg = '请求参数错误，请检查输入'
          break
        case 401:
          msg = '未授权，请重新登录'
          break
        case 403:
          msg = '禁止访问，请联系管理员'
          break
        case 404:
          msg = '调用接口出错，联系管理员'
          break
        case 413:
          msg = error.response.data?.detail || '图片大小超过单次最大上传值！'
          break
        case 500:
          msg = '后端服务出错，联系管理员'
          break
        case 502:
          msg = '后端网络出错，联系管理员'
          break
        case 503:
          msg = '服务暂时不可用，请稍后重试'
          break
        case 504:
          msg = '服务响应超时，请稍后重试'
          break
        default:
          msg = error.response.data?.detail || error.response.data?.message || '服务器错误'
      }
    } else if (error.message) {
      msg = error.message
    }
    
    return Promise.reject(new Error(msg))
  }
)

/**
 * 获取统计数据
 * @param {Object} params 查询参数
 * @returns {Promise}
 */
export const getStats = (params = {}) => {
  return http.get('/stats', { params })
}

/**
 * 获取识别记录列表
 * @param {Object} params 查询参数
 * @returns {Promise}
 */
export const getDetectionRecords = (params = {}) => {
  return http.get('/detection-records', { params })
}

/**
 * 获取识别记录详情
 * @param {number} recordId 记录ID
 * @returns {Promise}
 */
export const getDetectionRecordDetail = (recordId) => {
  return http.get(`/detection-records/${recordId}`)
}

/**
 * 获取检测统计数据
 * @param {number|null} farmId 猪场ID，null表示全部
 * @returns {Promise}
 */
export const getDetectionStats = (farmId = null) => {
  return http.get('/detection-stats', { params: { farm_id: farmId } })
}

/**
 * 按猪场获取统计数据
 * @returns {Promise}
 */
export const getStatsByFarm = () => {
  return http.get('/detection-stats/by-farm')
}

/**
 * 获取带图片的识别记录
 * @param {Object} params 查询参数
 * @returns {Promise}
 */
export const getDetectionRecordsWithImages = (params = {}) => {
  // 转换参数名以匹配后端API
  const transformedParams = {
    farm_id: params.farmId,
    page: params.page,
    page_size: params.pageSize
  }
  return http.get('/detection-records/with-images', { params: transformedParams })
}

/**
 * 获取时间序列统计数据
 * @param {Object} params 查询参数
 * @returns {Promise}
 */
export const getTimeSeriesStats = (params = {}) => {
  // 转换参数名以匹配后端API
  const transformedParams = {
    granularity: params.granularity || 'day',
    farm_id: params.farmId,
    days: params.days || 30
  }
  return http.get('/detection-stats/time-series', { params: transformedParams })
}
