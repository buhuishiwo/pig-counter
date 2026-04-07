// ============================================================
// 猪场管理 API
// ============================================================

import axios from 'axios'

const BASE_URL = '/api'

/**
 * 获取所有猪场列表
 * @returns {Promise<{success: boolean, data: Array<{id: number, name: string, created_at: string}>}>}
 */
export async function getFarms() {
  const response = await axios.get(`${BASE_URL}/farms`)
  return response.data
}

/**
 * 获取单个猪场信息
 * @param {number} farmId
 * @returns {Promise<{success: boolean, data: {id: number, name: string, created_at: string}}>}
 */
export async function getFarm(farmId) {
  const response = await axios.get(`${BASE_URL}/farms/${farmId}`)
  return response.data
}

/**
 * 创建新猪场
 * @param {string} name
 * @returns {Promise<{success: boolean, data: {id: number, name: string, created_at: string}}>}
 */
export async function createFarm(name) {
  const response = await axios.post(`${BASE_URL}/farms`, { name })
  return response.data
}

/**
 * 更新猪场信息
 * @param {number} farmId
 * @param {string} name
 * @returns {Promise<{success: boolean, data: {id: number, name: string, created_at: string}}>}
 */
export async function updateFarm(farmId, name) {
  const response = await axios.put(`${BASE_URL}/farms/${farmId}`, { name })
  return response.data
}

/**
 * 删除猪场
 * @param {number} farmId
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteFarm(farmId) {
  const response = await axios.delete(`${BASE_URL}/farms/${farmId}`)
  return response.data
}
