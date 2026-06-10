import http from './http'

export async function getDetectionRecords(params = {}) {
  const { farm_id, page = 1, page_size = 20 } = params
  const queryParams = new URLSearchParams()
  if (farm_id) queryParams.append('farm_id', farm_id)
  queryParams.append('page', page)
  queryParams.append('page_size', page_size)
  return await http.get(`/detection-records?${queryParams.toString()}`)
}

export async function updateDetectionRecord(recordId, updateData) {
  return await http.put(`/detection-records/${recordId}`, updateData)
}
