/**
 * 图片处理工具函数
 */

// 允许的图片格式
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp']

// 最大文件大小（10MB）
export const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * 验证图片文件
 * @param {File} file
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateImage(file) {
  if (!file) return { valid: false, error: '未选择文件' }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `不支持的格式：${file.type}，请使用 JPG / PNG / WEBP` }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `文件过大（${(file.size / 1024 / 1024).toFixed(1)} MB），请上传 10MB 以内的图片` }
  }
  return { valid: true, error: null }
}

/**
 * 将 File 对象转为 base64 Data URL
 * @param {File} file
 * @returns {Promise<string>}
 */
export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target.result)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * 获取图片尺寸
 * @param {string} dataURL
 * @returns {Promise<{ width: number, height: number }>}
 */
export function getImageDimensions(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = dataURL
  })
}

/**
 * 格式化文件大小
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 获取当前时间字符串 HH:MM:SS
 * @returns {string}
 */
export function getTimeString() {
  return new Date().toTimeString().slice(0, 8)
}
