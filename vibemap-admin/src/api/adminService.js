import client from './client';

export const getOverviewMetrics = async () => {
  const response = await client.get('/admin/metrics/overview');
  return response.data;
};

export const getLiveSos = async () => {
  const response = await client.get('/admin/sos/live');
  return response.data;
};

export const resolveSos = async (sosId, notes) => {
  const response = await client.post(`/admin/sos/${sosId}/resolve`, { resolution_notes: notes });
  return response.data;
};

export const getUsers = async (params = {}) => {
  // Default limit=1000 to pull all users for purely client-side TanStack rendering
  const response = await client.get('/admin/users', { params: { limit: 1000, ...params } });
  return response.data;
};

export const getUserDetails = async (userId) => {
  const response = await client.get(`/admin/users/${userId}`);
  return response.data;
};

export const updateUserStatus = async (userId, statusData) => {
  const response = await client.patch(`/admin/users/${userId}/status`, statusData);
  return response.data;
};

export const overrideUserContact = async (userId, data) => {
  try {
    const response = await client.patch(`/admin/users/${userId}/override`, data);
    return response.data;
  } catch (error) {
    if (error.response?.data?.detail) throw new Error(error.response.data.detail);
    throw error;
  }
};

export const deleteUserAccount = async (userId) => {
  try {
    const response = await client.delete(`/admin/users/${userId}`);
    return response.data;
  } catch (error) {
    if (error.response?.data?.detail) throw new Error(error.response.data.detail);
    throw error;
  }
};

export const getSosHistory = async (params = {}) => {
  const response = await client.get('/admin/sos/history', { params });
  return response.data;
};

// ----------------------------------------
// VIBE PINS MODERATION
// ----------------------------------------

export const getPinMetrics = async () => {
  const response = await client.get('/admin/pins/metrics');
  return response.data;
};

export const getPins = async (params = {}) => {
  const response = await client.get('/admin/pins', { params: { limit: 1000, ...params } });
  return response.data;
};

export const updatePinStatus = async (pinId, statusData) => {
  try {
    const response = await client.patch(`/admin/pins/${pinId}/status`, statusData);
    return response.data;
  } catch (error) {
    if (error.response?.data?.detail) throw new Error(error.response.data.detail);
    throw error;
  }
};

export const deletePin = async (pinId) => {
  try {
    const response = await client.delete(`/admin/pins/${pinId}`);
    return response.data;
  } catch (error) {
    if (error.response?.data?.detail) throw new Error(error.response.data.detail);
    throw error;
  }
};

// ----------------------------------------
// BENEFICIARY / FAMILY MAP OVERSIGHT
// ----------------------------------------

export const getBeneficiaryMetrics = async () => {
  const response = await client.get('/admin/beneficiaries/metrics');
  return response.data;
};

export const getBeneficiaries = async (params = {}) => {
  const response = await client.get('/admin/beneficiaries', { params: { limit: 1000, ...params } });
  return response.data;
};

export const relinkBeneficiary = async (beneficiaryId, data = {}) => {
  try {
    const response = await client.post(`/admin/beneficiaries/${beneficiaryId}/relink`, data);
    return response.data;
  } catch (error) {
    if (error.response?.data?.detail) throw new Error(error.response.data.detail);
    throw error;
  }
};

export const deleteBeneficiaryRelationship = async (beneficiaryId) => {
  try {
    const response = await client.delete(`/admin/beneficiaries/${beneficiaryId}`);
    return response.data;
  } catch (error) {
    if (error.response?.data?.detail) throw new Error(error.response.data.detail);
    throw error;
  }
};

// ----------------------------------------
// TRIP & NAVIGATION ANALYTICS
// ----------------------------------------

export const getTripMetrics = async () => {
  const response = await client.get('/admin/trips/metrics');
  return response.data;
};

export const getTrips = async (params = {}) => {
  const response = await client.get('/admin/trips', { params: { limit: 1000, ...params } });
  return response.data;
};

export const getTripDetails = async (tripId) => {
  const response = await client.get(`/admin/trips/${tripId}`);
  return response.data;
};

// ----------------------------------------
// SYSTEM HEALTH & DIAGNOSTICS
// ----------------------------------------

export const getSystemHealth = async () => {
  const response = await client.get('/admin/system/health');
  return response.data;
};

// ----------------------------------------
// NOTIFICATIONS & BROADCAST COMMUNICATIONS
// ----------------------------------------

export const sendBroadcastNotification = async (payload) => {
  try {
    const response = await client.post('/admin/notifications/broadcast', payload);
    return response.data;
  } catch (error) {
    if (error.response?.data?.detail) throw new Error(error.response.data.detail);
    throw error;
  }
};

export const sendTargetedNotification = async (payload) => {
  try {
    const response = await client.post('/admin/notifications/send', payload);
    return response.data;
  } catch (error) {
    if (error.response?.data?.detail) throw new Error(error.response.data.detail);
    throw error;
  }
};

export const getNotificationLogs = async (params = {}) => {
  const response = await client.get('/admin/notifications/logs', { params: { limit: 1000, ...params } });
  return response.data;
};

// ----------------------------------------
// ADMIN ACCESS CONTROL
// ----------------------------------------

export const getAdmins = async () => {
  const response = await client.get('/admin/admins');
  return response.data;
};

export const promoteAdmin = async (userId) => {
  try {
    const response = await client.post(`/admin/admins/${userId}/promote`);
    return response.data;
  } catch (error) {
    if (error.response?.data?.detail) throw new Error(error.response.data.detail);
    throw error;
  }
};

export const demoteAdmin = async (userId) => {
  try {
    const response = await client.post(`/admin/admins/${userId}/demote`);
    return response.data;
  } catch (error) {
    if (error.response?.data?.detail) throw new Error(error.response.data.detail);
    throw error;
  }
};

// ----------------------------------------
// ADMIN ACTIVITY AUDIT TRAIL
// ----------------------------------------

export const getAuditLogs = async (params = {}) => {
  const response = await client.get('/admin/audit-logs', { params: { limit: 1000, ...params } });
  return response.data;
};

// ----------------------------------------
// LEGAL CONTENT & POLICY CMS
// ----------------------------------------

export const getLegalDoc = async (docType) => {
  const response = await client.get(`/admin/legal/${docType}`);
  return response.data;
};

export const updateLegalDoc = async (docType, data) => {
  try {
    const response = await client.put(`/admin/legal/${docType}`, data);
    return response.data;
  } catch (error) {
    if (error.response?.data?.detail) throw new Error(error.response.data.detail);
    throw error;
  }
};

export const getPublicLegalDoc = async (docType) => {
  const response = await client.get(`/legal/${docType}`);
  return response.data;
};

