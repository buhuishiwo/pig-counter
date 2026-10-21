import http from './http'

export const getStats = (params = {}) => {
  return http.get('/stats', { params })
}

export const getDetectionRecordDetail = (recordId) => {
  return http.get(`/detection-records/${recordId}`)
}

export const getDetectionStats = (farmId = null) => {
  return http.get('/detection-stats', { params: { farm_id: farmId } })
}

export const getStatsByFarm = () => {
  return http.get('/detection-stats/by-farm')
}

export const getDetectionRecordsWithImages = (params = {}) => {
  const transformedParams = {
    farm_id: params.farmId,
    page: params.page,
    page_size: params.pageSize,
    start_date: params.startDate || undefined,
    end_date: params.endDate || undefined,
    keyword: params.keyword || undefined,
  }
  return http.get('/detection-records/with-images', { params: transformedParams })
}

export const getTimeSeriesStats = (params = {}) => {
  const transformedParams = {
    granularity: params.granularity || 'day',
    farm_id: params.farmId,
    days: params.days || 30
  }
  return http.get('/detection-stats/time-series', { params: transformedParams })
}
