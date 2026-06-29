# MedicalBookingApp (Medicare) — Screens Reference

> **Purpose:** A complete, page-by-page reference of every screen in the mobile
> app. Each screen has its own section with: what it is, who can see it (role),
> what it shows, what the user can do, which backend APIs it calls, and where it
> navigates. Read [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) first for the
> high-level architecture; this file is the detailed per-screen companion.

**Legend**
- **Route name** = the name registered in `App.js` `Stack.Navigator`.
- **Role** = which user role(s) can reach the screen (enforced by `withRoleGuard`).
- **File** = path under `screens/`.
- APIs are the helpers from `lib/api.js` unless noted as raw `fetch`.

The thin files `screens/tabs/appointments.js`, `medical-records.js`,
`profile.js`, `my-appointments.js` are **re-export wrappers** that simply render
the underlying screen inside a tab; they contain no logic. `screens/index.js`
re-exports `role-selection` as the default entry.

---

# A. Authentication & Entry

## A1. Role Selection — `RoleSelection`
- **File:** `screens/role-selection.js` · **Role:** none (entry screen) · **~136 lines**
- **What it is:** The very first screen for logged-out users (and the fallback
  whenever the role can't be resolved). Lets the user pick whether they are a
  **مراجع (patient)** or **دكتور (doctor)**.
- **UI:** Hero image (`im5.png`), title "اختر نوع الحساب", and a card per role
  with a title + description. *(A "مختبر/lab" option exists in code but is
  currently commented out — labs reach the app via `LabSignup`/`Login`.)*
- **Actions:** Tapping a card clears any existing auth (`saveToken(null)`,
  `saveRefreshToken(null)`, `clearExpoPushToken`, `clearUserRole`), saves the
  chosen role with `saveRoleSelection(role)`, then `navigation.reset` → `Login`
  with `{ role }`.
- **APIs:** none (only local AsyncStorage writes via `lib/api` helpers).

## A2. Login — `Login`
- **File:** `screens/login.js` · **Role:** none · **~578 lines**
- **What it is:** Phone + password login, role-aware (patient/doctor/lab).
- **UI:** Logo (`im3.png`), app name "MediCare", a tagline that switches between
  "دخول الأطباء" and "دخول المراجعين", phone field (10 digits starting with 7),
  password field with show/hide, a **privacy + terms consent checkbox**
  (required), primary "تسجيل الدخول" button, "إنشاء حساب" button, "نسيت الرمز؟",
  and "تغيير نوع الحساب أو تسجيل خروج".
- **Key logic:**
  - **Auto-skip:** `useFocusEffect` — if a token already exists, it resolves the
    role and redirects straight to `ProviderTabs` / `LabTabs` / `MainTabs`
    (never shows login to an already-authenticated user).
  - **Phone normalization** (`normalizeIraqPhoneTo10Digits`): accepts
    `+964…`, `07…`, or `7…` and reduces to 10 digits starting with `7`.
  - **Doctor-specific errors:** handles `DOCTOR_ACCOUNT_NOT_FOUND` and
    `DOCTOR_SUBSCRIPTION_EXPIRED` (the latter opens a WhatsApp deep-link to
    support to renew the subscription).
  - On success: saves token + refresh token + role, **registers the Expo push
    token with the backend**, then `navigation.reset` to the role's home.
- **APIs:** raw `POST /api/auth/login` (with `selectedRole`); `registerExpoPushToken`;
  `logout`. Reads support number from `lib/supportConfig`.
- **Navigates to:** `Signup` (or `LabSignup` for labs), `RoleSelection`,
  `ProviderTabs` / `LabTabs` / `MainTabs`.

## A3. Signup — `Signup`
- **File:** `screens/signup.js` · **Role:** none · **~1,072 lines** (largest auth screen)
- **What it is:** Registration for **patients** and **doctors** in one form; the
  doctor path requires a full professional profile.
- **Patient fields:** name, age (1–120), phone, password + confirm.
- **Doctor fields (additional):** specialty (from `lib/constants/specialties`
  `specialtyOptions`), license number, **avatar photo** (via `expo-image-picker`,
  uploaded as a base64 data-URL), **clinic location** (address + lat/lng picked
  on the map via `LocationPicker`), certification text, CV text, optional **fixed
  consultation fee**, and a **secretary phone** (required, for patient contact).
- **Key logic:**
  - Restores form state when returning from the map picker (`route.params.formState`
    + `pickedLocation`), so nothing is lost during navigation.
  - Requires agreeing to privacy + terms (`termsAgreed`).
  - Converts the picked image to a data URL (`imageUriToDataUrl`).
  - **Patients** get a token back → logged in immediately → `MainTabs`.
  - **Doctors** are created **pending admin approval** → alert → back to `Login`.
- **APIs:** raw `POST /api/auth/register`; `registerExpoPushToken` on patient
  success.
- **Navigates to:** `LocationPicker` (and back), `Login`, `MainTabs`.

## A4. Verify (OTP) — `VerifyEmail`
- **File:** `screens/verify-email.js` · **Role:** none · **~312 lines**
- **What it is:** A phone OTP verification screen used by both `signup` and
  `login` flows (`mode` param). **Note:** OTP is currently disabled in the normal
  flows (login/signup return a token directly), so this screen is wired but
  largely dormant.
- **UI:** Code input, verify button, and a resend button (signup mode only).
- **Key logic:** posts the code, saves the role; if a token comes back it saves
  it, registers push, and routes to `ProviderTabs`/`MainTabs`; if no token
  (e.g. doctor pending approval) it shows a "under review" message and returns to
  `Login`.
- **APIs:** raw `POST /api/auth/verify` or `/api/auth/login/verify`,
  `POST /api/auth/resend`; `registerExpoPushToken`.

## A5. Lab Signup — `LabSignup`
- **File:** `screens/lab-signup.js` · **Role:** none · **~172 lines**
- **What it is:** Dedicated registration for a **lab** account (teal-themed,
  accent `#0D9488`).
- **UI:** Hero, **Account Info** section (name, phone, password + confirm with
  show/hide), **Lab Info** section (lab name, **lab type** chips — general /
  clinical / pathology / microbiology / genetics / blood_bank / specialized —
  license number, city, address), submit, and a link to `Login` (`role: lab`).
- **Key logic:** validates required fields & matching passwords; submits with
  `role: "lab"`; the lab is created **pending admin approval**.
- **APIs:** raw `POST /api/auth/register`.
- **Navigates to:** `Login` (`role: lab`).

---

# B. Patient — Home & Tabs

The patient root is `MainTabs` (bottom tabs): **HomeTab**, **AppointmentsTab**,
**MedicalRecordsTab**, **ProfileTab**.

## B1. Home — `HomeTab` (`tabs/home-v2.js`)
- **File:** `screens/tabs/home-v2.js` · **Role:** patient · **~1,278 lines** (richest patient screen)
- **What it is:** The patient landing page — the main discovery hub for finding
  doctors, specialties, and centers.
- **Sections (top → bottom):**
  1. **Gradient hero header** with an animated typewriter "مرحباً بك / Medicare"
     greeting and a stethoscope badge.
  2. **Search bar** ("ابحث عن طبيب بالاسم أو الاختصاص") that filters the loaded
     doctors live; tapping a result goes straight to `BookAppointment`.
  3. **Auto-rotating image carousel** (7s interval, paged dots).
  4. **Quick actions** row: التخصصات (scrolls to specialties), المراكز
     (`CentersMini`), التحليلات/labs & التمريض/nursing (placeholder "قريباً").
  5. **Medical specialties grid** (`التخصصات الطبية`) built from
     `lib/constants/specialties` with rich Lucide/FontAwesome icons; tapping one
     opens `Specialty` with its `slug`.
  6. Doctor & center lists loaded from the backend.
- **Key logic:** on load it fetches **all doctors** and **all centers** (and each
  center's doctors), merges them into a searchable list, and de-dupes by id.
  Distinguishes **solo doctors** from **center doctors** (passes
  `medicalCenterId` + `doctorCenterId` when booking a center doctor). Can place a
  phone call via `Linking`. Pulls runtime banners/config via `fetchPublicConfig`.
- **APIs:** `fetchDoctors`, `fetchCenters`, `fetchCenterDoctors`,
  `fetchPublicConfig`.
- **Navigates to:** `Specialty`, `CentersMini`, `BookAppointment`.
- **Note:** `screens/tabs/home.js` (~1,235 lines) is the **older v1 home** and is
  **not wired** in `App.js` (superseded by `home-v2`).

## B2. Appointments tab → `my-appointments` (see D1)
- The `AppointmentsTab` renders `MyAppointmentsScreen` via the
  `tabs/appointments.js` wrapper. Documented in section **D1**.

## B3. Medical Records tab → `medical-records` (see E8)
- The `MedicalRecordsTab` renders `MedicalRecordsScreen` via the
  `tabs/medical-records.js` wrapper. Documented in section **E8**.

## B4. Profile — `ProfileTab` (`profile.js`)
- **File:** `screens/profile.js` · **Role:** patient · **~241 lines**
- **What it is:** The patient account hub (rendered in the `ProfileTab`).
- **UI:** A user card (initials avatar, name, "رقم حسابك" = phone) and a menu:
  - **المعلومات الشخصية** → `PersonalInfo`
  - **الإعدادات** → `ProfileSettings`
  - **مساعدة ودعم** → `Support`
  - **تسجيل خروج** → `logout()` then `Login`
- **Key logic:** loads the profile on mount and on focus (`useFocusEffect`); on
  401/403 it offers to re-login.
- **APIs:** `request("/api/auth/me")`, `logout`.

---

# C. Patient — Discovery & Booking flow

This is the core funnel: **Specialty / Center → choose doctor → BookAppointment
→ AppointmentDetails**.

## C1. Specialty doctors — `Specialty`
- **File:** `screens/specialty/[slug].js` · **Role:** patient · **~621 lines**
- **What it is:** Lists the doctors of one specialty (opened from the home
  specialties grid with a `slug` param).
- **UI:** Specialty header (title/description/highlights from
  `specialtyCatalog`), a **search box**, and a ranked list of doctors.
- **Key logic:** fetches doctors grouped by specialty (`fetchDoctorsBySpecialty`),
  **caches** the result in AsyncStorage (`cache_doctors_by_specialty_v2`), filters
  to the current `slug`, falls back to the static catalog if the API is empty,
  and **sorts by rating** (`compareDoctorsByRating`: rated doctors first, then by
  average, then count, then Arabic name). Selecting a doctor proceeds to
  `BookAppointment` / `DoctorDetails`.
- **APIs:** `fetchDoctorsBySpecialty`.

## C2. Doctor details — `DoctorDetails`
- **File:** `screens/doctor-detalis.js` *(filename intentionally misspelled)* · **Role:** patient · **~388 lines**
- **What it is:** A read-only doctor profile card. Almost entirely driven by
  **route params** (no fetch) — name, specialty, age, avatar, location (lat/lng),
  certification, CV, consultation fee (formatted as دينار), and rating.
- **Actions:** open the clinic location in Google Maps (`openInGoogleMaps` from
  `lib/maps`); proceed to booking.
- **APIs:** none (pure presentational).

## C3. Book appointment — `BookAppointment`
- **File:** `screens/book-appointment.js` · **Role:** patient · **~1,085 lines** (core transaction screen)
- **What it is:** The full booking workflow — pick a **service**, a **date**, and
  a **time slot**, then confirm. Works for **solo doctors**, **center doctors**,
  and a **doctor's own manual booking** path.
- **Key logic:**
  - Builds time slots from the doctor's **schedule** (`createTimeSlots`):
    start/end, slot **duration**, optional **break** window, and **active days**
    (`lib/constants/schedule`). `getNextActiveDates` lists the next working days.
  - Fetches the doctor's **services** (`fetchDoctorServices` /
    `fetchCenterDoctorServices`) and **already-blocked/booked slots**
    (`fetchDoctorBlockedSlots` / `fetchCenterDoctorBlockedSlots`), then **hides
    taken slots** ("تم حجز N وقتًا لهذا اليوم، ولن تظهر مجددًا").
  - On confirm, dispatches to the correct endpoint:
    - center doctor → `bookCenterAppointment(centerId, …)`
    - doctor booking for self/patient (manual) → `createDoctorAppointment(...)`
    - normal patient booking → `bookAppointment(...)`
  - On success → `navigation.replace("AppointmentDetails", …)`; on `401` it
    prompts to log in.
- **APIs:** `fetchDoctorServices`, `fetchCenterDoctorServices`,
  `fetchDoctorBlockedSlots`, `fetchCenterDoctorBlockedSlots`, `bookAppointment`,
  `bookCenterAppointment`, `createDoctorAppointment`.
- **Navigates to:** `AppointmentDetails`, `Login` (on auth error).

## C4. Booking summary (FAB wrapper) — `BookingSummary`
- **File:** `screens/booking-summary.js` · **Role:** patient · **~99 lines**
- **What it is:** A thin wrapper that renders the appointments list
  (`my-appointments`) with a floating **"إضافة موعد"** button. The button fetches
  the doctor dashboard and jumps into `BookAppointment` prefilled. *(Mostly used
  in the doctor's "add appointment" path.)*
- **APIs:** `fetchDoctorDashboard`.
- **Navigates to:** `BookAppointment`.

## C5. Centers list (mini) — `CentersMini`
- **File:** `screens/centers-mini.js` · **Role:** patient · **~309 lines**
- **What it is:** A searchable list of **medical centers** (multi-doctor clinics).
- **Key logic:** loads `fetchCenters`; selecting a center stores it in
  `CenterContext` (`setCenter`) and opens `CenterDoctors`. Resolves logo/media
  URLs against `API_BASE_URL`.
- **APIs:** `fetchCenters`.
- **Navigates to:** `CenterDoctors`.

## C6. Center doctors — `CenterDoctors`
- **File:** `screens/center-doctors.js` · **Role:** patient · **~744 lines**
- **What it is:** Shows one center's details and its doctors (the center
  equivalent of the Specialty screen).
- **Key logic:** resolves `centerId` from route params or `CenterContext`; loads
  `fetchCenterById` + `fetchCenterDoctors`; searchable; **rating-sorted** (same
  `compareDoctorsByRating`); cleans Arabic text (`cleanArabicText`). Booking a
  center doctor carries `medicalCenterId` + `doctorCenterId` into
  `BookAppointment`.
- **APIs:** `fetchCenterById`, `fetchCenterDoctors`.
- **Navigates to:** `BookAppointment` / `DoctorDetails`.

## C7. Center selector — `center-selector.js` (not registered as a route)
- **File:** `screens/center-selector.js` · **Role:** patient · **~350 lines**
- **What it is:** A near-duplicate of `CentersMini` (select a center → store in
  context → `CenterDoctors`). **Not currently registered** in `App.js`'s
  navigator — appears to be an alternate/legacy entry kept in the codebase.
- **APIs:** `fetchCenters`.

---

# D. Patient — Appointments & Chat

## D1. My appointments — `MyAppointments` (also `AppointmentsTab`)
- **File:** `screens/my-appointments.js` · **Role:** patient · **~379 lines**
- **What it is:** The patient's list of their own appointments ("مواعيدي").
- **UI:** A `FlatList` of appointment cards with **status labels**
  (`STATUS_LABELS`: مؤكد / قيد الانتظار / مكتمل / ملغى), doctor info, date and
  **12-hour time** (`to12h`), and **pull-to-refresh**.
- **Key logic:** loads from `fetchAppointments`, **caches** to AsyncStorage
  (`cache_my_appointments_v1`) for instant display, reloads on focus, and
  redirects to `Login` on auth failure. Tapping a card opens
  `AppointmentDetails`.
- **APIs:** `fetchAppointments`.
- **Navigates to:** `AppointmentDetails`.

## D2. Appointment details — `AppointmentDetails`
- **File:** `screens/appointment-details.js` · **Role:** patient · **~1,013 lines**
- **What it is:** Full detail view of one appointment with the available actions.
- **UI / actions:**
  - Shows doctor, service, date/time, status, location, fee.
  - **Cancel** the appointment (`cancelAppointment` → back to `MyAppointments`).
  - **Rate** a completed appointment (star rating + comment → `rateAppointment`).
  - **Re-book** with the same doctor (→ `BookAppointment`).
  - **Open chat** with the doctor (→ `AppointmentChat`).
- **Key logic:** loads via `fetchAppointment(id)`; auth failures route to `Login`.
- **APIs:** `fetchAppointment`, `cancelAppointment`, `rateAppointment`.
- **Navigates to:** `BookAppointment`, `AppointmentChat`, `MyAppointments`, `Login`.

## D3. Appointment chat — `AppointmentChat`
- **File:** `screens/appointment-chat.js` · **Role:** patient + doctor · **~1,745 lines** (most complex screen)
- **What it is:** The **real-time, end-to-end-encrypted** 1:1 chat between a
  patient and a doctor for a given appointment/conversation.
- **Encryption (E2EE):** on open it ensures the user's NaCl keypair
  (`ensureE2EEKeypair`) and **publishes the public key** (`setChatPublicKey`);
  it fetches the **peer's public key** via chat context. Outgoing text/images are
  **encrypted** (`encryptE2EE`) before `sendChatMessage`; incoming messages are
  **decrypted** (`decryptE2EE`). The server only ever stores ciphertext.
- **Real-time (Socket.IO via `getSocket`):** joins a room with `chat:join`
  (conversation key), and listens for `chat:newMessage`, `chat:typing`,
  `chat:messagesRead`, `chat:delivered`, `chat:userOnline`; emits `chat:typing`
  and `chat:leave`. Also has REST fallbacks.
- **Features:** message history with pagination (`fetchChatMessages` limit 80),
  **typing indicators** (`sendTypingIndicator` + socket), **delivery & read
  receipts** (`markMessagesDelivered`, `markMessagesRead`), **image messages**
  (`uploadChatImage` then send an encrypted reference), and online/last-seen
  status.
- **APIs:** `fetchChatContext`, `fetchChatMessages`, `sendChatMessage`,
  `markMessagesDelivered`, `markMessagesRead`, `sendTypingIndicator`,
  `setChatPublicKey`, `uploadChatImage`; `lib/e2ee` + `lib/socket`.

---

# E. Patient — Account & Settings

## E1. Personal info — `PersonalInfo`
- **File:** `screens/personal-info.js` · **Role:** patient · **~234 lines**
- **What it is:** View/edit the patient's basic profile: name, phone (Iraq
  10-digit normalized), email, age.
- **Key logic:** loads via `request("/api/auth/me")`; saves with `updateProfile`.
- **APIs:** `request("/api/auth/me")`, `updateProfile`.

## E2. Profile settings — `ProfileSettings`
- **File:** `screens/profile-settings.js` · **Role:** patient · **~244 lines**
- **What it is:** App/account settings hub.
- **UI / actions:** **theme toggle** (light/dark via `useThemePreference`),
  **manual OTA update check** (`useOTAUpdates.checkManually`, shows
  checking/downloading state), open **privacy policy**, navigate to
  `ChangePassword`, `DeleteAccount`, `ActivityLog`, and **"تسجيل الخروج من كل
  الأجهزة"** (`logoutAllDevices` + `logout` → `RoleSelection`).
- **APIs:** `logoutAllDevices`, `logout`; `lib/ThemeProvider`, `lib/useOTAUpdates`.

## E3. Change password — `ChangePassword`
- **File:** `screens/change-password.js` · **Role:** patient + doctor + secretary · **~171 lines**
- **What it is:** Change the account password.
- **Key logic:** requires current + new + confirm; enforces a **strong password**
  (≥8 chars, upper, lower, digit); on success may rotate tokens
  (`saveToken`/`saveRefreshToken`).
- **APIs:** `changeMyPassword`.

## E4. Delete account — `DeleteAccount`
- **File:** `screens/delete-account.js` · **Role:** patient + doctor + secretary · **~167 lines**
- **What it is:** Permanent account deletion (password-confirmed). Also surfaces
  the web **account-deletion URL** (store-compliance requirement).
- **Key logic:** confirm dialog → `deleteMyAccount(password)` → `logout`.
- **APIs:** `deleteMyAccount`, `logout`.

## E5. Activity log — `ActivityLog`
- **File:** `screens/activity-log.js` · **Role:** patient + doctor + secretary · **~133 lines**
- **What it is:** A security/audit log of recent account activity (logins, etc.),
  with pull-to-refresh.
- **APIs:** `fetchMyActivity(50)`.

## E6. Support — `Support`
- **File:** `screens/support.js` · **Role:** patient + doctor + secretary · **~206 lines**
- **What it is:** Help & contact screen. Lists support channels — **WhatsApp,
  Telegram (@medicareiq), Instagram (@medicare.iq), Facebook, email** — each
  opening via `Linking`. Channels come from `lib/supportConfig`.
- **APIs:** none (deep links only).

## E7. Notifications (static) — `notifications.js` (not registered as a route)
- **File:** `screens/notifications.js` · **Role:** — · **~187 lines**
- **What it is:** A **static, hard-coded** notifications mock-up (English sample
  items). **Not registered** in `App.js` — placeholder UI; real push handling
  lives in `App.js` + `lib/pushNotifications`.

## E8. Medical records — `MedicalRecords` (also `MedicalRecordsTab`)
- **File:** `screens/medical-records.js` · **Role:** patient · **~280 lines**
- **What it is:** The patient's medical records/archive entries created by their
  doctors (notes, lab files, images), with an **image preview modal**.
- **Key logic:** loads via `fetchPatientMedicalRecords`; resolves file URLs
  against `API_BASE_URL`; auth failure → `Login`.
- **APIs:** `fetchPatientMedicalRecords`.

---

# F. Doctor / Secretary (Provider)

The provider root is `ProviderTabs` — a **right-side drawer** whose initial item
is **الحجوزات** (`ProviderAppointments`). Secretaries share most screens but with
fewer permissions (enforced both by `withRoleGuard` allowed-roles and the
backend). Provider/lab accent for labs is teal; doctor primary is `#1e4980`.

## F1. Provider appointments — `ProviderAppointmentsTab` (`provider-appointments.js`)
- **File:** `screens/provider-appointments.js` · **Role:** doctor + secretary · **~3,184 lines** (the single largest screen in the app)
- **What it is:** The doctor's main operations console — manage **both** solo
  appointments and **center bookings** in one list.
- **Features:**
  - Loads solo appointments (`fetchDoctorAppointments`) **and** the doctor's
    bookings across all assigned centers (`fetchMyDoctorCenters` →
    `fetchDoctorCenterBookings` per center), merged together.
  - Per-appointment actions: **accept / cancel / complete / reschedule**
    (separate solo vs. center variants), **assign to an employee/secretary**
    (`assignEmployeeToAppointment`), and **bulk** accept-all / complete-all.
  - **Reschedule modal** computes available date/time slots while respecting the
    doctor's schedule and **already-blocked slots** (`fetchDoctorBlockedSlots`).
  - **Manual booking** for walk-ins (`createDoctorAppointment`).
  - **Block a patient** from booking/chat inline (`getBlock` / `setBlock`).
  - **QR scanner** (`expo-camera` `CameraView`) — e.g. to check in a patient.
  - Status labels via `STATUS_LABELS`.
- **APIs:** `fetchDoctorAppointments`, `fetchDoctorCenterBookings`,
  `fetchMyDoctorCenters`, `fetchDoctorDashboard`, `fetchDoctorBlockedSlots`,
  `acceptDoctorAppointment`, `cancelDoctorAppointment`,
  `completeDoctorAppointment`, `rescheduleDoctorAppointment`,
  `acceptDoctorCenterBooking`, `cancelDoctorCenterBooking`,
  `createDoctorAppointment`, `assignEmployeeToAppointment`, `fetchSecretaries`,
  `getBlock`, `setBlock`.

## F2. Provider profile (drawer "الملف") — `ProviderProfileTab` (`provider-profile.js`)
- **File:** `screens/provider-profile.js` · **Role:** doctor + secretary · **~463 lines**
- **What it is:** The doctor's profile + quick-stats home inside the drawer.
- **UI:** doctor card (avatar, specialty, rating), **stats** (pending /
  confirmed / total), shortcuts to edit profile, services and settings, plus a
  **logout**.
- **Key logic:** loads `fetchDoctorDashboard` on focus; auth/permission errors
  route to `Login`.
- **APIs:** `fetchDoctorDashboard`, `logout`.
- **Navigates to:** `ProviderProfileEdit`, `ProviderServicesTab`,
  `ProviderSettingsTab`, `ProviderAppointmentsTab`.

## F3. Provider dashboard — `ProviderDashboard` (`provider-dashboard.js`)
- **File:** `screens/provider-dashboard.js` · **Role:** doctor + secretary · **~319 lines**
- **What it is:** An alternate dashboard view (stats + entry points). **Notably**
  it generates the **patient waiting-room display screen**:
  `generatePatientDisplay()` returns a public URL that it opens via `Linking`
  (the TV/lobby "names" board — see [PROJECT_OVERVIEW](PROJECT_OVERVIEW.md)).
- **APIs:** `fetchDoctorDashboard`, `generatePatientDisplay`, `logout`.
- **Navigates to:** `DoctorAppointments`.

## F4. Provider profile edit — `ProviderProfileEdit`
- **File:** `screens/provider-profile-edit.js` · **Role:** doctor only · **~553 lines**
- **What it is:** Edit the doctor's professional profile — name, specialty, bio,
  consultation fee, certification, CV, **avatar** (image picker with preview),
  and clinic **location** (map picker).
- **APIs:** `fetchDoctorDashboard`, `updateDoctorProfile`.
- **Navigates to:** `LocationPicker` (and back).

## F5. Provider services — `ProviderServicesTab` (`provider-services.js`)
- **File:** `screens/provider-services.js` · **Role:** doctor only · **~975 lines**
- **What it is:** Manage the **services/offerings** the doctor provides (name,
  price, optional **discount**, duration) — both for the **solo** practice and
  **per medical center** the doctor belongs to.
- **Key logic:** picks the target via a center selector (`fetchMyDoctorCenters`),
  lists solo or center services, and creates/updates them with the right
  endpoint. Slot duration is aligned to the schedule.
- **APIs:** `fetchMyDoctorServices`, `fetchMyCenterDoctorServices`,
  `createMyDoctorService`, `createMyCenterDoctorService`, `updateMyDoctorService`,
  `updateMyCenterDoctorService`, `fetchMyDoctorCenters`, `fetchDoctorDashboard`.

## F6. Schedule management — `ProviderScheduleTab` (`schedule-management.js`)
- **File:** `screens/schedule-management.js` · **Role:** doctor only · **~1,479 lines**
- **What it is:** Configure the working **schedule**: active weekdays, start/end
  times, **slot duration** (preset or custom), **break** window, **max patients
  per slot**, **online-booking toggle**, **emergency** flag, and **disabled
  dates** (days off). Configurable per center too.
- **APIs:** `fetchDoctorDashboard`, `fetchMyDoctorCenters`, `saveDoctorSchedule`.

## F7. Patients (archive) — `ProviderPatientsTab` (`patients.js`)
- **File:** `screens/patients.js` · **Role:** doctor + secretary · **~2,006 lines** (2nd largest)
- **What it is:** The doctor's **patient archive / EMR**: per-patient history with
  notes, condition, prescriptions, reports/files, custom fields, totals spent,
  and upcoming-visit counts. Includes a **customizable archive template** the
  doctor defines once and reuses.
- **Key logic:** lists/searches archived patients
  (`fetchDoctorArchivePatients`), loads one patient's entries
  (`fetchDoctorArchiveByPatient`), and **creates/updates/deletes** entries; the
  template is loaded/saved separately (`fetchArchiveTemplate` /
  `saveArchiveTemplate`); file/image uploads go through
  `uploadDoctorArchiveFile`. The archive feature can be toggled on/off.
- **APIs:** `fetchDoctorArchivePatients`, `fetchDoctorArchiveByPatient`,
  `createDoctorArchiveEntry`, `deleteDoctorArchiveEntry`, `fetchArchiveTemplate`,
  `saveArchiveTemplate`, `fetchDoctorDashboard` (+ `uploadDoctorArchiveFile`).

## F8. Provider conversations — `ProviderConversationsTab` (`provider-conversations.js`)
- **File:** `screens/provider-conversations.js` · **Role:** doctor only · **~402 lines**
- **What it is:** The doctor's **inbox** — list of chat conversations with
  patients (last message, unread counts), auto-refreshing on an interval.
- **Key logic:** `fetchDoctorChatConversations`; tapping a row opens
  `AppointmentChat` (E2EE) with that patient.
- **APIs:** `fetchDoctorChatConversations`.
- **Navigates to:** `AppointmentChat`.

## F9. Provider reports — `ProviderReportsTab` (`provider-reports.js`)
- **File:** `screens/provider-reports.js` · **Role:** doctor + secretary · **~1,026 lines**
- **What it is:** Reporting & analytics — daily/monthly stats, revenue
  (consultation fee × counts), employee breakdown, and **exportable report
  links** (Excel/PDF) for a chosen day or month.
- **Key logic:** picks a date/month, computes totals from
  `fetchDoctorAppointments` + `fetchDoctorDashboard` + `fetchSecretaries`, and
  generates download links via `generateDailyReportExcelLink` /
  `generateMonthlyReportExcelLink`.
- **APIs:** `fetchDoctorAppointments`, `fetchDoctorDashboard`, `fetchSecretaries`,
  `generateDailyReportExcelLink`, `generateMonthlyReportExcelLink`.

## F10. Secretary management — `SecretaryManagementTab` (`secretary-management.js`)
- **File:** `screens/secretary-management.js` · **Role:** doctor + secretary · **~964 lines**
- **What it is:** Manage the doctor's **employees (secretaries)** — create, edit,
  delete; set name, phone, password, job title, location, salary, **active**
  flag, and a **permissions** set. Also view each employee's **activity log**
  (paginated modal).
- **APIs:** `fetchSecretaries`, `createSecretary`, `deleteSecretary`,
  `fetchSecretaryActivity` (+ update).

## F11. Provider inventory (مخزن) — `ProviderInventoryTab` (`provider-inventory.js`)
- **File:** `screens/provider-inventory.js` · **Role:** doctor + secretary · **~856 lines**
- **What it is:** The clinic **inventory/stock** manager — items with name, type,
  price, **purchase & expiry dates**, and an **image**. Searchable, with a
  date-picker and add/edit modal.
- **APIs:** `fetchInventory`, `createInventoryItem`, `updateInventoryItem`,
  `deleteInventoryItem` (multipart image upload supported).

## F12. Provider settings — `ProviderSettingsTab` (`provider-settings.js`)
- **File:** `screens/provider-settings.js` · **Role:** doctor + secretary · **~300 lines**
- **What it is:** Settings hub for providers (theme, change password, blocked
  patients, logout-all, support, activity log) — the provider counterpart of the
  patient `ProfileSettings`. Reads the current role to show role-appropriate
  options.
- **Navigates to:** `ChangePassword`, `BlockedPatients`, `ActivityLog`,
  `Support`, `RoleSelection`.

## F13. Blocked patients — `BlockedPatients`
- **File:** `screens/blocked-patients.js` · **Role:** doctor only · **~265 lines**
- **What it is:** List of patients the doctor has blocked from **booking** and/or
  **chat**, with the ability to toggle/unblock each.
- **APIs:** `fetchBlockedPatients`, `setBlock`.

## F14. Doctor appointments (simple list) — `DoctorAppointments`
- **File:** `screens/doctor-appointments.js` · **Role:** doctor + secretary · **~321 lines**
- **What it is:** A lighter standalone appointments list (separate from the big
  `ProviderAppointments` console) with **accept** action and periodic refresh —
  reached from `ProviderDashboard`.
- **APIs:** `fetchDoctorAppointments`, `acceptDoctorAppointment`.

---

# G. Lab

The lab root is `LabTabs` (bottom tabs, teal accent `#0D9488`): **الرئيسية**,
**الطلبات**, **الفحوصات**, **المرضى**, **الإعدادات**.

## G1. Lab dashboard — `LabDashTab` (`lab-dashboard.js`)
- **File:** `screens/lab-dashboard.js` · **Role:** lab · **~205 lines**
- **What it is:** The lab home — KPI cards (orders by status, pending results,
  etc.) and the lab profile header, with pull-to-refresh and logout.
- **Key logic:** loads `fetchLabProfile` + `fetchLabDashboard` in parallel on
  focus.
- **APIs:** `fetchLabProfile`, `fetchLabDashboard`, `logout`.

## G2. Lab orders — `LabOrdersTab` (`lab-orders.js`)
- **File:** `screens/lab-orders.js` · **Role:** lab · **~317 lines**
- **What it is:** List & create lab **orders** (filterable by status / priority /
  date / search). Creating an order picks tests from the catalog.
- **Key logic:** `fetchLabOrders` (with filters), `fetchLabTests` for the
  picker, `createLabOrder`. Tapping an order opens `LabResultEntry`.
- **APIs:** `fetchLabOrders`, `fetchLabTests`, `createLabOrder`.
- **Navigates to:** `LabResultEntry`.

## G3. Lab result entry — `LabResultEntry`
- **File:** `screens/lab-result-entry.js` · **Role:** lab · **~389 lines**
- **What it is:** The clinical workflow for one order — **enter** each test's
  result, then **verify**, then **approve** (the 3-stage result lifecycle).
- **APIs:** `fetchLabOrder`, `updateLabOrder`, `enterLabResult`,
  `verifyLabResult`, `approveLabResult`.

## G4. Lab tests (catalog) — `LabTestsTab` (`lab-tests.js`)
- **File:** `screens/lab-tests.js` · **Role:** lab · **~244 lines**
- **What it is:** Manage the lab's **test catalog** — create/edit/delete tests
  (name, category, price, reference ranges, active flag), searchable/filterable.
- **APIs:** `fetchLabTests`, `createLabTest`, `updateLabTest`, `deleteLabTest`.

## G5. Lab patients — `LabPatientsTab` (`lab-patients.js`)
- **File:** `screens/lab-patients.js` · **Role:** lab · **~119 lines**
- **What it is:** Searchable list of the lab's patients; selecting one shows
  their orders.
- **APIs:** `fetchLabPatients`, `fetchLabPatientOrders`.
- **Navigates to:** `LabOrders`.

## G6. Lab reports — `LabReports`
- **File:** `screens/lab-reports.js` · **Role:** lab · **~159 lines**
- **What it is:** Lab reporting/analytics summary (derived from the dashboard
  data) with shortcuts into orders/patients.
- **APIs:** `fetchLabDashboard`.
- **Navigates to:** `LabOrders`, `LabPatients`.

## G7. Lab profile / settings — `LabProfileTab` (`lab-profile.js`)
- **File:** `screens/lab-profile.js` · **Role:** lab · **~221 lines**
- **What it is:** View/edit the lab's profile (name, type, license, city,
  address, contact) and account settings; logout.
- **APIs:** `fetchLabProfile`, `updateLabProfile`, `logout`.
- **Navigates to:** `RoleSelection` (on logout).

---

# H. Shared

## H1. Location picker — `LocationPicker`
- **Files:** `screens/location-picker.js` (~397 lines, native) and
  `screens/location-picker.web.js` (~249 lines, web variant) · **Role:** any
  (used by doctor signup & profile edit)
- **What it is:** A full-screen **map** to pick the clinic/practice location.
- **Key logic:** uses `react-native-maps` + `expo-location` (current location,
  draggable marker / tap to set). On confirm it returns the chosen
  `{ latitude, longitude, address }` back to the caller (e.g. `Signup` /
  `ProviderProfileEdit`) via navigation params. The `.web.js` variant provides a
  browser-compatible implementation (native maps don't run on web).

---

## Appendix — Screen → Route → Role quick index

| Route name | File | Role(s) |
|---|---|---|
| RoleSelection | role-selection.js | — |
| Login | login.js | — |
| Signup | signup.js | — |
| VerifyEmail | verify-email.js | — |
| LabSignup | lab-signup.js | — |
| MainTabs › HomeTab | tabs/home-v2.js | patient |
| MainTabs › AppointmentsTab | my-appointments.js | patient |
| MainTabs › MedicalRecordsTab | medical-records.js | patient |
| MainTabs › ProfileTab | profile.js | patient |
| Specialty | specialty/[slug].js | patient |
| DoctorDetails | doctor-detalis.js | patient |
| BookAppointment | book-appointment.js | patient |
| BookingSummary | booking-summary.js | patient |
| CentersMini | centers-mini.js | patient |
| CenterDoctors | center-doctors.js | patient |
| MyAppointments | my-appointments.js | patient |
| AppointmentDetails | appointment-details.js | patient |
| AppointmentChat | appointment-chat.js | patient + doctor |
| PersonalInfo | personal-info.js | patient |
| MedicalRecords | medical-records.js | patient |
| ProfileSettings | profile-settings.js | patient |
| ChangePassword | change-password.js | patient + doctor + secretary |
| DeleteAccount | delete-account.js | patient + doctor + secretary |
| ActivityLog | activity-log.js | patient + doctor + secretary |
| Support | support.js | patient + doctor + secretary |
| ProviderTabs › ProviderAppointmentsTab | provider-appointments.js | doctor + secretary |
| ProviderTabs › ProviderPatientsTab | patients.js | doctor + secretary |
| ProviderTabs › ProviderConversationsTab | provider-conversations.js | doctor |
| ProviderTabs › ProviderReportsTab | provider-reports.js | doctor + secretary |
| ProviderTabs › ProviderScheduleTab | schedule-management.js | doctor |
| ProviderTabs › ProviderServicesTab | provider-services.js | doctor |
| ProviderTabs › SecretaryManagementTab | secretary-management.js | doctor + secretary |
| ProviderTabs › ProviderSettingsTab | provider-settings.js | doctor + secretary |
| ProviderTabs › ProviderInventoryTab | provider-inventory.js | doctor + secretary |
| ProviderTabs › ProviderProfileTab | provider-profile.js | doctor + secretary |
| ProviderDashboard | provider-dashboard.js | doctor + secretary |
| ProviderProfileEdit | provider-profile-edit.js | doctor |
| DoctorAppointments | doctor-appointments.js | doctor + secretary |
| BlockedPatients | blocked-patients.js | doctor |
| LabTabs › LabDashTab | lab-dashboard.js | lab |
| LabTabs › LabOrdersTab | lab-orders.js | lab |
| LabTabs › LabTestsTab | lab-tests.js | lab |
| LabTabs › LabPatientsTab | lab-patients.js | lab |
| LabTabs › LabProfileTab | lab-profile.js | lab |
| LabOrders / LabResultEntry / LabTests / LabPatients / LabReports / LabProfile | lab-*.js | lab |
| LocationPicker | location-picker.js (+ .web.js) | any |

**Not registered in the navigator (present but unused/legacy):**
`screens/tabs/home.js` (old home v1), `screens/center-selector.js`,
`screens/notifications.js` (static mock), `screens/schedule-management.js.bak`.
