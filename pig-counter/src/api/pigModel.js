/**
 * 数猪大模型 API 接口层
 *
 * 已接入 Python FastAPI 后端服务
 * 后端地址: http://localhost:8866
 */

import axios from 'axios'

// ============================================================
// 配置区
// ============================================================
const BASE_URL = '/api'          // 通过代理访问后端
const TIMEOUT  = 30000           // 超时时间（毫秒）

const http = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  headers: {}
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
    const msg = error.response?.data?.detail || error.response?.data?.message || error.message || '网络请求失败'
    return Promise.reject(new Error(msg))
  }
)

// ============================================================
// 核心接口
// ============================================================

/**
 * 发送图片至数猪模型进行推理
 * @param {File} imageFile - 图片文件对象
 * @param {Function} onProgress - 上传进度回调 (0~100)
 * @param {number} farmId - 猪场ID（可选）
 * @returns {Promise<{ count: number, confidence: number, boxes: Array, annotatedImage: string, inferenceTime: number }>}
 */
export async function analyzeImage(imageFile, onProgress, farmId = null) {
  const formData = new FormData()
  formData.append('file', imageFile)
  if (farmId) {
    formData.append('farm_id', farmId)
  }
  // 可选参数，使用后端默认值
  // formData.append('conf_threshold', 0.25)
  // formData.append('iou_threshold', 0.45)
  // formData.append('imgsz', 960)

  const response = await http.post('/predict', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
  })

  // 后端返回格式:
  // {
  //   "success": true,
  //   "model_path": "...",
  //   "image_width": 1920,
  //   "image_height": 1080,
  //   "predicted_count": 12,
  //   "detections": [
  //     { "x1": 100, "y1": 200, "x2": 300, "y2": 400, "confidence": 0.95, "class_id": 0, "class_name": "pig" }
  //   ],
  //   "processing_time_ms": 340,
  //   "annotated_image": "data:image/jpeg;base64,..."
  // }

  // 计算平均置信度
  const detections = response.detections || []
  const avgConfidence = detections.length > 0
    ? detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length
    : 0

  return {
    count:         response.predicted_count ?? 0,
    confidence:    avgConfidence,
    boxes:         detections.map((d, i) => ({
      x1: d.x1,
      y1: d.y1,
      x2: d.x2,
      y2: d.y2,
      score: d.confidence,
      class_name: d.class_name,
      id: i
    })),
    annotatedImage: response.annotated_image || null,
    inferenceTime: response.processing_time_ms ?? null
  }
}

/**
 * 健康检查 - 检测模型服务是否在线
 * @returns {Promise<boolean>}
 */
export async function checkHealth() {
  try {
    // 使用 axios 直接访问 /health，不走 BASE_URL
    const response = await axios.get('/api/health', { timeout: 5000 })
    return response.data?.status === 'healthy'
  } catch {
    return false
  }
}

/**
 * 获取服务配置
 * @returns {Promise<Object>}
 */
export async function getConfig() {
  try {
    return await http.get('/config')
  } catch (error) {
    console.error('获取配置失败:', error)
    return null
  }
}
