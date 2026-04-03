# 🐷 智能数猪大模型前端系统

基于 **Vue 2** 的专业猪只 AI 检测计数系统，接入自训练的数猪大模型 API。

---

## 📁 项目结构

```
pig-counter/
├── public/
│   └── index.html            # HTML 入口
├── src/
│   ├── api/
│   │   └── pigModel.js       # ⭐ 模型 API 接口层（在这里配置你的接口）
│   ├── components/
│   │   ├── UploadZone.vue    # 图片上传拖拽组件
│   │   ├── ResultPanel.vue   # 识别结果展示组件
│   │   ├── LogPanel.vue      # 系统日志组件
│   │   ├── AnalyzeButton.vue # 分析按钮组件
│   │   └── ServiceStatus.vue # 服务状态指示器
│   ├── store/
│   │   └── index.js          # Vuex 全局状态管理
│   ├── utils/
│   │   └── imageUtils.js     # 图片处理工具函数
│   ├── App.vue               # 根组件
│   └── main.js               # 应用入口
├── babel.config.js
├── vue.config.js             # Vue CLI 配置（含 API 代理）
└── package.json
```

---

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式启动

```bash
npm run serve
# 访问 http://localhost:8080
```

### 生产构建

```bash
npm run build
# 产物在 dist/ 目录
```

---

## 🔌 接入你的数猪大模型

### 第一步：修改 API 地址

打开 `src/api/pigModel.js`，找到配置区：

```js
const BASE_URL = '/api'   // 替换为你的模型服务地址
const TIMEOUT  = 30000
const API_KEY  = ''       // 如需鉴权，填入 API Key
```

### 第二步：确认接口格式

默认接口：`POST /predict`，请求体为 `multipart/form-data`，字段名 `image`。

修改响应字段映射（`analyzeImage` 函数底部）：

```js
return {
  count:         response.count,           // 猪只数量（整数）
  confidence:    response.confidence,      // 置信度（0~1 浮点数）
  boxes:         response.boxes ?? [],     // 检测框（可选）
  inferenceTime: response.inference_time_ms // 推理耗时ms（可选）
}
```

### 第三步：切换到真实 API

打开 `src/App.vue`，修改导入语句：

```js
// 开发阶段（Mock 数据）
import { analyzeImageMock as analyzeImage, checkHealth } from '@/api/pigModel'

// 生产阶段（真实 API）
import { analyzeImage, checkHealth } from '@/api/pigModel'
```

### 第四步：配置 API 代理（解决跨域）

打开 `vue.config.js`：

```js
proxy: {
  '/api': {
    target: 'http://your-pig-model-api.com',  // 替换为真实地址
    changeOrigin: true,
    pathRewrite: { '^/api': '' }
  }
}
```

---

## 📡 接口规范参考

| 字段         | 说明                            |
|------------|-------------------------------|
| `count`    | 整数，检测到的猪只数量                   |
| `confidence` | 0~1 浮点数，模型置信度               |
| `boxes`    | 数组，每个元素包含 `x1,y1,x2,y2,score` |
| `inference_time_ms` | 整数，推理耗时（毫秒）          |

示例响应：

```json
{
  "count": 12,
  "confidence": 0.924,
  "inference_time_ms": 340,
  "boxes": [
    { "x1": 0.1, "y1": 0.2, "x2": 0.3, "y2": 0.5, "score": 0.95 }
  ]
}
```

---

## 🎨 功能特性

- ✅ 拖拽 / 点击上传图片
- ✅ 图片格式验证（JPG/PNG/WEBP/BMP，最大 10MB）
- ✅ 上传进度条 + 推理 loading 遮罩
- ✅ 猪只数量大字展示 + 数字滚动动画
- ✅ 置信度进度条（高/中/低三色区分）
- ✅ 猪只 emoji 可视化（最多 20 个）
- ✅ 实时系统日志面板
- ✅ 模型服务健康检查
- ✅ Vuex 全局状态管理
- ✅ 响应式布局（移动端适配）
