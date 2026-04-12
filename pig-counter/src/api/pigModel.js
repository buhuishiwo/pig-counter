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

// ============================================================
// 核心接口
// ============================================================

/**
 * 发送图片至数猪模型进行推理（支持单张或多张图片）
 * @param {Array<File>|File} imageFiles - 图片文件对象数组或单个图片文件
 * @param {Function} onProgress - 上传进度回调 (0~100)
 * @param {number} farmId - 猪场ID（可选）
 * @returns {Promise<{ count: number, confidence: number, boxes: Array, annotatedImage: string, inferenceTime: number }>} 当传入单张图片时返回单个结果
 * @returns {Promise<{ totalImages: number, totalPigs: number, results: Array }>} 当传入多张图片时返回批量结果
 */
export async function analyzeImage(imageFiles, onProgress, farmId = null) {
  const formData = new FormData()
  
  // 处理单张或多张图片
  const files = Array.isArray(imageFiles) ? imageFiles : [imageFiles]
  files.forEach(file => {
    formData.append('files', file)
  })
  
  if (farmId) {
    formData.append('farm_id', farmId)
  }
  // 可选参数，使用后端默认值
  // formData.append('conf_threshold', 0.25)
  // formData.append('iou_threshold', 0.45)
  // formData.append('imgsz', 960)

  const response = await http.post('/predict-batch', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
  })

  // 后端返回格式（批量）:
  // {
  //   "success": true,
  //   "total_images": 2,
  //   "total_pigs": 25,
  //   "results": [
  //     {
  //       "success": true,
  //       "model_path": "...",
  //       "image_width": 1920,
  //       "image_height": 1080,
  //       "predicted_count": 12,
  //       "detections": [...],
  //       "processing_time_ms": 340,
  //       "annotated_image": "data:image/jpeg;base64,..."
  //     },
  //     {
  //       "success": true,
  //       "model_path": "...",
  //       "image_width": 1920,
  //       "image_height": 1080,
  //       "predicted_count": 13,
  //       "detections": [...],
  //       "processing_time_ms": 320,
  //       "annotated_image": "data:image/jpeg;base64,..."
  //     }
  //   ]
  // }

  // 如果是单张图片，返回单个结果
  if (!Array.isArray(imageFiles)) {
    const result = response.results[0]
    if (!result) {
      return {
        count: 0,
        confidence: 0,
        boxes: [],
        annotatedImage: null,
        inferenceTime: null
      }
    }
    
    // 计算平均置信度
    const detections = result.detections || []
    const avgConfidence = detections.length > 0
      ? detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length
      : 0

    return {
      count:         result.predicted_count ?? 0,
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
      annotatedImage: result.annotated_image || null,
      inferenceTime: result.processing_time_ms ?? null
    }
  }
  
  // 如果是多张图片，返回批量结果
  return {
    totalImages: response.total_images,
    totalPigs: response.total_pigs,
    results: response.results.map((result, index) => {
      // 计算平均置信度
      const detections = result.detections || []
      const avgConfidence = detections.length > 0
        ? detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length
        : 0

      return {
        count:         result.predicted_count ?? 0,
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
        annotatedImage: result.annotated_image || null,
        inferenceTime: result.processing_time_ms ?? null,
        fileName: files[index].name
      }
    })
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
