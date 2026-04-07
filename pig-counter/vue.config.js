const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  // devServer: {
  //   port: 8080,
  //   proxy: {
  //     // 代理到 Python FastAPI 后端服务
  //     '/api': {
  //       target: 'http://localhost:8866',
  //       changeOrigin: true,
  //       pathRewrite: { '^/api': '/api' }
  //     },
  //     '/health': {
  //       target: 'http://localhost:8866',
  //       changeOrigin: true
  //     }
  //   }
  // }
})
