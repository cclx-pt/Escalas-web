/**
 * services/api.js — camada de acesso à API, agrupada por domínio.
 * Todas as funções devolvem os dados já em JSON.
 */
import { http } from './http'

const qs = (params) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') p.set(k, v)
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const orgsApi = {
  list: () => http.get('/data/orgs'),
  create: (name) => http.post('/data/orgs', { name }),
  update: (id, name) => http.put(`/data/orgs/${id}`, { name }),
  remove: (id) => http.del(`/data/orgs/${id}`),
}

export const churchesApi = {
  list: () => http.get('/data/churches'),
  mine: () => http.get('/data/churches/mine'),
  create: (payload) => http.post('/data/churches', payload),
  update: (id, payload) => http.put(`/data/churches/${id}`, payload),
  remove: (id) => http.del(`/data/churches/${id}`),
  enter: (id) => http.post(`/data/churches/${id}/enter`),
  leave: () => http.post('/data/churches/leave'),
  addAdmin: (id, payload) => http.post(`/data/churches/${id}/admins`, payload),
}

export const volunteersApi = {
  list: (params) => http.get(`/data/volunteers${qs(params)}`),
  create: (payload) => http.post('/data/volunteers', payload),
  update: (id, payload) => http.put(`/data/volunteers/${id}`, payload),
  toggle: (id) => http.patch(`/data/volunteers/${id}/toggle`),
  setRole: (id, role) => http.patch(`/data/volunteers/${id}/role`, { role }),
}

export const teamsApi = {
  list: () => http.get('/data/teams'),
  get: (id) => http.get(`/data/teams/${id}`),
  create: (payload) => http.post('/data/teams', payload),
  update: (id, payload) => http.put(`/data/teams/${id}`, payload),
  remove: (id) => http.del(`/data/teams/${id}`),
  addPosition: (id, payload) => http.post(`/data/teams/${id}/positions`, payload),
  removePosition: (id, positionId) => http.del(`/data/teams/${id}/positions/${positionId}`),
  addMember: (id, userId) => http.post(`/data/teams/${id}/members`, { userId }),
  removeMember: (id, userId) => http.del(`/data/teams/${id}/members/${userId}`),
  setLeader: (id, leaderId) => http.put(`/data/teams/${id}/leader`, { leaderId }),
}

export const monthsApi = {
  list: (params) => http.get(`/data/months${qs(params)}`),
  get: (id) => http.get(`/data/months/${id}`),
  create: (payload) => http.post('/data/months', payload),
  createYear: (year) => http.post('/data/months/year', { year }),
  deleteDrafts: () => http.post('/data/months/delete-drafts'),
  setStatus: (id, status) => http.patch(`/data/months/${id}/status`, { status }),
  remove: (id) => http.del(`/data/months/${id}`),
}

export const availabilityApi = {
  list: () => http.get('/data/availability'),
  get: (monthId) => http.get(`/data/availability/${monthId}`),
  save: (monthId, responses) => http.post(`/data/availability/${monthId}`, { responses }),
}

export const scheduleApi = {
  get: (monthId) => http.get(`/data/schedule/${monthId}`),
  save: (monthId, entries) => http.post(`/data/schedule/${monthId}`, { entries }),
}

export const reportsApi = {
  get: (monthId) => http.get(`/data/reports/${monthId}`),
}

export const statsApi = {
  get: () => http.get('/data/stats'),
}

export const calendarApi = {
  get: (params) => http.get(`/data/calendar${qs(params)}`),
  token: () => http.get('/data/calendar/token'),
}

export const publishApi = {
  preview: (monthId) => http.get(`/data/publish/${monthId}`),
  emailLeaders: (monthId) => http.post(`/data/publish/${monthId}/email-leaders`),
  notifyVolunteers: (monthId) => http.post(`/data/publish/${monthId}/notify-volunteers`),
  pdfUrl: (monthId) => `/data/publish/${monthId}/pdf`,
}

export const translationsApi = {
  listPublic: () => http.get('/data/translations/public'),
  list: (lang) => http.get(`/data/translations${qs({ lang })}`),
  upsert: (payload) => http.post('/data/translations', payload),
  remove: (id) => http.del(`/data/translations/${id}`),
  addLanguage: (payload) => http.post('/data/translations/add-language', payload),
}

export const adminRequestsApi = {
  list: () => http.get('/data/admin-requests'),
  approve: (id) => http.post(`/data/admin-requests/${id}/approve`),
  reject: (id) => http.post(`/data/admin-requests/${id}/reject`),
}

export const dataImportApi = {
  teams: (csv) => http.post('/data/import/teams', { csv }),
  users: (csv) => http.post('/data/import/users', { csv }),
}
