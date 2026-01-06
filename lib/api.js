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
const FCM_PUSH_TOKEN_KEY = "medicare_fcm_push_token";

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
  if (!role) {
    await AsyncStorage.removeItem(ROLE_SELECTION_KEY);
    return;
  }
  await AsyncStorage.setItem(ROLE_SELECTION_KEY, role);
};

export const getRoleSelection = () =>
  AsyncStorage.getItem(ROLE_SELECTION_KEY);

export const clearRoleSelection = () =>
  AsyncStorage.removeItem(ROLE_SELECTION_KEY);

export const saveUserRole = async (role) => {
  if (!role) {
    await AsyncStorage.removeItem(USER_ROLE_KEY);
    return;
  }
  await AsyncStorage.setItem(USER_ROLE_KEY, role);
};

export const getUserRole = () => AsyncStorage.getItem(USER_ROLE_KEY);

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

export const saveFcmPushToken = async (fcmPushToken) => {
  const value = String(fcmPushToken || "").trim();
  if (!value) {
    await AsyncStorage.removeItem(FCM_PUSH_TOKEN_KEY);
    return;
  }
  await AsyncStorage.setItem(FCM_PUSH_TOKEN_KEY, value);
};

export const getFcmPushToken = () => AsyncStorage.getItem(FCM_PUSH_TOKEN_KEY);

export const clearFcmPushToken = () => AsyncStorage.removeItem(FCM_PUSH_TOKEN_KEY);

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

export const request = async (path, options = {}) => {
  const headers = await buildHeaders(options.headers);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
    return parseResponse(response);
  } catch (err) {
    // Auto-refresh once on 401, then retry
    if (err instanceof ApiError && err.status === 401 && !options.__retried) {
      const rt = await getRefreshToken();
      if (rt) {
        try {
          const refreshed = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: rt }),
          });
          const data = await parseResponse(refreshed);
          if (data?.token) await saveToken(data.token);
          if (data?.refreshToken) await saveRefreshToken(data.refreshToken);

          const retryHeaders = await buildHeaders(options.headers);
          const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            __retried: true,
            headers: retryHeaders,
          });
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
export const fetchAppointment = (id) => request(`/api/appointments/${id}`);
export const cancelAppointment = (id) =>
  request(`/api/appointments/${id}/cancel`, {
    method: "PATCH",
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
export const deleteDoctorAppointment = (id) =>
  request(`/api/doctors/appointments/${id}`, {
    method: "DELETE",
  });
export const fetchDoctorsBySpecialty = () =>
  request("/api/reports/doctors-by-specialty");

export const fetchDoctorBlockedSlots = (doctorId, days = 14) =>
  request(
    `/api/reports/doctors/${doctorId}/booked-slots?days=${Math.max(1, Math.min(days, 30))}`
  );

// Doctor services
export const fetchDoctorServices = (doctorId) =>
  request(`/api/doctors/${doctorId}/services`);

export const fetchMyDoctorServices = () => request("/api/doctors/me/services");

export const createMyDoctorService = (payload) =>
  request("/api/doctors/me/services", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateMyDoctorService = (serviceId, payload) =>
  request(`/api/doctors/me/services/${serviceId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const fetchMessages = (appointmentId) =>
  request(`/api/messages/${appointmentId}`);

export const fetchMe = () => request("/api/auth/me");

export const setMyChatPublicKey = (publicKey) =>
  request("/api/messages/e2ee/key", {
    method: "PUT",
    body: JSON.stringify({ publicKey: String(publicKey || "").trim() }),
  });

export const fetchChatE2EEKeys = (appointmentId) =>
  request(`/api/messages/${appointmentId}/e2ee/keys`);

export const sendMessage = (appointmentId, text, replyTo) =>
  request(`/api/messages/${appointmentId}`, {
    method: "POST",
    body: JSON.stringify(replyTo ? { text, replyTo } : { text }),
  });


export const sendMessageE2EE = (appointmentId, e2ee, replyTo) =>
  request(`/api/messages/${appointmentId}`,
    {
      method: "POST",
      body: JSON.stringify(replyTo ? { e2ee, replyTo } : { e2ee }),
    });
export const uploadChatImage = async (appointmentId, { uri, mimeType, fileName } = {}) => {
  if (!appointmentId) throw new ApiError("Missing appointmentId", 400, {});
  if (!uri) throw new ApiError("Missing file uri", 400, {});

  const headers = await buildAuthHeaders();
  const form = new FormData();
  form.append("file", {
    uri,
    type: mimeType || "image/jpeg",
    name: fileName || `chat-${Date.now()}.jpg`,
  });

  const response = await fetch(`${API_BASE_URL}/api/messages/${appointmentId}/upload`, {
    method: "POST",
    headers,
    body: form,
  });
  return parseResponse(response);
};

export const deleteMessage = (appointmentId, messageId) =>
  request(`/api/messages/${appointmentId}/${messageId}`, {
    method: "DELETE",
  });

export const reportMessage = (appointmentId, messageId, reason) =>
  request(`/api/messages/${appointmentId}/${messageId}/report`, {
    method: "POST",
    body: JSON.stringify({ reason: String(reason || "").trim() }),
  });

export const setBlock = (patientId, { blockChat, blockBooking }) =>
  request("/api/blocks", {
    method: "POST",
    body: JSON.stringify({ patientId, blockChat, blockBooking }),
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

export const registerPushToken = (expoPushToken) =>
  request("/api/notifications/register-token", {
    method: "POST",
    body: JSON.stringify({ expoPushToken }),
  }).then(async (data) => {
    // Keep a local copy so we can unregister on logout.
    await saveExpoPushToken(expoPushToken);
    return data;
  });

export const registerPushTokens = ({ expoPushToken, fcmPushToken } = {}) => {
  const payload = {
    ...(expoPushToken ? { expoPushToken } : {}),
    ...(fcmPushToken ? { fcmPushToken } : {}),
  };

  return request("/api/notifications/register-token", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then(async (data) => {
    if (expoPushToken) await saveExpoPushToken(expoPushToken);
    if (fcmPushToken) await saveFcmPushToken(fcmPushToken);
    return data;
  });
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

export const unregisterPushTokens = async ({ expoPushToken, fcmPushToken } = {}) => {
  const expoToken = String(expoPushToken || "").trim();
  const fcmToken = String(fcmPushToken || "").trim();
  const payload = {
    ...(expoToken ? { expoPushToken: expoToken } : {}),
    ...(fcmToken ? { fcmPushToken: fcmToken } : {}),
  };

  const res = await request("/api/notifications/unregister-token", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (expoToken) await clearExpoPushToken();
  if (fcmToken) await clearFcmPushToken();
  return res;
};

export const logout = async () => {
  // Best-effort: detach this device push token from the current account before clearing auth.
  try {
    const [expoPushToken, fcmPushToken] = await Promise.all([
      getExpoPushToken(),
      getFcmPushToken(),
    ]);

    if (expoPushToken || fcmPushToken) {
      await unregisterPushTokens({ expoPushToken, fcmPushToken });
    } else {
      // If tokens weren't stored locally, still try to clear on server.
      await request("/api/notifications/unregister-token", { method: "POST" });
    }
  } catch (err) {
    // ignore: logout should still proceed even if network fails
  }

  await saveToken(null);
  await saveRefreshToken(null);
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
