import { createRouter, createWebHistory } from 'vue-router'

export default createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: { render: () => null }
    },
    {
      path: '/stats',
      name: 'Stats',
      component: () => import('@/views/StatsPage.vue')
    }
  ]
})
