import axios from 'axios'

const http = axios.create({
  baseURL: '/api',
  timeout: 30000
})

http.interceptors.request.use(
  config => config,
  error => Promise.reject(error)
)

http.interceptors.response.use(
  response => response.data,
  error => {
    let msg = '网络请求失败'

    if (error.response) {
      switch (error.response.status) {
        case 400: msg = '请求参数错误，请检查输入'; break
        case 401: msg = '未授权，请重新登录'; break
        case 403: msg = '禁止访问，请联系管理员'; break
        case 404: msg = '调用接口出错，联系管理员'; break
        case 413: msg = error.response.data?.detail || '图片大小超过单次最大上传值！'; break
        case 500: msg = '后端服务出错，联系管理员'; break
        case 502: msg = '后端网络出错，联系管理员'; break
        case 503: msg = '服务暂时不可用，请稍后重试'; break
        case 504: msg = '服务响应超时，请稍后重试'; break
        default:  msg = error.response.data?.detail || error.response.data?.message || '服务器错误'
      }
    } else if (error.message) {
      msg = error.message
    }

    return Promise.reject(new Error(msg))
  }
)

export default http
