import http from './http'

export async function getFarms() {
  return await http.get('/farms')
}

export async function getFarm(farmId) {
  return await http.get(`/farms/${farmId}`)
}

export async function createFarm(name) {
  return await http.post('/farms', { name })
}

export async function updateFarm(farmId, name) {
  return await http.put(`/farms/${farmId}`, { name })
}

export async function deleteFarm(farmId) {
  return await http.delete(`/farms/${farmId}`)
}
