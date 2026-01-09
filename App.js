import React, { useEffect, useState } from "react";
import {
  StatusBar,
  I18nManager,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from "@react-navigation/drawer";
import BookingSummaryScreen from "./screens/booking-summary";
import ChatScreen from "./screens/chat";
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
import LocationPickerScreen from "./screens/location-picker";
// ...existing code...
import {
  getUserRole,
  getToken,
  registerForPushNotificationsAsync,
  getExpoPushToken,
  registerPushTokens
} from "./lib/api";
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
import { ThemeProvider } from "./lib/ThemeProvider";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
// (تم الاستيراد في الأعلى)

import { useAppTheme } from "./lib/useTheme";
import { Feather } from "@expo/vector-icons";
import { saveExpoPushTokenToFirebase } from './lib/firebase';

// ...existing code (تابع باقي الكود كما هو)...

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const ProviderDrawer = createDrawerNavigator();

const withRoleGuard = (Component, allowedRoles = []) => {
  return function RoleGuardedScreen(props) {
    const [role, setRole] = useState(null);
    const { colors } = useAppTheme();

    useEffect(() => {
      let active = true;
      getUserRole()
        .then((r) => {
          if (active) setRole(r);
        })
        .catch(() => {
          if (active) setRole(null);
        });
      return () => {
        active = false;
      };
    }, []);

    useEffect(() => {
      if (!role) return;
      if (!allowedRoles.length) return;
      if (allowedRoles.includes(role)) return;

      // Redirect to the correct root based on role.
      const destination = role === "doctor" ? "ProviderTabs" : "MainTabs";
      props.navigation.reset({
        index: 0,
        routes: [{ name: destination }],
      });
    }, [role, props.navigation]);

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

const PatientOnlyMainTabs = withRoleGuard(MainTabsNavigator, ["patient"]);
const DoctorOnlyProviderTabs = withRoleGuard(ProviderTabsNavigator, ["doctor"]);

// 🔀 ref عشان نقدر نعمل navigate من برا الكومبوننت (من لسنر الإشعار)
export const navigationRef = createNavigationContainerRef();

// استقبال الإشعارات في المقدمة والخلفية
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

Notifications.addNotificationReceivedListener((notification) => {
  // استقبال الإشعار في المقدمة
  console.log('[Expo] Foreground notification:', notification);
  // يمكنك هنا عرض Toast أو إشعار مخصص
});

function MainTabsNavigator() {
  const { colors } = useAppTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneContainerStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
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
  return (
    <ProviderDrawer.Navigator
      initialRouteName="ProviderAppointmentsTab"
      drawerContent={(props) => <ProviderDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        sceneContainerStyle: { backgroundColor: colors.background },
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
        name="ProviderSettingsTab"
        component={ProviderSettingsScreen}
        options={{ title: "الإعدادات" }}
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

// NOTE: push token registration helper lives in ./lib/pushNotifications

function AppInner() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [booting, setBooting] = useState(true);
  const { colors, isDark, navigationTheme } = useAppTheme();

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

        // Expo Push Token
        let expoPushToken;
        try {
          expoPushToken = await registerForPushNotificationsAsync();
        } catch (err) {
          console.log('[Expo] Error getting Expo token:', err);
        }

        if (token) {
          const destination = role === "doctor" ? "ProviderTabs" : "MainTabs";
          setInitialRoute(destination);

          // سجل التوكن وارسله للسيرفر و Firebase
          if (expoPushToken) {
            const storedExpo = await getExpoPushToken();
            if (String(storedExpo || "") !== String(expoPushToken || "")) {
              try {
                // حفظ التوكن في السيرفر
                await registerPushTokens({ expoPushToken });
                // حفظ التوكن في فايربيس مع الدور
                await saveExpoPushTokenToFirebase(token, expoPushToken, role);
                console.log("[Expo] Expo token saved to server & Firebase.");
              } catch (err) {
                console.log("[Expo] Error saving Expo token:", err);
              }
            } else {
              console.log("[Expo] Expo token is same as stored, not sending to server.");
            }
          } else {
            console.log("[Expo] No Expo push token generated, nothing to send.");
          }
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
    })();

    // Expo: handle notification response (app opened from notification)
    const notificationResponseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response?.notification?.request?.content?.data || {};
      const { type, appointmentId, role } = data;
      console.log('[PushDebug][Expo] Notification opened:', data);
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
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
          <StatusBar
            barStyle={isDark ? "light-content" : "dark-content"}
            backgroundColor={colors.background}
            translucent={false}
          />
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { direction: "rtl", backgroundColor: colors.background },
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
              component={withRoleGuard(MyAppointmentsScreen, ["patient"])}
            />
            <Stack.Screen
              name="AppointmentDetails"
              component={withRoleGuard(AppointmentDetailsScreen, ["patient"])}
            />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen
              name="BookAppointment"
              component={withRoleGuard(BookAppointmentScreen, ["patient"])}
            />
            <Stack.Screen
              name="BookingSummary"
              component={withRoleGuard(BookingSummaryScreen, ["patient"])}
            />
            <Stack.Screen
              name="Specialty"
              component={withRoleGuard(SpecialtyScreen, ["patient"])}
            />
            <Stack.Screen
              name="DoctorDetails"
              component={withRoleGuard(DoctorDetailsScreen, ["patient"])}
            />
            <Stack.Screen
              name="DoctorAppointments"
              component={withRoleGuard(DoctorAppointmentsScreen, ["doctor"])}
            />
            <Stack.Screen
              name="ProviderDashboard"
              component={withRoleGuard(ProviderProfileScreen, ["doctor"])}
            />
            <Stack.Screen name="ProviderTabs" component={DoctorOnlyProviderTabs} />
            <Stack.Screen
              name="ProviderProfileEdit"
              component={withRoleGuard(ProviderProfileEditScreen, ["doctor"])}
            />
            <Stack.Screen
              name="ProviderServices"
              component={withRoleGuard(ProviderServicesScreen, ["doctor"])}
            />
            <Stack.Screen
              name="ProviderAppointments"
              component={withRoleGuard(ProviderAppointmentsScreen, ["doctor"])}
            />
            <Stack.Screen
              name="ScheduleManagement"
              component={withRoleGuard(ScheduleManagementScreen, ["doctor"])}
            />
            <Stack.Screen
              name="PersonalInfo"
              component={withRoleGuard(PersonalInfoScreen, ["patient"])}
            />
            <Stack.Screen
              name="MedicalRecords"
              component={withRoleGuard(MedicalRecordsScreen, ["patient"])}
            />
            <Stack.Screen
              name="ProfileSettings"
              component={withRoleGuard(ProfileSettingsScreen, ["patient"])}
            />
            <Stack.Screen
              name="ChangePassword"
              component={withRoleGuard(ChangePasswordScreen, ["patient", "doctor"])}
            />
            <Stack.Screen
              name="DeleteAccount"
              component={withRoleGuard(DeleteAccountScreen, ["patient", "doctor"])}
            />
            <Stack.Screen
              name="ActivityLog"
              component={withRoleGuard(ActivityLogScreen, ["patient", "doctor"])}
            />
            <Stack.Screen
              name="Support"
              component={withRoleGuard(SupportScreen, ["patient"])}
            />

            <Stack.Screen name="LocationPicker" component={LocationPickerScreen} />
           
          </Stack.Navigator>
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
