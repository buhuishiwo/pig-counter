// ============================================================// 猪场管理 API// ============================================================

import axios from 'axios'

const BASE_URL = '/api'

// 创建 axios 实例
const http = axios.create({
  baseURL: BASE_URL,
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
 * 获取所有猪场列表
 * @returns {Promise<{success: boolean, data: Array<{id: number, name: string, created_at: string}>}>}
 */
export async function getFarms() {
  return await http.get('/farms')
}

/**
 * 获取单个猪场信息
 * @param {number} farmId
 * @returns {Promise<{success: boolean, data: {id: number, name: string, created_at: string}}>}
 */
export async function getFarm(farmId) {
  return await http.get(`/farms/${farmId}`)
}

/**
 * 创建新猪场
 * @param {string} name
 * @returns {Promise<{success: boolean, data: {id: number, name: string, created_at: string}}>}
 */
export async function createFarm(name) {
  return await http.post('/farms', { name })
}

/**
 * 更新猪场信息
 * @param {number} farmId
 * @param {string} name
 * @returns {Promise<{success: boolean, data: {id: number, name: string, created_at: string}}>}
 */
export async function updateFarm(farmId, name) {
  return await http.put(`/farms/${farmId}`, { name })
}

/**
 * 删除猪场
 * @param {number} farmId
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteFarm(farmId) {
  return await http.delete(`/farms/${farmId}`)
}
/**
 * 获取按猪场分组的统计数据
 * @returns {Promise<{success: boolean, data: Array}>}
 */
export async function getStatsByFarm() {
  return await http.get('/detection-stats/by-farm')
}
 
/**
 * 获取全局或单猪场统计（已有接口，这里重新导出供统计页使用）
 * @param {number|null} farmId
 * @returns {Promise<{success: boolean, data: object}>}
 */
export async function getDetectionStats(farmId = null) {
  const params = farmId ? { farm_id: farmId } : {}
  return await http.get('/detection-stats', { params })
}
 
/**
 * 获取带标注图片的识别记录列表（用于回看）
 * @param {object} options
 * @param {number|null} options.farmId
 * @param {number} options.page
 * @param {number} options.pageSize
 * @returns {Promise<{success: boolean, data: Array, total: number, page: number, page_size: number}>}
 */
export async function getDetectionRecordsWithImages({ farmId = null, page = 1, pageSize = 12 } = {}) {
  const params = { page, page_size: pageSize }
  if (farmId !== null) params.farm_id = farmId
  return await http.get('/detection-records/with-images', { params })
}