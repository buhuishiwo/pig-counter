import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/stats',
      name: 'Stats',
      component: () => import('@/views/StatsPage.vue')
    }
  ]
})
