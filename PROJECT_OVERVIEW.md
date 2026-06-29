# MedicalBookingApp (Medicare) — Project Overview

> **Purpose of this file:** A complete, self-contained description of the mobile
> application so that any developer **or any AI agent** can understand what this
> project is, what it does, how it is structured, and how all the pieces fit
> together — without having to read every file first.

---

## 1. What is this project?

**MedicalBookingApp** (product name **"Medicare"**) is the **mobile phone
application** of a larger medical-booking platform. It is built with
**Expo / React Native** and ships to both **Android** and **iOS** (plus a
limited web build via `react-native-web`).

It is a **single app that serves four different kinds of users (roles)** from
one codebase. After login, the app routes each user to a completely different
experience based on their role:

| Role | Arabic label | What they do in the app |
|------|--------------|--------------------------|
| **patient** | المريض | Browse doctors/specialties/centers, book appointments, chat with doctors, view medical records & ratings. |
| **doctor** (provider) | الطبيب | Manage appointments, schedule, services, patients archive, inventory (مخزن), reports, chat, employees. |
| **secretary** (employee) | الموظف/السكرتير | A restricted provider account that helps a doctor manage bookings & patients. |
| **lab** | المختبر | Lab dashboard: test catalog, orders, result entry/verification, lab patients, reports. |

The UI is **Arabic-first and fully RTL** (right-to-left). The app forces RTL
layout and default right-aligned text globally (see `App.js`).

### Where it fits in the wider platform
This repo is **only the mobile client**. It talks to a backend over HTTPS +
WebSocket. Sibling projects in the same workspace (for context — not part of
this repo):
- **medi-care-backend** — the REST + Socket.IO API server this app consumes.
- **Admin** — a separate super-admin web dashboard.
- **medicare-website** — the public marketing/website.
- **MedicareDesktop** — an Electron desktop rebuild of the provider/lab side.

The mobile app reaches the backend at **`https://api.medicare-iq.com`** (the
default `apiBaseUrl`; overridable — see [§9](#9-configuration--environment)).

---

## 2. Technology stack

| Area | Technology |
|------|------------|
| Framework | **Expo SDK 54**, **React Native 0.81.5**, **React 19.1** |
| Language | JavaScript (with a light `tsconfig.json`; most code is `.js`) |
| JS engine | **Hermes** |
| Navigation | **React Navigation v7** — native-stack + bottom-tabs + drawer |
| Local storage | `@react-native-async-storage/async-storage` |
| Real-time | **Socket.IO client** (`socket.io-client`) |
| Push notifications | **expo-notifications** (Expo push service) + Firebase (`google-services.json`) |
| End-to-end chat encryption | **TweetNaCl** (`tweetnacl`, `tweetnacl-util`) — X25519 + XSalsa20-Poly1305 |
| Maps & location | `react-native-maps`, `expo-location` (clinic/center location picking) |
| Media | `expo-image-picker`, `expo-camera`, `expo-media-library`, `expo-file-system` |
| UI / icons | `lucide-react-native`, `@expo/vector-icons` (Feather), `expo-linear-gradient`, `react-native-animatable`, `react-native-reanimated` |
| OTA updates | **expo-updates** (EAS Update channel) |
| Build / release | **EAS Build** + **EAS Update** (config in `eas.json`) |

---

## 3. High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Mobile App (this repo)                │
│                                                              │
│  App.js  ── boots, decides initial route by stored role      │
│    │                                                         │
│    ├── Providers:  ThemeProvider → CenterProvider → AppInner │
│    │                                                         │
│    ├── Navigation (React Navigation):                        │
│    │     • Native Stack (auth + all screens)                 │
│    │     • Bottom Tabs   (patient + lab)                     │
│    │     • Drawer        (doctor/secretary "provider")       │
│    │                                                         │
│    └── withRoleGuard(...)  ── per-screen role enforcement    │
│                                                              │
│  lib/  ── the "SDK" layer (no UI):                           │
│     api.js            REST client + all endpoints            │
│     socket.js         Socket.IO singleton                    │
│     e2ee.js           NaCl end-to-end encryption for chat    │
│     pushNotifications.js  Expo push token registration       │
│     ThemeProvider / theme / useTheme   light/dark theming    │
│     centerContext.js  "currently selected medical center"    │
│     firebase.js, maps.js, publicConfig.js, ...              │
│                                                              │
│  screens/  ── ~50 screen components (one per page)           │
└───────────────┬──────────────────────────────────────────────┘
                │ HTTPS (REST) + WSS (Socket.IO)
                ▼
        https://api.medicare-iq.com   (medi-care-backend)
                │
                ▼
        Expo Push Service  ←→  Firebase Cloud Messaging
```

### App startup flow (`App.js` → `AppInner`)
1. Wrap the tree in `SafeAreaProvider → ThemeProvider → CenterProvider`.
2. Force **RTL** and set default right-aligned text styles.
3. Run **OTA update check** (`useOTAUpdates`).
4. Read the stored auth **token** and **role** from AsyncStorage.
   - No token → go to **`RoleSelection`** (entry/auth screen).
   - Token but no cached role → call `fetchMe()` to resolve the role.
   - Then pick the **initial route** by role:
     - `doctor` / `secretary` → **`ProviderTabs`** (drawer)
     - `lab` → **`LabTabs`**
     - `patient` → **`MainTabs`**
5. After navigation is ready, **register the Expo push token** with the backend
   (non-blocking).
6. Install a **notification-response listener**: tapping a push (or the
   "قبول الحجز / Accept booking" action button) deep-links into the right
   screen, and can even **accept a doctor appointment directly from the
   notification** via `acceptDoctorAppointment()`.

### Role guarding
`withRoleGuard(Component, allowedRoles)` wraps every protected screen. It:
- Reads the stored role, normalizes it (`normalizeUserRole`).
- Redirects to the correct root if the role doesn't match the screen.
- Falls back to `RoleSelection` if the role can't be resolved within 5s.

Guarded screen instances are created **once at module scope** to keep stable
component references (prevents remount thrash on re-render).

---

## 4. Navigation map

There is one **root native-stack navigator** (`Stack.Navigator` in `App.js`).
Three of its screens are themselves **nested navigators**:

### Auth / entry (stack screens, no role)
- `RoleSelection` → `Login` → `Signup` → `VerifyEmail`
- `LabSignup` (separate lab onboarding)

### `MainTabs` — Patient experience (Bottom Tabs)
| Tab | Screen | Title |
|-----|--------|-------|
| `HomeTab` | `tabs/home-v2` | الرئيسية |
| `AppointmentsTab` | `tabs/appointments` | المواعيد |
| `MedicalRecordsTab` | `tabs/medical-records` | السجلات |
| `ProfileTab` | `tabs/profile` | الملف الشخصي |

Patient stack screens reachable from tabs: `Specialty`, `DoctorDetails`,
`BookAppointment`, `BookingSummary`, `MyAppointments`, `AppointmentDetails`,
`AppointmentChat`, `CentersMini`, `CenterDoctors`, `PersonalInfo`,
`MedicalRecords`, `ProfileSettings`, `ChangePassword`, `DeleteAccount`,
`ActivityLog`, `Support`.

### `ProviderTabs` — Doctor / Secretary experience (Drawer, opens from right)
| Drawer item | Screen | Title |
|-------------|--------|-------|
| `ProviderAppointmentsTab` | `provider-appointments` | الحجوزات |
| `ProviderPatientsTab` | `patients` | المرضى |
| `ProviderConversationsTab` | `provider-conversations` | المحادثات |
| `ProviderReportsTab` | `provider-reports` | التقارير |
| `ProviderScheduleTab` | `schedule-management` | الجدول |
| `ProviderServicesTab` | `provider-services` | إدارة الخدمات |
| `SecretaryManagementTab` | `secretary-management` | الموظفين |
| `ProviderSettingsTab` | `provider-settings` | الإعدادات |
| `ProviderInventoryTab` | `provider-inventory` | المخزن |
| `ProviderProfileTab` | `provider-profile` | الملف |

Plus provider stack screens: `ProviderProfileEdit`, `DoctorAppointments`,
`BlockedPatients`, `ScheduleManagement`.

### `LabTabs` — Lab experience (Bottom Tabs)
| Tab | Screen | Title |
|-----|--------|-------|
| `LabDashTab` | `lab-dashboard` | الرئيسية |
| `LabOrdersTab` | `lab-orders` | الطلبات |
| `LabTestsTab` | `lab-tests` | الفحوصات |
| `LabPatientsTab` | `lab-patients` | المرضى |
| `LabProfileTab` | `lab-profile` | الإعدادات |

Plus lab stack screens: `LabResultEntry`, `LabReports`.

### Shared
- `LocationPicker` (with a web variant `location-picker.web.js`) — pick a clinic
  location on the map.

---

## 5. Screen inventory (`screens/`)

~50 screen files. Grouped by role:

**Auth / common**
`role-selection.js`, `login.js`, `signup.js`, `verify-email.js`,
`change-password.js`, `delete-account.js`, `activity-log.js`, `support.js`,
`profile.js`, `profile-settings.js`, `personal-info.js`, `notifications.js`,
`location-picker.js` (+ `.web.js`).

**Patient**
`tabs/home-v2.js` (+ legacy `home.js`), `tabs/appointments.js`,
`tabs/medical-records.js`, `tabs/my-appointments.js`, `tabs/profile.js`,
`specialty/[slug].js`, `doctor-detalis.js` *(note the original spelling)*,
`book-appointment.js`, `booking-summary.js`, `my-appointments.js`,
`appointment-details.js`, `appointment-chat.js`, `medical-records.js`,
`centers-mini.js`, `center-doctors.js`, `center-selector.js`.

**Doctor / Secretary (provider)**
`provider-dashboard.js`, `provider-profile.js`, `provider-profile-edit.js`,
`provider-appointments.js`, `provider-conversations.js`, `provider-reports.js`,
`provider-services.js`, `provider-settings.js`, `provider-inventory.js`,
`doctor-appointments.js`, `doctor-detalis.js`, `schedule-management.js`,
`secretary-management.js`, `patients.js`, `blocked-patients.js`.

**Lab**
`lab-dashboard.js`, `lab-orders.js`, `lab-tests.js`, `lab-patients.js`,
`lab-reports.js`, `lab-result-entry.js`, `lab-profile.js`, `lab-signup.js`.

> Total screen code ≈ **25,000 lines** — the heaviest screens are
> `signup.js` (~1,070 lines) and `secretary-management.js` (~960 lines).

---

## 6. The `lib/` layer (the app's "SDK")

This folder holds all non-UI logic. It is the most important thing for an AI to
understand because every screen depends on it.

### `lib/api.js` — REST client + endpoint catalog
The single source of truth for talking to the backend.

- **Base URL resolution** (`getConfiguredApiBaseUrl`): priority is
  `EXPO_PUBLIC_API_BASE_URL` env → `app.json` `extra.apiBaseUrl` →
  `https://api.medicare-iq.com`.
- **Auth storage keys** in AsyncStorage:
  `medicare_token`, `medicare_refresh_token`, `medicare_role_selection`,
  `medicare_user_role`, `medicare_expo_push_token` (+ legacy `token`).
- **`request(path, options)`** — central fetch wrapper with:
  - Bearer-token injection.
  - 30s timeout via `AbortController` (`fetchWithTimeout`).
  - Typed errors (`ApiError` with `.status` and `.payload`).
  - **Automatic one-time refresh on `401`**: calls `/api/auth/refresh` with the
    stored refresh token, saves new tokens, retries the original request once.
- **`normalizeUserRole`** maps many aliases → `doctor | patient | secretary | lab`.

**Endpoint groups exported as named functions** (selected):
- *Auth/profile:* `fetchMe`, `updateProfile`, `deleteMyAccount`,
  `changeMyPassword`, `logout`, `logoutAllDevices`, `fetchMyActivity`,
  `exportMyData`.
- *Appointments (patient):* `bookAppointment`, `fetchAppointments`,
  `fetchAppointment`, `cancelAppointment`, `rateAppointment`,
  `fetchPatientMedicalRecords`.
- *Doctors:* `fetchDoctors`, `fetchDoctorDashboard`, `saveDoctorSchedule`,
  `fetchDoctorAppointments`, `accept/reject/cancel/complete/reschedule
  DoctorAppointment`, `createDoctorAppointment` (manual), `saveDoctorNote`,
  `updateDoctorProfile`, `assignEmployeeToAppointment`.
- *Doctor archives (patient history):* `fetch/create/update/delete
  DoctorArchive*`, `fetch/saveArchiveTemplate`, `uploadDoctorArchiveFile`
  (multipart upload, images/PDF).
- *Centers (multi-doctor clinics):* `fetchCenters`, `fetchCenterById`,
  `fetchCenterDoctors`, `fetchCenterDoctorServices`,
  `fetchCenterDoctorBlockedSlots`, `bookCenterAppointment`,
  `fetchDoctorCenterBookings`, `accept/cancel/complete/reschedule
  DoctorCenterBooking`, `fetchMyDoctorCenters`, `updateMyDoctorCenterSchedule`.
- *Services:* `fetch/create/update MyDoctorService` and `*CenterDoctorService`.
- *Blocks:* `setBlock`, `getBlock`, `fetchBlockedPatients` (block a patient
  from booking and/or chatting).
- *Chat:* `fetchChatContext`, `fetchChatMessages`, `fetchDoctorChatConversations`,
  `sendChatMessage`, `uploadChatImage`, `markMessagesRead/Delivered`,
  `sendTypingIndicator`, `get/updateChatSettings`, **`get/setChatPublicKey`**
  (E2EE key exchange).
- *Reports:* `generateDailyReportLink`, `generateDailyReportExcelLink`,
  `generateMonthlyReportExcelLink`, `fetchDoctorsBySpecialty`.
- *Push:* `registerExpoPushToken`, `unregisterPushToken(s)`.
- *Secretaries:* `fetchSecretaries`, `create/update/deleteSecretary`,
  `fetchSecretaryActivity`.
- *Inventory (مخزن):* `fetchInventory`, `create/update/deleteInventoryItem`
  (multipart with optional image).
- *Patient display screen:* `generatePatientDisplay` → `POST /api/display/generate`
  (creates a public "waiting-room names" display URL).
- *Lab (`/api/labs`):* `fetchLabProfile`, `updateLabProfile`, `fetchLabTests`,
  `create/update/deleteLabTest`, `fetchLabOrders`, `createLabOrder`,
  `fetchLabOrder`, `updateLabOrder`, `enterLabResult`, `verifyLabResult`,
  `approveLabResult`, `fetchLabPatients`, `fetchLabPatientOrders`,
  `fetchLabDashboard`.

### `lib/socket.js` — real-time
Lazy **singleton** Socket.IO client connected to `API_BASE_URL`, authenticated
with `auth: { token }`, transports `["websocket", "polling"]`. Used for live
chat, typing indicators, delivery/read receipts, and live appointment updates.
`disconnectSocket()` tears it down on logout.

### `lib/e2ee.js` — end-to-end encrypted chat
Real **end-to-end encryption** for patient↔doctor messages using TweetNaCl:
- Algorithm: **`x25519-xsalsa20-poly1305`** (`nacl.box`), version `1`.
- `ensureE2EEKeypair(userId)` generates & persists a per-user keypair in
  AsyncStorage (`CHAT_E2EE_KEYPAIR_<userId>`). The **public key is uploaded** to
  the backend via `setChatPublicKey`; the peer's key is fetched via
  `getChatPublicKey`.
- `encryptE2EE` / `decryptE2EE` produce/consume `{ v, alg, nonce, ciphertext }`
  (all base64). The server stores only ciphertext — it cannot read messages.

### `lib/pushNotifications.js` — Expo push registration
`registerForPushNotificationsAsync({ silent })`:
- Skips on non-physical devices.
- Ensures the Android notification channel `"default"` (MAX importance).
- Requests permission; if permanently denied, offers to open OS settings
  (unless `silent`).
- Fetches the Expo push token using the EAS `projectId`
  (`7d991cce-...`), with a retry + 30s timeouts. Returns
  `{ expoPushToken }` shaped like `ExponentPushToken[...]`.

### Theming — `ThemeProvider.js`, `theme.js`, `useTheme.js`
Light/dark color palettes. Brand primary is **`#1e4980`** (deep blue; lab
accent is teal `#0D9488`). `useAppTheme()` exposes `{ colors, isDark,
navigationTheme }`. Theme is also wired into React Navigation.

### Other `lib/` modules
- `centerContext.js` — React context storing the **currently selected medical
  center** (`medicare_center_id` / `_name`) so center-scoped screens know which
  clinic they operate in.
- `firebase.js` — Firebase init (used alongside FCM for push).
- `maps.js` — map helpers; `publicConfig.js` — fetch public runtime config;
  `supportConfig.js` — support contact info.
- `cleanArabicText.js` — Arabic text normalization helper.
- `useOTAUpdates.js` — checks/applies EAS OTA updates on launch & foreground.
- `constants/` — `specialties.js` (the catalog of medical specialties shown to
  patients, e.g. cardiology/neurology/dermatology/pediatrics…),
  `schedule.js` (scheduling helpers), `statusLabels.js`
  (`confirmed→مؤكد`, `pending→قيد الانتظار`, `completed→مكتمل`, `cancelled→ملغى`).

---

## 7. Core user flows (what the app actually does)

**Patient booking flow:**
`Home → Specialty / Center → DoctorDetails → BookAppointment
(pick service + time slot, blocked slots respected) → BookingSummary →
MyAppointments`. The patient can then **chat (E2EE)** with the doctor, get
**push notifications** on confirmation, and **rate** a completed appointment.

**Doctor flow:**
Receives a new-booking push (with an inline **"قبول الحجز / Accept"** action) →
manages bookings in `ProviderAppointments`
(accept/reject/complete/reschedule/assign-to-employee) → keeps a per-patient
**archive** with templates & file uploads → manages **services**, **schedule**,
**inventory**, **employees (secretaries)**, **blocked patients**, and views
**daily/monthly reports** (PDF/Excel links). Can also spin up a public
**waiting-room name display** screen.

**Secretary flow:** a constrained doctor account — helps with bookings/patients
under a doctor; activity is logged per secretary.

**Lab flow:**
Dashboard KPIs → manage **test catalog** → receive/manage **orders** →
**enter results → verify → approve** → manage **lab patients** and **reports**.

**Cross-cutting:** real-time chat & receipts (Socket.IO), E2EE messaging, push
notifications, RTL Arabic UI, light/dark theme, OTA updates, account management
(change password, export data, delete account, logout-all-devices, activity log).

---

## 8. Notifications deep-dive

- **Channel:** Android `"default"` channel, MAX importance, custom vibration,
  light color `#38BDF8`, sound on.
- **Category `DOCTOR_APPOINTMENT_ACTIONS`** with an `ACCEPT_APPOINTMENT` action
  button — lets a doctor accept a new booking straight from the notification.
- **Foreground handler** shows alert + sound + badge.
- **Response listener** (in `AppInner`) deep-links by `data.{type, role,
  appointmentId}`:
  - patient + `appointment_confirmed` → `MyAppointments`
  - doctor + `appointment_created` → `ProviderTabs/ProviderAppointmentsTab`
  - `ACCEPT_APPOINTMENT` action → calls `acceptDoctorAppointment(id)` immediately.

---

## 9. Configuration & environment

From **`app.json`** (`expo`):
- `name: "Medicare"`, `slug: "medicare"`, `version: 1.0.11`, `scheme:
  medicalbookingapp`, `jsEngine: hermes`, `orientation: portrait`.
- **OTA updates** enabled, `checkAutomatically: ON_LOAD`, EAS Update URL
  `https://u.expo.dev/7d991cce-...`.
- **iOS** bundle `com.Auday.MedicalBookingApp`; permission strings (Arabic) for
  photos, camera, location.
- **Android** package `com.Auday.MedicalBookingApp`, `versionCode 11`,
  `googleServicesFile: ./google-services.json`; permissions: CAMERA,
  COARSE/FINE_LOCATION, READ_EXTERNAL_STORAGE, POST_NOTIFICATIONS.
- **Plugins:** expo-notifications, expo-font, expo-build-properties (Android
  SDK 35), datetimepicker, expo-updates.
- **`extra`:** `apiBaseUrl: https://api.medicare-iq.com`, plus
  `privacyPolicyUrl`, `termsUrl`, `accountDeletionUrl`, and EAS
  `projectId: e8673cbe-...`. Owner: `uuofis-organization`.

**Override the API at build/run time** with `EXPO_PUBLIC_API_BASE_URL`.

From **`eas.json`** — three build profiles:
- `development` (dev client, internal), `preview` (internal APK),
  `production` (auto-incremented, APK, `GOOGLE_SERVICES_JSON` from EAS secret).
- `appVersionSource: remote`. Channels: development / preview / production.

---

## 10. How to run / build

```bash
# Install
npm install

# Start Metro on LAN (custom launcher in scripts/start-lan.js)
npm start            # = node scripts/start-lan.js
npm run start:tunnel # ngrok tunnel for remote devices

# Native runs (require native toolchains)
npm run android      # expo run:android
npm run ios          # expo run:ios
npm run web          # expo start --web

# Lint
npm run lint
```

**Entry point:** `index.js` → registers `App` (from `App.js`).
**Build & release:** via **EAS** (`eas build --profile production`) and OTA via
**EAS Update** (`eas update`).

> Notes: `babel.config.js`, `metro.config.js`, `webTextScale.js`,
> `PatchedText.js`, and `thread.worker.js` provide RN/Metro/text-scaling/worker
> tweaks. `.easignore` controls what is excluded from EAS uploads.

---

## 11. Conventions & gotchas for future contributors / AI agents

- **Arabic-first, forced RTL.** New text defaults to right-aligned. Keep UI
  copy in Arabic to match the rest of the app.
- **Roles are everything.** Any new screen must be wrapped with
  `withRoleGuard(Component, [allowedRoles])` and registered in `App.js`. Use the
  canonical role strings `doctor | patient | secretary | lab` (normalize input
  with `normalizeUserRole`).
- **Always call the backend through `lib/api.js`** (`request` / the named
  helpers) so you inherit auth, token refresh, timeouts, and error typing.
  Don't hand-roll `fetch` except for the existing multipart uploads.
- **Chat is end-to-end encrypted.** Never send plaintext message bodies to the
  server — encrypt with `lib/e2ee.js` and exchange public keys via the
  `chat/public-key` endpoints.
- **One Socket.IO instance.** Reuse `getSocket()`; disconnect on logout.
- **Filename quirk:** the doctor details screen is `doctor-detalis.js`
  (misspelled) — keep imports consistent with the existing name.
- **`screens/schedule-management.js.bak`** is a stale backup, not used.
- **Centers vs. solo doctors:** appointments exist both as solo-doctor
  appointments (`/api/doctors/...`) and center bookings
  (`/api/centers/:id/bookings/...`). Check `centerContext` to know which path
  applies.
- **Tokens & role live in AsyncStorage** under the `medicare_*` keys; clearing
  them (via `logout()`) resets the app to `RoleSelection`.

---

*Generated as an orientation document for the MedicalBookingApp (Medicare)
mobile client. If code and this document disagree, the code is authoritative —
update this file when architecture changes.*
