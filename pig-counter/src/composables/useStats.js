import { reactive, toRefs } from 'vue'
import { useStore } from 'vuex'
import { getDetectionStats } from '@/api/statsApi'

export function useStats() {
  const store = useStore()

  const state = reactive({
    systemStats: {
      total_images: 0,
      total_pigs: 0,
      today_images: 0,
      today_pigs: 0,
      avg_processing_time_ms: 0
    }
  })

  async function loadDetectionStats() {
    try {
      const response = await getDetectionStats(store.state.selectedFarmId)
      if (response.success) {
        state.systemStats = response.data
      }
    } catch (err) {
      console.error('加载统计数据失败:', err)
    }
  }

  return {
    ...toRefs(state),
    loadDetectionStats
  }
}
