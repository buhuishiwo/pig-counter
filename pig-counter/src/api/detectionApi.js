// ============================================================
// 识别记录 API
// ============================================================

import axios from 'axios'

const BASE_URL = '/api'

/**
 * 获取识别记录列表
 * @param {Object} params - 查询参数
 * @param {number} params.farm_id - 猪场ID（可选）
 * @param {number} params.page - 页码（默认1）
 * @param {number} params.page_size - 每页数量（默认20）
 * @returns {Promise<{success: boolean, data: Array, total: number}>}
 */
export async function getDetectionRecords(params = {}) {
  const { farm_id, page = 1, page_size = 20 } = params
  const queryParams = new URLSearchParams()
  if (farm_id) queryParams.append('farm_id', farm_id)
  queryParams.append('page', page)
  queryParams.append('page_size', page_size)

  const response = await axios.get(`${BASE_URL}/detection-records?${queryParams.toString()}`)
  return response.data
}

/**
 * 获取识别统计信息
 * @param {number} farm_id - 猪场ID（可选）
 * @returns {Promise<{success: boolean, data: {total_images: number, total_pigs: number, today_images: number, today_pigs: number, avg_processing_time_ms: number}}>}
 */
export async function getDetectionStats(farm_id = null) {
  const queryParams = new URLSearchParams()
  if (farm_id) queryParams.append('farm_id', farm_id)

  const response = await axios.get(`${BASE_URL}/detection-stats?${queryParams.toString()}`)
  return response.data
}

/**
 * 更新识别记录（高危操作 - 会修改数据库中的图片数据）
 * @param {number} recordId - 记录ID
 * @param {Object} updateData - 更新数据
 * @param {string} updateData.annotated_image - 标注后的图片（base64）
 * @param {number} updateData.predicted_count - 预测的猪数量
 * @returns {Promise<{success: boolean, data: Object}>}
 */
export async function updateDetectionRecord(recordId, updateData) {
  console.log('[DEBUG] updateDetectionRecord API called with:', {
    recordId,
    updateData: {
      ...updateData,
      annotated_image: updateData.annotated_image ? '(base64 string)' : null
    }
  })
  console.log('[DEBUG] Request URL:', `${BASE_URL}/detection-records/${recordId}`)
  
  try {
    const response = await axios.put(`${BASE_URL}/detection-records/${recordId}`, updateData)
    console.log('[DEBUG] updateDetectionRecord response:', {
      id: response.data.id,
      predicted_count: response.data.predicted_count,
      boxes_count: response.data.boxes ? response.data.boxes.length : 0,
      annotated_image_len: response.data.annotated_image ? response.data.annotated_image.length : 0,
      annotated_image_prefix: response.data.annotated_image ? response.data.annotated_image.substring(0, 60) : null
    })
    return response.data
  } catch (error) {
    console.error('[DEBUG] updateDetectionRecord error:', error.response?.data || error.message)
    throw error
  }
}
