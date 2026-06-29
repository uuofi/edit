import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchMe } from "../lib/api";

// ارتفاع الشريط العائم + الهوامش — يُستخدم أيضاً لحساب مسافة المحتوى السفلية
export const TAB_PILL_HEIGHT = 64;
export const TAB_SIDE_MARGIN = 14;
export const TAB_BOTTOM_GAP = 10;

const USER_CACHE_KEY = "cache_current_user_v1";

// أيقونة لكل تبويب: نسخة معبّأة عند التفعيل ونسخة مفرّغة عند الخمول (مثل إنستغرام)
const ICONS = {
  HomeTab: { active: "home", inactive: "home-outline" },
  SearchTab: { active: "search", inactive: "search-outline" },
  AppointmentsTab: { active: "calendar", inactive: "calendar-outline" },
  MedicalRecordsTab: { active: "document-text", inactive: "document-text-outline" },
};

// عنصر البروفايل يُعرض كأفاتار دائري بدل الأيقونة
function AvatarItem({ user, focused }) {
  const name = String(user?.name || "").trim();
  const initial = name ? name.replace(/^د\.?\s*/, "").charAt(0) : "";
  const avatarUrl = user?.avatarUrl || user?.avatar;

  return (
    <View
      style={[
        styles.avatarRing,
        focused && styles.avatarRingActive,
      ]}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
      ) : initial ? (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      ) : (
        <View style={styles.avatarFallback}>
          <Ionicons name="person" size={18} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

export default function InstagramTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);

  // نجلب المستخدم الحالي مرة واحدة (كاش أولاً) لعرض الأفاتار/الحرف الأول
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(USER_CACHE_KEY);
        if (cached && mounted) setUser(JSON.parse(cached));
      } catch (_e) {}
      try {
        const data = await fetchMe();
        const fresh = data?.user || data;
        if (fresh && mounted) {
          setUser(fresh);
          AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(fresh)).catch(() => {});
        }
      } catch (_e) {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const bottomPad = Math.max(insets.bottom, TAB_BOTTOM_GAP);

  // ترتيب RTL: نعكس العناصر حتى تكون الرئيسية على اليمين
  const routes = [...state.routes].reverse();

  return (
    <View
      style={[styles.wrapper, { paddingBottom: bottomPad }]}
      pointerEvents="box-none"
    >
      <View style={styles.pillShadow}>
        <BlurView
          tint="dark"
          intensity={Platform.OS === "ios" ? 40 : 0}
          style={styles.pill}
        >
          <View style={styles.pillOverlay} />
          <View style={styles.row}>
            {routes.map((route) => {
              const realIndex = state.routes.findIndex((r) => r.key === route.key);
              const focused = state.index === realIndex;
              const { options } = descriptors[route.key];
              const label = options.title || route.name;

              const onPress = () => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              const onLongPress = () => {
                navigation.emit({ type: "tabLongPress", target: route.key });
              };

              const isProfile = route.name === "ProfileTab";
              const iconSet = ICONS[route.name];

              return (
                <Pressable
                  key={route.key}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  accessibilityRole="button"
                  accessibilityState={focused ? { selected: true } : {}}
                  accessibilityLabel={label}
                  style={styles.item}
                  hitSlop={6}
                >
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.itemInner,
                        focused && !isProfile && styles.itemInnerActive,
                        pressed && styles.itemPressed,
                      ]}
                    >
                      {isProfile ? (
                        <AvatarItem user={user} focused={focused} />
                      ) : (
                        <Ionicons
                          name={focused ? iconSet.active : iconSet.inactive}
                          size={26}
                          color={focused ? "#FFFFFF" : "rgba(255,255,255,0.62)"}
                        />
                      )}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: TAB_SIDE_MARGIN,
  },
  pillShadow: {
    borderRadius: 34,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 12,
  },
  pill: {
    height: TAB_PILL_HEIGHT,
    borderRadius: 34,
    overflow: "hidden",
    justifyContent: "center",
  },
  pillOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:
      Platform.OS === "ios" ? "rgba(18,18,20,0.62)" : "rgba(18,18,20,0.96)",
    borderRadius: 34,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInner: {
    minWidth: 48,
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInnerActive: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  itemPressed: {
    opacity: 0.6,
  },
  avatarRing: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  avatarRingActive: {
    borderColor: "#FFFFFF",
  },
  avatarImg: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  avatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#7BBFC1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
