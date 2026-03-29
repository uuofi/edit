import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

function getConfiguredApiBaseUrl() {
  // Priority:
  // 1) EXPO_PUBLIC_API_BASE_URL (EAS / CI / local env)
  // 2) app.json -> expo.extra.apiBaseUrl
  // 3) production default

  const envUrl =
    typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_API_BASE_URL : undefined;

  const extra =
    Constants?.expoConfig?.extra ||
    // older manifests
    Constants?.manifest?.extra ||
    Constants?.manifest2?.extra ||
    {};

  const extraUrl = extra?.apiBaseUrl;

  return (envUrl || extraUrl || "https://api.medicare-iq.com").replace(/\/+$/, "");
}

export const API_BASE_URL = getConfiguredApiBaseUrl();
const TOKEN_KEY = "medicare_token";
const LEGACY_TOKEN_KEY = "token"; // fallback for older installs
const REFRESH_TOKEN_KEY = "medicare_refresh_token";
const ROLE_SELECTION_KEY = "medicare_role_selection";
const USER_ROLE_KEY = "medicare_user_role";
const EXPO_PUSH_TOKEN_KEY = "medicare_expo_push_token";

export const normalizeUserRole = (role) => {
  const value = String(role || "").trim().toLowerCase();
  if (!value) return null;

  if (["doctor", "provider", "physician", "dr"].includes(value)) {
    return "doctor";
  }

  if (["patient", "user", "client"].includes(value)) {
    return "patient";
  }

  if (["secretary", "employee"].includes(value)) {
    return "secretary";
  }

  if (["lab", "laboratory", "clinic_lab"].includes(value)) {
    return "lab";
  }

  return value;
};

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }

  toString() {
    const status = typeof this.status === "number" ? this.status : undefined;
    const prefix = status ? `[${status}] ` : "";
    return `${prefix}${this.message}`;
  }
}

export const saveToken = async (token) => {
  if (!token) {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
    return;
  }
  await AsyncStorage.setItem(TOKEN_KEY, token);
  // keep legacy key in sync so older screens (if any) still work
  await AsyncStorage.setItem(LEGACY_TOKEN_KEY, token);
};

export const getToken = async () => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) return token;
  return AsyncStorage.getItem(LEGACY_TOKEN_KEY);
};

export const saveRefreshToken = async (refreshToken) => {
  if (!refreshToken) {
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const getRefreshToken = () => AsyncStorage.getItem(REFRESH_TOKEN_KEY);

export const clearRefreshToken = () => AsyncStorage.removeItem(REFRESH_TOKEN_KEY);

export const clearToken = async () => {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
  await clearUserRole();
};



export const saveRoleSelection = async (role) => {
  const normalizedRole = normalizeUserRole(role);
  if (!normalizedRole) {
    await AsyncStorage.removeItem(ROLE_SELECTION_KEY);
    return;
  }
  await AsyncStorage.setItem(ROLE_SELECTION_KEY, normalizedRole);
};

export const getRoleSelection = async () => {
  const storedRole = await AsyncStorage.getItem(ROLE_SELECTION_KEY);
  const normalizedRole = normalizeUserRole(storedRole);

  if (!normalizedRole) {
    return null;
  }

  if (storedRole !== normalizedRole) {
    await AsyncStorage.setItem(ROLE_SELECTION_KEY, normalizedRole);
  }

  return normalizedRole;
};

export const clearRoleSelection = () =>
  AsyncStorage.removeItem(ROLE_SELECTION_KEY);

export const saveUserRole = async (role) => {
  const normalizedRole = normalizeUserRole(role);
  if (!normalizedRole) {
    await AsyncStorage.removeItem(USER_ROLE_KEY);
    return;
  }
  await AsyncStorage.setItem(USER_ROLE_KEY, normalizedRole);
};

export const getUserRole = async () => {
  const storedRole = await AsyncStorage.getItem(USER_ROLE_KEY);
  const normalizedRole = normalizeUserRole(storedRole);

  if (!normalizedRole) {
    return null;
  }

  if (storedRole !== normalizedRole) {
    await AsyncStorage.setItem(USER_ROLE_KEY, normalizedRole);
  }

  return normalizedRole;
};

export const clearUserRole = () => AsyncStorage.removeItem(USER_ROLE_KEY);

export const saveExpoPushToken = async (expoPushToken) => {
  const value = String(expoPushToken || "").trim();
  if (!value) {
    await AsyncStorage.removeItem(EXPO_PUSH_TOKEN_KEY);
    return;
  }
  await AsyncStorage.setItem(EXPO_PUSH_TOKEN_KEY, value);
};

export const getExpoPushToken = () => AsyncStorage.getItem(EXPO_PUSH_TOKEN_KEY);

export const clearExpoPushToken = () => AsyncStorage.removeItem(EXPO_PUSH_TOKEN_KEY);

const getExpoExperienceId = () => {
  try {
    const extra =
      Constants?.expoConfig?.extra ||
      Constants?.manifest?.extra ||
      Constants?.manifest2?.extra ||
      {};
    const owner = Constants?.expoConfig?.owner;
    const slug = Constants?.expoConfig?.slug;
    if (owner && slug) {
      return `@${owner}/${slug}`;
    }
    return extra?.eas?.projectId || undefined;
  } catch (_err) {
    return undefined;
  }
};

const buildHeaders = async (custom = {}) => {
  const token = await getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...custom,
  };
};

const buildAuthHeaders = async (custom = {}) => {
  const token = await getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...custom,
  };
};

const parseResponse = async (response) => {
  const text = await response.text();
  const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();

  let data;
  if (contentType.includes("application/json")) {
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_parseErr) {
      // Some backends return invalid JSON even with a JSON content-type.
      data = { message: text };
    }
  } else {
    // Avoid noisy JSON parse warnings for plain-text responses (e.g. 429 throttling).
    data = { message: text };
  }

  if (!response.ok) {
    const baseMessage = data?.message || "Request failed";
    const statusPrefix = response.status ? `[${response.status}] ` : "";
    throw new ApiError(`${statusPrefix}${baseMessage}`, response.status, data);
  }

  return data;
};

/** Default request timeout in ms (30 seconds). */
const DEFAULT_TIMEOUT_MS = 30000;

const fetchWithTimeout = (url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const existingSignal = options.signal;

  // If the caller already provided a signal, abort our controller when theirs aborts.
  if (existingSignal) {
    if (existingSignal.aborted) {
      controller.abort();
    } else {
      existingSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  return fetch(url, { ...options, signal: controller.signal })
    .then((response) => {
      if (timer) clearTimeout(timer);
      return response;
    })
    .catch((err) => {
      if (timer) clearTimeout(timer);
      if (err?.name === "AbortError") {
        throw new ApiError(
          "[TIMEOUT] Request timed out. Please check your connection and try again.",
          0,
          { originalError: "AbortError", timeoutMs }
        );
      }
      throw err;
    });
};

export const request = async (path, options = {}) => {
  const headers = await buildHeaders(options.headers);
  const timeoutMs = typeof options.timeoutMs === "number" ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}${path}`,
      { ...options, headers },
      timeoutMs
    );
    return parseResponse(response);
  } catch (err) {
    // Auto-refresh once on 401, then retry
    if (err instanceof ApiError && err.status === 401 && !options.__retried) {
      const rt = await getRefreshToken();
      if (rt) {
        try {
          const refreshed = await fetchWithTimeout(
            `${API_BASE_URL}/api/auth/refresh`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken: rt }),
            },
            15000
          );
          const data = await parseResponse(refreshed);
          if (data?.token) await saveToken(data.token);
          if (data?.refreshToken) await saveRefreshToken(data.refreshToken);

          const retryHeaders = await buildHeaders(options.headers);
          const retryResponse = await fetchWithTimeout(
            `${API_BASE_URL}${path}`,
            { ...options, __retried: true, headers: retryHeaders },
            timeoutMs
          );
          return parseResponse(retryResponse);
        } catch (refreshErr) {
          // If refresh fails, fall through to original error
        }
      }
    }

    if (err instanceof ApiError) throw err;
    const message = err?.message ? String(err.message) : "Network error";
    throw new ApiError(`[NETWORK] ${message}`, 0, { originalError: message });
  }
};

export const bookAppointment = (payload) =>
  request("/api/appointments", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const fetchAppointments = () => request("/api/appointments");
export const fetchPatientMedicalRecords = () => request("/api/appointments/records");
export const fetchAppointment = (id) => request(`/api/appointments/${id}`);
export const cancelAppointment = (id) =>
  request(`/api/appointments/${id}/cancel`, {
    method: "PATCH",
  });

export const rateAppointment = (id, payload) =>
  request(`/api/appointments/${id}/rate`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const fetchDoctors = () => request("/api/doctors");
export const fetchDoctorDashboard = () => request("/api/doctors/me");
export const saveDoctorSchedule = (payload) =>
  request("/api/doctors/me/schedule", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
export const fetchDoctorAppointments = () =>
  request("/api/doctors/appointments");

export const fetchDoctorArchivePatients = (search = "") =>
  request(`/api/doctors/archives${search ? `?search=${encodeURIComponent(search)}` : ""}`);

export const fetchDoctorArchiveByPatient = (patientId) =>
  request(`/api/doctors/archives/${patientId}`);

export const createDoctorArchiveEntry = (payload) =>
  request("/api/doctors/archives", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateDoctorArchiveEntry = (archiveId, payload) =>
  request(`/api/doctors/archives/${archiveId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteDoctorArchiveEntry = (archiveId) =>
  request(`/api/doctors/archives/${archiveId}`, {
    method: "DELETE",
  });

export const fetchArchiveTemplate = () =>
  request("/api/doctors/archive-template");

export const saveArchiveTemplate = (template) =>
  request("/api/doctors/archive-template", {
    method: "PUT",
    body: JSON.stringify({ template }),
  });

export const createDoctorAppointment = (payload) =>
  request("/api/doctors/appointments/manual", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const saveDoctorNote = (id, payload) =>
  request(`/api/doctors/appointments/${id}/note`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
export const updateDoctorProfile = (payload) =>
  request("/api/doctors/me/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
export const acceptDoctorAppointment = (id) =>
  request(`/api/doctors/appointments/${id}/accept`, {
    method: "PATCH",
  });
export const rejectDoctorAppointment = (id) =>
  request(`/api/doctors/appointments/${id}/reject`, {
    method: "PATCH",
  });
export const cancelDoctorAppointment = (id) =>
  request(`/api/doctors/appointments/${id}/cancel`, {
    method: "PATCH",
  });
export const completeDoctorAppointment = (id) =>
  request(`/api/doctors/appointments/${id}/complete`, {
    method: "PATCH",
  });
export const rescheduleDoctorAppointment = (id, payload) =>
  request(`/api/doctors/appointments/${id}/reschedule`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
export const assignEmployeeToAppointment = (appointmentId, secretaryId) =>
  request(`/api/doctors/appointments/${appointmentId}/assign-employee`, {
    method: "PATCH",
    body: JSON.stringify({ secretaryId }),
  });
export const deleteDoctorAppointment = (id) =>
  request(`/api/doctors/appointments/${id}`, {
    method: "DELETE",
  });
export const fetchDoctorsBySpecialty = () =>
  request("/api/reports/doctors-by-specialty");

export const fetchMyDoctorCenters = () => request("/api/centers/my");

export const updateMyDoctorCenterSchedule = (centerId, doctorCenterId, schedulePayload) =>
  request(`/api/centers/${centerId}/doctors/${doctorCenterId}`, {
    method: "PATCH",
    body: JSON.stringify({ schedule: schedulePayload }),
  });

export const fetchCenters = () => request("/api/centers");

export const fetchCenterById = (centerId) =>
  request(`/api/centers/${centerId}`);

export const fetchCenterDoctors = (centerId) =>
  request(`/api/centers/${centerId}/doctors`);

export const fetchCenterDoctorServices = (centerId, doctorCenterId) =>
  request(`/api/centers/${centerId}/doctors/${doctorCenterId}/services`);

export const fetchCenterDoctorBlockedSlots = (centerId, doctorCenterId, days = 14) =>
  request(
    `/api/centers/${centerId}/bookings/blocked-slots?doctorCenterId=${encodeURIComponent(
      doctorCenterId
    )}&days=${Math.max(1, Math.min(days, 30))}`
  );

export const bookCenterAppointment = (centerId, payload) =>
  request(`/api/centers/${centerId}/bookings`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const fetchDoctorCenterBookings = (centerId) =>
  request(`/api/centers/${centerId}/bookings/doctor`);

export const acceptDoctorCenterBooking = (centerId, bookingId) =>
  request(`/api/centers/${centerId}/bookings/${bookingId}/accept`, {
    method: "PATCH",
  });

export const cancelDoctorCenterBooking = (centerId, bookingId) =>
  request(`/api/centers/${centerId}/bookings/${bookingId}/cancel`, {
    method: "PATCH",
  });

export const completeDoctorCenterBooking = (centerId, bookingId) =>
  request(`/api/centers/${centerId}/bookings/${bookingId}/complete`, {
    method: "PATCH",
  });

export const rescheduleDoctorCenterBooking = (centerId, bookingId, payload) =>
  request(`/api/centers/${centerId}/bookings/${bookingId}/reschedule`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const assignEmployeeToCenterBooking = (centerId, bookingId, secretaryId) =>
  request(`/api/centers/${centerId}/bookings/${bookingId}/assign-employee`, {
    method: "PATCH",
    body: JSON.stringify({ secretaryId }),
  });

export const fetchDoctorBlockedSlots = (doctorId, days = 14) =>
  request(
    `/api/reports/doctors/${doctorId}/booked-slots?days=${Math.max(1, Math.min(days, 30))}`
  );

// Doctor services
export const fetchDoctorServices = (doctorId) =>
  request(`/api/doctors/${doctorId}/services`);

export const fetchMyDoctorServices = () => request("/api/doctors/me/services");

export const fetchMyCenterDoctorServices = (centerId) =>
  request(`/api/centers/${centerId}/doctors/me/services`);

export const createMyDoctorService = (payload) =>
  request("/api/doctors/me/services", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const createMyCenterDoctorService = (centerId, payload) =>
  request(`/api/centers/${centerId}/doctors/me/services`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateMyDoctorService = (serviceId, payload) =>
  request(`/api/doctors/me/services/${serviceId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const updateMyCenterDoctorService = (centerId, serviceId, payload) =>
  request(`/api/centers/${centerId}/doctors/me/services/${serviceId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const fetchMe = () => request("/api/auth/me");

export const uploadDoctorArchiveFile = async (uri, type = "file") => {
  if (!uri) throw new ApiError("Missing file uri", 400, {});

  const headers = await buildAuthHeaders();
  const extension = String(uri).split(".").pop() || "bin";
  const fileName = `${type}-${Date.now()}.${extension}`;

  const form = new FormData();
  form.append("file", {
    uri,
    name: fileName,
    type: extension.toLowerCase() === "pdf" ? "application/pdf" : `image/${extension.toLowerCase() === "jpg" ? "jpeg" : extension.toLowerCase()}`,
  });

  const response = await fetch(`${API_BASE_URL}/api/doctors/archives/upload`, {
    method: "POST",
    headers,
    body: form,
  });

  return parseResponse(response);
};

export const setBlock = (patientId, { blockBooking }) =>
  request("/api/blocks", {
    method: "POST",
    body: JSON.stringify({ patientId, blockBooking }),
  });

export const getBlock = (patientId) => request(`/api/blocks/${patientId}`);

export const generateDailyReportLink = (dateIso) =>
  request("/api/reports/doctors/me/daily-bookings/link", {
    method: "POST",
    body: JSON.stringify({ date: dateIso }),
  });

export const generateDailyReportExcelLink = (dateIso) =>
  request("/api/reports/doctors/me/daily-bookings/excel/link", {
    method: "POST",
    body: JSON.stringify({ date: dateIso }),
  });

export const generateMonthlyReportExcelLink = (monthIso) =>
  request("/api/reports/doctors/me/monthly-bookings/excel/link", {
    method: "POST",
    body: JSON.stringify({ month: monthIso }),
  });



export const registerExpoPushToken = async (expoPushToken) => {
  const token = String(expoPushToken || "").trim();
  if (!token) {
    throw new ApiError("Invalid Expo push token", 400, {});
  }

  const experienceId = getExpoExperienceId();
  const payload = {
    expoPushToken: token,
    ...(experienceId ? { experienceId } : {}),
  };

  const data = await request("/api/notifications/register-token", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  await saveExpoPushToken(token);
  return data;
};

export const registerPushTokens = ({ expoPushToken } = {}) => {
  return registerExpoPushToken(expoPushToken);
};

export const unregisterPushToken = async (expoPushToken) => {
  const token = String(expoPushToken || "").trim();
  // If we don't have a token, still attempt to clear server-side (best-effort).
  const res = await request("/api/notifications/unregister-token", {
    method: "POST",
    body: JSON.stringify(token ? { expoPushToken: token } : {}),
  });

  if (token) {
    await clearExpoPushToken();
  }
  return res;
};

export const unregisterPushTokens = async ({ expoPushToken } = {}) => {
  const expoToken = String(expoPushToken || "").trim();
  const payload = {
    ...(expoToken ? { expoPushToken: expoToken } : {}),
  };

  const res = await request("/api/notifications/unregister-token", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (expoToken) await clearExpoPushToken();
  return res;
};

export const logout = async () => {
  // Best-effort: detach this device push token from the current account before clearing auth.
  try {
    const expoPushToken = await getExpoPushToken();

    if (expoPushToken) {
      await unregisterPushTokens({ expoPushToken });
    }
  } catch (err) {
    // ignore: logout should still proceed even if network fails
  }

  await saveToken(null);
  await saveRefreshToken(null);
  await clearExpoPushToken();
  await clearRoleSelection();
  await clearUserRole();
};

export const updateProfile = (payload) =>
  request("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteMyAccount = (password) =>
  request("/api/auth/me", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });

export const changeMyPassword = (currentPassword, newPassword) =>
  request("/api/auth/me/password", {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
  });

export const logoutAllDevices = () =>
  request("/api/auth/logout-all", {
    method: "POST",
  });

export const fetchMyActivity = (limit = 30) =>
  request(`/api/auth/activity?limit=${Math.max(1, Math.min(Number(limit) || 30, 100))}`);

export const exportMyData = () => request("/api/auth/export");

// ============================================================
//   Secretary Management APIs
// ============================================================
export const fetchSecretaries = () => request("/api/secretaries");

export const createSecretary = (data) =>
  request("/api/secretaries", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateSecretary = (id, data) =>
  request(`/api/secretaries/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteSecretary = (id) =>
  request(`/api/secretaries/${id}`, {
    method: "DELETE",
  });

export const fetchSecretaryActivity = (id, page = 1, limit = 20) =>
  request(`/api/secretaries/${id}/activity?page=${page}&limit=${limit}`);

// ============================================================
//   Inventory APIs (مخزن الطبيب)
// ============================================================
export const fetchInventory = () => request("/api/inventory");

/**
 * إنشاء عنصر مخزون جديد (مع دعم رفع الصورة)
 * @param {object} data - { name, type, price, purchaseDate, expiryDate }
 * @param {string|null} imageUri - مسار الصورة المحلية (اختياري)
 */
export const createInventoryItem = async (data, imageUri = null) => {
  const headers = await buildAuthHeaders();
  const form = new FormData();

  form.append("name", String(data.name || ""));
  form.append("type", String(data.type || ""));
  form.append("price", String(data.price || "0"));
  if (data.purchaseDate) form.append("purchaseDate", String(data.purchaseDate));
  if (data.expiryDate) form.append("expiryDate", String(data.expiryDate));

  if (imageUri) {
    const extension = String(imageUri).split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "gif", "webp"].includes(extension) ? extension : "jpg";
    form.append("image", {
      uri: imageUri,
      name: `inventory-${Date.now()}.${safeExt}`,
      type: `image/${safeExt === "jpg" ? "jpeg" : safeExt}`,
    });
  }

  const response = await fetch(`${API_BASE_URL}/api/inventory`, {
    method: "POST",
    headers,
    body: form,
  });

  return parseResponse(response);
};

/**
 * تحديث عنصر مخزون
 * @param {string} id
 * @param {object} data
 * @param {string|null} imageUri
 */
export const updateInventoryItem = async (id, data, imageUri = null) => {
  const headers = await buildAuthHeaders();
  const form = new FormData();

  if (data.name !== undefined) form.append("name", String(data.name));
  if (data.type !== undefined) form.append("type", String(data.type));
  if (data.price !== undefined) form.append("price", String(data.price));
  if (data.purchaseDate !== undefined) form.append("purchaseDate", String(data.purchaseDate || ""));
  if (data.expiryDate !== undefined) form.append("expiryDate", String(data.expiryDate || ""));

  if (imageUri) {
    const extension = String(imageUri).split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "gif", "webp"].includes(extension) ? extension : "jpg";
    form.append("image", {
      uri: imageUri,
      name: `inventory-${Date.now()}.${safeExt}`,
      type: `image/${safeExt === "jpg" ? "jpeg" : safeExt}`,
    });
  }

  const response = await fetch(`${API_BASE_URL}/api/inventory/${id}`, {
    method: "PUT",
    headers,
    body: form,
  });

  return parseResponse(response);
};

export const deleteInventoryItem = (id) =>
  request(`/api/inventory/${id}`, { method: "DELETE" });

// ============================================================
//   Lab APIs  /api/labs
// ============================================================

// Profile
export const fetchLabProfile = () => request("/api/labs/me");
export const updateLabProfile = (data) =>
  request("/api/labs/me", { method: "PATCH", body: JSON.stringify(data) });

// Test Catalog
export const fetchLabTests = (params = {}) => {
  const q = new URLSearchParams();
  if (params.category) q.set("category", params.category);
  if (params.search)   q.set("search",   params.search);
  if (params.active !== undefined) q.set("active", String(params.active));
  return request(`/api/labs/tests?${q}`);
};
export const createLabTest = (data) =>
  request("/api/labs/tests", { method: "POST", body: JSON.stringify(data) });
export const updateLabTest = (id, data) =>
  request(`/api/labs/tests/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteLabTest = (id) =>
  request(`/api/labs/tests/${id}`, { method: "DELETE" });

// Orders
export const fetchLabOrders = (params = {}) => {
  const q = new URLSearchParams();
  if (params.status)   q.set("status",   params.status);
  if (params.priority) q.set("priority", params.priority);
  if (params.search)   q.set("search",   params.search);
  if (params.date)     q.set("date",     params.date);
  if (params.page)     q.set("page",     String(params.page));
  return request(`/api/labs/orders?${q}`);
};
export const createLabOrder = (data) =>
  request("/api/labs/orders", { method: "POST", body: JSON.stringify(data) });
export const fetchLabOrder = (id) => request(`/api/labs/orders/${id}`);
export const updateLabOrder = (id, data) =>
  request(`/api/labs/orders/${id}`, { method: "PATCH", body: JSON.stringify(data) });

// Results
export const enterLabResult = (orderId, testId, data) =>
  request(`/api/labs/orders/${orderId}/results/${testId}`, {
    method: "PATCH", body: JSON.stringify(data)
  });
export const verifyLabResult = (orderId, testId) =>
  request(`/api/labs/orders/${orderId}/results/${testId}/verify`, { method: "PATCH" });
export const approveLabResult = (orderId, testId) =>
  request(`/api/labs/orders/${orderId}/results/${testId}/approve`, { method: "PATCH" });

// Patients
export const fetchLabPatients = (params = {}) => {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.page)   q.set("page",   String(params.page));
  return request(`/api/labs/patients?${q}`);
};
export const fetchLabPatientOrders = (phone) =>
  request(`/api/labs/patients/${encodeURIComponent(phone)}/orders`);

// Dashboard
export const fetchLabDashboard = () => request("/api/labs/dashboard");

