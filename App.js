import React, { useEffect, useState } from "react";

import {
  StatusBar,
  I18nManager,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from "@react-navigation/drawer";
import BookingSummaryScreen from "./screens/booking-summary";
import DoctorDetailsScreen from "./screens/doctor-detalis";
import DoctorAppointmentsScreen from "./screens/doctor-appointments";
import ProviderProfileScreen from "./screens/provider-profile";
import ProviderProfileEditScreen from "./screens/provider-profile-edit";
import ProviderServicesScreen from "./screens/provider-services";
import ProviderAppointmentsScreen from "./screens/provider-appointments";
import ProviderReportsScreen from "./screens/provider-reports";
import PatientsScreen from "./screens/patients";
import ScheduleManagementScreen from "./screens/schedule-management";
import ProviderSettingsScreen from "./screens/provider-settings";
import SecretaryManagementScreen from "./screens/secretary-management";
import ProviderInventoryScreen from "./screens/provider-inventory";
import LocationPickerScreen from "./screens/location-picker";
// ...existing code...
import LabDashboardScreen   from "./screens/lab-dashboard";
import LabOrdersScreen      from "./screens/lab-orders";
import LabResultEntryScreen from "./screens/lab-result-entry";
import LabTestsScreen       from "./screens/lab-tests";
import LabPatientsScreen    from "./screens/lab-patients";
import LabReportsScreen     from "./screens/lab-reports";
import LabProfileScreen     from "./screens/lab-profile";
import LabSignupScreen      from "./screens/lab-signup";
import {
  normalizeUserRole,
  getUserRole,
  getToken,
  getExpoPushToken,
  registerExpoPushToken,
  acceptDoctorAppointment,
} from "./lib/api";
import { registerForPushNotificationsAsync } from "./lib/pushNotifications";
import RoleSelectionScreen from "./screens/role-selection";
import LoginScreen from "./screens/login";
import SignupScreen from "./screens/signup";
import VerifyEmailScreen from "./screens/verify-email";
import SpecialtyScreen from "./screens/specialty/[slug]";
import HomeTabScreen from "./screens/tabs/home";
import AppointmentsTabScreen from "./screens/tabs/appointments";
import ProfileTabScreen from "./screens/tabs/profile";
import PersonalInfoScreen from "./screens/personal-info";
import MedicalRecordsScreen from "./screens/medical-records";
import MedicalRecordsTabScreen from "./screens/tabs/medical-records";
import ProfileSettingsScreen from "./screens/profile-settings";
import SupportScreen from "./screens/support";
import ChangePasswordScreen from "./screens/change-password";
import DeleteAccountScreen from "./screens/delete-account";
import ActivityLogScreen from "./screens/activity-log";
import MyAppointmentsScreen from "./screens/my-appointments";
import AppointmentDetailsScreen from "./screens/appointment-details";
import BookAppointmentScreen from "./screens/book-appointment";
import CentersMiniScreen from "./screens/centers-mini";
import CenterDoctorsScreen from "./screens/center-doctors";
import { ThemeProvider } from "./lib/ThemeProvider";
import { CenterProvider } from "./lib/centerContext";
import useOTAUpdates from "./lib/useOTAUpdates";
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";



import { useAppTheme } from "./lib/useTheme";
import { Feather } from "@expo/vector-icons";


const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const ProviderDrawer = createDrawerNavigator();
const getAndroidBottomSpacing = (insetBottom = 0) =>
  Platform.OS === "android" ? Math.max(35, insetBottom) : 0;

const withRoleGuard = (Component, allowedRoles = []) => {
  return function RoleGuardedScreen(props) {
    const [role, setRole] = useState(null);
    const [timedOut, setTimedOut] = useState(false);
    const { colors } = useAppTheme();

    useEffect(() => {
      let active = true;
      getUserRole()
        .then((r) => {
          if (active) setRole(normalizeUserRole(r));
        })
        .catch(() => {
          if (active) setRole(null);
        });
      // Safety: if role never resolves, redirect to login after 5s.
      const timer = setTimeout(() => {
        if (active) setTimedOut(true);
      }, 5000);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, []);

    useEffect(() => {
      if (timedOut && !role) {
        console.warn("[RoleGuard] Timed out waiting for role, redirecting to login.");
        props.navigation.reset({ index: 0, routes: [{ name: "RoleSelection" }] });
      }
    }, [timedOut, role, props.navigation]);

    useEffect(() => {
      if (!role) return;

      const isKnownRole = role === "doctor" || role === "patient" || role === "secretary" || role === "lab";
      if (!isKnownRole) {
        props.navigation.reset({ index: 0, routes: [{ name: "RoleSelection" }] });
        return;
      }

      if (!allowedRoles.length) return;
      if (allowedRoles.includes(role)) return;

      // Redirect to the correct root based on role.
      const destination = (role === "doctor" || role === "secretary") ? "ProviderTabs" : role === "lab" ? "LabTabs" : "MainTabs";
      if (props.route?.name === destination) return;
      props.navigation.reset({
        index: 0,
        routes: [{ name: destination }],
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role]);

    if (!role) {
      return (
        <SafeAreaView
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </SafeAreaView>
      );
    }

    if (allowedRoles.length && !allowedRoles.includes(role)) {
      return null;
    }

    return <Component {...props} />;
  };
};

const PatientOnlyMainTabs    = withRoleGuard(MainTabsNavigator,    ["patient"]);
const DoctorOnlyProviderTabs = withRoleGuard(ProviderTabsNavigator, ["doctor", "secretary"]);
const LabOnlyTabs            = withRoleGuard(LabTabsNavigator,      ["lab"]);

// Pre-create guarded screens at module scope to keep stable component
// references (avoids unmount/remount on every parent re-render).
const GuardedMyAppointments = withRoleGuard(MyAppointmentsScreen, ["patient"]);
const GuardedAppointmentDetails = withRoleGuard(AppointmentDetailsScreen, ["patient"]);
const GuardedBookAppointment = withRoleGuard(BookAppointmentScreen, ["patient"]);
const GuardedBookingSummary = withRoleGuard(BookingSummaryScreen, ["patient"]);
const GuardedSpecialty = withRoleGuard(SpecialtyScreen, ["patient"]);
const GuardedDoctorDetails = withRoleGuard(DoctorDetailsScreen, ["patient"]);
const GuardedDoctorAppointments = withRoleGuard(DoctorAppointmentsScreen, ["doctor", "secretary"]);
const GuardedProviderDashboard = withRoleGuard(ProviderProfileScreen, ["doctor", "secretary"]);
const GuardedProviderProfileEdit = withRoleGuard(ProviderProfileEditScreen, ["doctor"]);
const GuardedProviderServices = withRoleGuard(ProviderServicesScreen, ["doctor"]);
const GuardedProviderAppointments = withRoleGuard(ProviderAppointmentsScreen, ["doctor", "secretary"]);
const GuardedScheduleManagement = withRoleGuard(ScheduleManagementScreen, ["doctor"]);
const GuardedPersonalInfo = withRoleGuard(PersonalInfoScreen, ["patient"]);
const GuardedMedicalRecords = withRoleGuard(MedicalRecordsScreen, ["patient"]);
const GuardedProfileSettings = withRoleGuard(ProfileSettingsScreen, ["patient"]);
const GuardedChangePassword = withRoleGuard(ChangePasswordScreen, ["patient", "doctor", "secretary"]);
const GuardedDeleteAccount = withRoleGuard(DeleteAccountScreen, ["patient", "doctor", "secretary"]);
const GuardedActivityLog = withRoleGuard(ActivityLogScreen, ["patient", "doctor", "secretary"]);
const GuardedSupport = withRoleGuard(SupportScreen, ["patient", "doctor", "secretary"]);
const GuardedProviderInventory = withRoleGuard(ProviderInventoryScreen, ["doctor", "secretary"]);
const GuardedCentersMini = withRoleGuard(CentersMiniScreen, ["patient"]);
const GuardedCenterDoctors = withRoleGuard(CenterDoctorsScreen, ["patient"]);

// Lab guarded screens
const GuardedLabOrders      = withRoleGuard(LabOrdersScreen,      ["lab"]);
const GuardedLabResultEntry = withRoleGuard(LabResultEntryScreen, ["lab"]);
const GuardedLabTests       = withRoleGuard(LabTestsScreen,       ["lab"]);
const GuardedLabPatients    = withRoleGuard(LabPatientsScreen,    ["lab"]);
const GuardedLabReports     = withRoleGuard(LabReportsScreen,     ["lab"]);
const GuardedLabProfile     = withRoleGuard(LabProfileScreen,     ["lab"]);

// 🔀 ref عشان نقدر نعمل navigate من برا الكومبوننت (من لسنر الإشعار)
export const navigationRef = createNavigationContainerRef();

// استقبال الإشعارات في المقدمة والخلفية
import * as Notifications from 'expo-notifications';

// إنشاء قناة الإشعارات للأندرويد 8+ (مطلوب وإلا الإشعارات ما توصل)
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "إشعارات Medicare",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#38BDF8",
    sound: "default",
  });
}

// تصنيف إشعار للحجوزات الجديدة للطبيب مع زر قبول مباشر من نفس الإشعار
Notifications.setNotificationCategoryAsync("DOCTOR_APPOINTMENT_ACTIONS", [
  {
    identifier: "ACCEPT_APPOINTMENT",
    buttonTitle: "قبول الحجز",
    options: {
      opensAppToForeground: true,
    },
  },
]);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

Notifications.addNotificationReceivedListener((notification) => {
  // استقبال الإشعار في المقدمة
  console.log('[Expo] Foreground notification:', notification);
  // يمكنك هنا عرض Toast أو إشعار مخصص
});

function MainTabsNavigator() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const androidBottomSpacing = getAndroidBottomSpacing(insets.bottom);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneContainerStyle: {
          backgroundColor: colors.background,
          paddingBottom: androidBottomSpacing,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60 + androidBottomSpacing,
          paddingBottom: androidBottomSpacing,
        },
        tabBarLabelStyle: {
          fontSize: 12,
        },
        tabBarIcon: ({ color, size }) => {
          const iconName =
            route.name === "HomeTab"
              ? "home"
              : route.name === "AppointmentsTab"
              ? "calendar"
              : route.name === "MedicalRecordsTab"
              ? "file-text"
              : "user";
          return <Feather name={iconName} color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeTabScreen}
        options={{ title: "الرئيسية" }}
      />
      <Tab.Screen
        name="AppointmentsTab"
        component={AppointmentsTabScreen}
        options={{ title: "المواعيد" }}
      />
      <Tab.Screen
        name="MedicalRecordsTab"
        component={MedicalRecordsTabScreen}
        options={{ title: "السجلات" }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileTabScreen}
        options={{ title: "الملف الشخصي" }}
      />
    </Tab.Navigator>
  );
}

function ProviderTabsNavigator() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const androidBottomSpacing = getAndroidBottomSpacing(insets.bottom);
  return (
    <ProviderDrawer.Navigator
      initialRouteName="ProviderAppointmentsTab"
      drawerContent={(props) => <ProviderDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        sceneContainerStyle: {
          backgroundColor: colors.background,
          paddingBottom: androidBottomSpacing,
        },
        drawerPosition: "right",
        overlayColor: colors.overlay,
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.text,
        drawerActiveBackgroundColor: colors.surfaceAlt,
        drawerStyle: {
          width: "75%",
          backgroundColor: colors.surface,
        },
        drawerContentContainerStyle: {
          paddingVertical: 14,
        },
        drawerItemStyle: {
          alignSelf: "stretch",
          borderRadius: 999,
          overflow: "hidden",
          marginHorizontal: 12,
          marginVertical: 6,
        },
        drawerLabelStyle: {
          textAlign: "right",
          marginHorizontal: 0,
        },
      }}
    >
      <ProviderDrawer.Screen
        name="ProviderAppointmentsTab"
        component={ProviderAppointmentsScreen}
        options={{ title: "الحجوزات" }}
      />
      <ProviderDrawer.Screen
        name="ProviderPatientsTab"
        component={PatientsScreen}
        options={{ title: "المرضى" }}
      />
      <ProviderDrawer.Screen
        name="ProviderReportsTab"
        component={ProviderReportsScreen}
        options={{ title: "التقارير" }}
      />
      <ProviderDrawer.Screen
        name="ProviderScheduleTab"
        component={ScheduleManagementScreen}
        options={{ title: "الجدول" }}
      />
      <ProviderDrawer.Screen
        name="ProviderServicesTab"
        component={ProviderServicesScreen}
        options={{ title: "إدارة الخدمات" }}
      />
      <ProviderDrawer.Screen
        name="SecretaryManagementTab"
        component={SecretaryManagementScreen}
        options={{ title: "الموظفين" }}
      />
      <ProviderDrawer.Screen
        name="ProviderSettingsTab"
        component={ProviderSettingsScreen}
        options={{ title: "الإعدادات" }}
      />
      <ProviderDrawer.Screen
        name="ProviderInventoryTab"
        component={GuardedProviderInventory}
        options={{ title: "المخزن" }}
      />
      <ProviderDrawer.Screen
        name="ProviderProfileTab"
        component={ProviderProfileScreen}
        options={{ title: "الملف" }}
      />
    </ProviderDrawer.Navigator>
  );
}

function ProviderDrawerContent(props) {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{ paddingTop: 0 }}
        style={{ backgroundColor: colors.surface }}
      >
        <DrawerItemList {...props} />
      </DrawerContentScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────  Lab Tab Navigator  ─────────────────────────────
function LabTabsNavigator() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const androidBottomSpacing = getAndroidBottomSpacing(insets.bottom);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneContainerStyle: { backgroundColor: colors.background, paddingBottom: androidBottomSpacing },
        tabBarActiveTintColor:   "#0D9488",
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60 + androidBottomSpacing,
          paddingBottom: androidBottomSpacing,
        },
        tabBarLabelStyle: { fontSize: 11 },
        tabBarIcon: ({ color, size }) => {
          const iconMap = {
            LabDashTab:     "grid",
            LabOrdersTab:   "clipboard",
            LabTestsTab:    "activity",
            LabPatientsTab: "users",
            LabProfileTab:  "settings",
          };
          return <Feather name={iconMap[route.name] || "circle"} color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="LabDashTab"     component={LabDashboardScreen} options={{ title: "الرئيسية" }} />
      <Tab.Screen name="LabOrdersTab"   component={LabOrdersScreen}    options={{ title: "الطلبات" }} />
      <Tab.Screen name="LabTestsTab"    component={LabTestsScreen}     options={{ title: "الفحوصات" }} />
      <Tab.Screen name="LabPatientsTab" component={LabPatientsScreen}  options={{ title: "المرضى" }} />
      <Tab.Screen name="LabProfileTab"  component={LabProfileScreen}   options={{ title: "الإعدادات" }} />
    </Tab.Navigator>
  );
}

// NOTE: push token registration helper lives in ./lib/pushNotifications

function AppInner() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [booting, setBooting] = useState(true);
  const { colors, isDark, navigationTheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const androidBottomSpacing = getAndroidBottomSpacing(insets.bottom);

  // OTA Updates — checks automatically on launch & foreground
  useOTAUpdates();

  // RTL
  useEffect(() => {
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }

    if (!Text.defaultProps) {
      Text.defaultProps = {};
    }
    Text.defaultProps.style = [
      Text.defaultProps.style,
      { textAlign: "right", writingDirection: "rtl" },
    ];

    if (!TextInput.defaultProps) {
      TextInput.defaultProps = {};
    }
    TextInput.defaultProps.style = [
      TextInput.defaultProps.style,
      { textAlign: "right", writingDirection: "rtl" },
    ];
  }, []);


  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [token, role] = await Promise.all([getToken(), getUserRole()]);
        if (!active) return;

        if (token) {
          const normalizedRole = normalizeUserRole(role);
          const destination =
            (normalizedRole === "doctor" || normalizedRole === "secretary")
              ? "ProviderTabs"
              : normalizedRole === "lab"
              ? "LabTabs"
              : normalizedRole === "patient"
              ? "MainTabs"
              : "RoleSelection";
          setInitialRoute(destination);
        } else {
          setInitialRoute("RoleSelection");
        }
      } catch (error) {
        console.warn("Boot routing error", error);
        if (active) {
          setInitialRoute("RoleSelection");
        }
      } finally {
        if (active) {
          setBooting(false);
        }
      }

      // Push token registration runs AFTER navigation is set (non-blocking).
      if (!active) return;
      try {
        const [token, role] = await Promise.all([getToken(), getUserRole()]);
        if (!token || !active) return;
        console.log("[App] User logged in, starting push registration...");

        let expoPushToken;
        try {
          const result = await registerForPushNotificationsAsync({ silent: true });
          expoPushToken = result?.expoPushToken;
          console.log("[App] Push token result:", expoPushToken ? "GOT TOKEN" : "NO TOKEN (permission denied or device issue)");
        } catch (err) {
          console.log('[App] Error getting Expo token:', err?.message || err);
        }

        if (expoPushToken && active) {
          try {
            await registerExpoPushToken(expoPushToken);
            console.log("[App] ✅ Push token registered with backend");
          } catch (err) {
            console.log("[App] ❌ Error registering push token with backend:", err?.message || err);
          }
        } else if (!expoPushToken) {
          console.log("[App] ⚠️ No push token obtained — notifications will NOT work for this user");
        }
      } catch (pushError) {
        console.log("[App] Background push registration failed:", pushError?.message || pushError);
      }
    })();

    // Expo: handle notification response (app opened from notification)
    const notificationResponseListener = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response?.notification?.request?.content?.data || {};
      const { type, appointmentId, role } = data;
      const actionId = response?.actionIdentifier;
      console.log('[PushDebug][Expo] Notification opened:', data);

      if (
        actionId === "ACCEPT_APPOINTMENT" &&
        role === "doctor" &&
        type === "appointment_created" &&
        appointmentId
      ) {
        try {
          await acceptDoctorAppointment(String(appointmentId));
          console.log("[PushAction] Appointment accepted from notification:", appointmentId);
        } catch (err) {
          console.log("[PushAction] Accept from notification failed:", err?.message || err);
        }
      }

      if (!navigationRef.isReady()) return;
      if (role === "patient" && type === "appointment_confirmed") {
        navigationRef.navigate("MyAppointments");
      }
      if (role === "doctor" && type === "appointment_created") {
        navigationRef.navigate("ProviderTabs", {
          screen: "ProviderAppointmentsTab",
        });
      }
    });

    return () => {
      active = false;
      if (notificationResponseListener) notificationResponseListener.remove();
    };
  }, []);

  if (booting || !initialRoute) {
    return (
      <SafeAreaProvider>
        <SafeAreaView
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
            paddingBottom: androidBottomSpacing,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 12, color: colors.textMuted, fontSize: 16 }}>
            جارٍ تحميل بياناتك...
          </Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingBottom: androidBottomSpacing,
        }}
      >
        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
          <StatusBar
            barStyle={isDark ? "light-content" : "dark-content"}
            backgroundColor={colors.background}
            translucent={false}
          />
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: {
                direction: "rtl",
                backgroundColor: colors.background,
                paddingBottom: androidBottomSpacing,
              },
            }}
            initialRouteName={initialRoute}
          >
            <Stack.Screen
              name="RoleSelection"
              component={RoleSelectionScreen}
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen
              name="Signup"
              component={SignupScreen}
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen
              name="VerifyEmail"
              component={VerifyEmailScreen}
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen name="MainTabs" component={PatientOnlyMainTabs} />
            <Stack.Screen
              name="MyAppointments"
              component={GuardedMyAppointments}
            />
            <Stack.Screen
              name="AppointmentDetails"
              component={GuardedAppointmentDetails}
            />
            <Stack.Screen
              name="BookAppointment"
              component={GuardedBookAppointment}
            />
            <Stack.Screen
              name="BookingSummary"
              component={GuardedBookingSummary}
            />
            <Stack.Screen
              name="Specialty"
              component={GuardedSpecialty}
            />
            <Stack.Screen
              name="DoctorDetails"
              component={GuardedDoctorDetails}
            />
            <Stack.Screen
              name="DoctorAppointments"
              component={GuardedDoctorAppointments}
            />
            <Stack.Screen
              name="ProviderDashboard"
              component={GuardedProviderDashboard}
            />
            <Stack.Screen name="ProviderTabs" component={DoctorOnlyProviderTabs} />
            <Stack.Screen
              name="ProviderProfileEdit"
              component={GuardedProviderProfileEdit}
            />
            <Stack.Screen
              name="ProviderServices"
              component={GuardedProviderServices}
            />
            <Stack.Screen
              name="ProviderAppointments"
              component={GuardedProviderAppointments}
            />
            <Stack.Screen
              name="ScheduleManagement"
              component={GuardedScheduleManagement}
            />
            <Stack.Screen
              name="PersonalInfo"
              component={GuardedPersonalInfo}
            />
            <Stack.Screen
              name="MedicalRecords"
              component={GuardedMedicalRecords}
            />
            <Stack.Screen
              name="ProfileSettings"
              component={GuardedProfileSettings}
            />
            <Stack.Screen
              name="ChangePassword"
              component={GuardedChangePassword}
            />
            <Stack.Screen
              name="DeleteAccount"
              component={GuardedDeleteAccount}
            />
            <Stack.Screen
              name="ActivityLog"
              component={GuardedActivityLog}
            />
            <Stack.Screen
              name="Support"
              component={GuardedSupport}
            />
            <Stack.Screen
              name="CentersMini"
              component={GuardedCentersMini}
            />
            <Stack.Screen
              name="CenterDoctors"
              component={GuardedCenterDoctors}
            />

            <Stack.Screen name="LocationPicker" component={LocationPickerScreen} />

            {/* ── Lab Screens ── */}
            <Stack.Screen name="LabTabs"        component={LabOnlyTabs}          options={{ gestureEnabled: false }} />
            <Stack.Screen name="LabOrders"      component={GuardedLabOrders} />
            <Stack.Screen name="LabResultEntry" component={GuardedLabResultEntry} />
            <Stack.Screen name="LabTests"       component={GuardedLabTests} />
            <Stack.Screen name="LabPatients"    component={GuardedLabPatients} />
            <Stack.Screen name="LabReports"     component={GuardedLabReports} />
            <Stack.Screen name="LabProfile"     component={GuardedLabProfile} />
            <Stack.Screen name="LabSignup"      component={LabSignupScreen}      options={{ gestureEnabled: false }} />
           
          </Stack.Navigator>
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <CenterProvider>
          <AppInner />
        </CenterProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
