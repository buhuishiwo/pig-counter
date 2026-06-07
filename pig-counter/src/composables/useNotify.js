import { reactive, toRefs } from 'vue'

export function useNotify() {
  const state = reactive({
    notify: { visible: false, type: 'info', title: '', description: '' },
    showToastProgress: false,
    toastProgress: 0
  })

  let _notifyTimer = null

  function showNotify(type, title, description, duration) {
    const dur = duration || (type === 'error' ? 6000 : 3000)
    state.notify = { visible: true, type, title, description: description || '' }
    if (_notifyTimer) clearTimeout(_notifyTimer)
    _notifyTimer = setTimeout(() => closeNotify(), dur)
  }

  function closeNotify() {
    state.notify = { ...state.notify, visible: false }
  }

  function showToastWithProgress(message, type = 'info') {
    const typeMap = { 'toast-info': 'info', 'toast-error': 'error', 'toast-success': 'success' }
    showNotify(typeMap[type] || type, message)
    state.showToastProgress = true
    state.toastProgress = 0
  }

  function updateToastProgress(progress) {
    state.toastProgress = progress
  }

  return {
    ...toRefs(state),
    showNotify,
    closeNotify,
    showToastWithProgress,
    updateToastProgress
  }
}
