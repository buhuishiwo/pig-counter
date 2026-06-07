import { ref } from 'vue'
import { useStore } from 'vuex'
import { getFarms } from '@/api/farmApi'

export function useFarm({ showNotify, loadDetectionStats }) {
  const store = useStore()

  const farms = ref([])
  const showFarmModal = ref(false)
  const showFarmDropdown = ref(false)

  function toggleFarmDropdown() {
    showFarmDropdown.value = !showFarmDropdown.value
  }

  function selectFarm(farmId, onFarmChange) {
    store.commit('SET_FARM', farmId)
    showFarmDropdown.value = false
    if (onFarmChange) onFarmChange()
  }

  async function loadFarms() {
    try {
      const response = await getFarms()
      if (response.success) {
        farms.value = response.data
        store.commit('ADD_LOG', { msg: `已加载 ${farms.value.length} 个猪场`, type: 'info' })
        if (farms.value.length === 0) {
          showNotify('info', '提示', '第一次使用请先创建养殖场')
        }
      }
    } catch (err) {
      store.commit('ADD_LOG', { msg: '加载猪场列表失败：' + err.message, type: 'error' })
    }
  }

  async function onFarmChange() {
    const farm = farms.value.find(f => f.id === store.state.selectedFarmId)
    if (farm) {
      store.commit('ADD_LOG', { msg: `已选择猪场：${farm.name}`, type: 'info' })
    }
    await loadDetectionStats()
  }

  async function onServiceOnline() {
    await loadFarms()
    await loadDetectionStats()
  }

  function closeFarmModal() {
    showFarmModal.value = false
  }

  function onFarmAdded(farm) {
    farms.value.unshift(farm)
  }

  function onFarmUpdated(farm) {
    const index = farms.value.findIndex(f => f.id === farm.id)
    if (index !== -1) farms.value.splice(index, 1, farm)
  }

  function onFarmDeleted(farmId) {
    farms.value = farms.value.filter(f => f.id !== farmId)
    if (store.state.selectedFarmId === farmId) store.commit('SET_FARM', null)
  }

  function currentFarmName(selectedFarmId) {
    const farm = farms.value.find(f => f.id === selectedFarmId)
    return farm ? farm.name : '未选择'
  }

  return {
    farms,
    showFarmModal,
    showFarmDropdown,
    toggleFarmDropdown,
    selectFarm,
    loadFarms,
    onFarmChange,
    onServiceOnline,
    closeFarmModal,
    onFarmAdded,
    onFarmUpdated,
    onFarmDeleted,
    currentFarmName
  }
}
