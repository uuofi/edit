import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
  Platform,
  Animated,
  Easing,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../../lib/useTheme";
import { fetchPublicConfig } from "../../lib/publicConfig";
import {
  Heart,
  Brain,
  Sparkles,
  Baby,
  Bone,
  Ear,
  Activity,
  Scissors,
  Eye,
  Pill,
  FlaskConical,
} from "lucide-react-native";
import { FontAwesome5 } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ToothIcon = (props) => <FontAwesome5 name="tooth" {...props} />;
const BeautyIcon = (props) => <FontAwesome5 name="spa" {...props} />;
const NurseIcon = (props) => <FontAwesome5 name="user-nurse" {...props} />;

const ImageWithFallback = ({ src, alt, styles }) => {
  const [error, setError] = useState(false);
  const imageSource = typeof src === "number" ? src : { uri: src };

  if (error) {
    return (
      <View style={styles.fallbackImage}>
        <Text style={styles.fallbackText}>{alt || "Image"}</Text>
      </View>
    );
  }

  return (
    <Image
      source={imageSource}
      style={styles.carouselImage}
      onError={() => setError(true)}
    />
  );
};

import { fetchMe } from "../../lib/api";

function TypewriterWelcome({ colors }) {
  const fullText = "مرحباً بك بـMedicare";
  const [displayed, setDisplayed] = React.useState("");
  const [typing, setTyping] = React.useState(true);
  const i = React.useRef(0);

  React.useEffect(() => {
    setDisplayed("");
    setTyping(true);
    i.current = 0;
    const interval = setInterval(() => {
      setDisplayed((prev) => {
        if (i.current < fullText.length) {
          i.current++;
          if (i.current === fullText.length) setTyping(false);
          return fullText.slice(0, i.current);
        } else {
          clearInterval(interval);
          setTyping(false);
          return prev;
        }
      });
    }, 70);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={{
      alignItems: 'flex-start',
      marginHorizontal: 16,
      marginBottom: 8,
      marginTop: 18,
    }}>
      <View style={{
        borderWidth: 2,
        borderColor: colors.primary,
        borderRadius: 16,
        backgroundColor: '#fff',
        paddingHorizontal: 18,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOpacity: 0.07,
        shadowRadius: 4,
        elevation: 2,
        alignSelf: 'flex-start',
      }}>
        <Text style={{
          fontSize: 22,
          fontWeight: "700",
          color: colors.primary,
          textAlign: "right",
          writingDirection: "rtl",
          letterSpacing: 0.5,
        }}>
          {displayed}
          {typing ? <Text style={{color: colors.primary, opacity: 0.5}}>|</Text> : null}
        </Text>
      </View>
    </View>
  );
}

export default function App() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [userName, setUserName] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const me = await fetchMe();
        setUserName(me?.name || "");
      } catch {}
    })();
  }, []);
  const fallbackCarousel = useMemo(
    () => [
      require("../../assets/images/a.png"),
      require("../../assets/images/s.png"),
      require("../../assets/images/free.png"),
      "https://images.unsplash.com/photo-1758654860024-9e352f70d1f9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjbGluaWMlMjB3YWl0aW5nJTIwcm9vbXxlbnwxfHx8fDE3NjUxNDg1ODN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    []
  );

  const [carouselImages, setCarouselImages] = useState(fallbackCarousel);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchPublicConfig();
        const appImages = cfg?.images?.app || {};
        const r1 = typeof appImages.homeCarouselRemote1 === "string" ? appImages.homeCarouselRemote1.trim() : "";
        const r2 = typeof appImages.homeCarouselRemote2 === "string" ? appImages.homeCarouselRemote2.trim() : "";
        const r3 = typeof appImages.homeCarouselRemote3 === "string" ? appImages.homeCarouselRemote3.trim() : "";
        const r4 = typeof appImages.homeCarouselRemote4 === "string" ? appImages.homeCarouselRemote4.trim() : "";

        // Keep 4 slides; allow Admin to override the first two.
        const next = [
          r1 || fallbackCarousel[0],
          r2 || fallbackCarousel[1],
          r3 || fallbackCarousel[2],
          r4 || fallbackCarousel[3],
        ];

        if (!cancelled) setCarouselImages(next);
      } catch {
        // ignore; keep fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fallbackCarousel]);

  const specialties = [
    {
      name: "القلب",
      icon: Heart,
      color: "#DC2626",
      bgColor: "#FEF2F2",
      slug: "cardiology",
    },
    {
      name: "الأعصاب",
      icon: Brain,
      color: "#7C3AED",
      bgColor: "#F5F3FF",
      slug: "neurology",
    },
    {
      name: "الجلدية",
      icon: Sparkles,
      color: "#DB2777",
      bgColor: "#FDF2F8",
      slug: "dermatology",
    },
    {
      name: "الأطفال",
      icon: Baby,
      color: "#0EA5E9",
      bgColor: "#E0F2FE",
      slug: "pediatrics",
    },
    {
      name: "العظام",
      icon: Bone,
      color: "#EA580C",
      bgColor: "#FFF7ED",
      slug: "orthopedics",
    },
    {
      name: "الأذن والأنف والحنجرة",
      icon: Ear,
      color: "#0D9488",
      bgColor: "#F0FDFA",
      slug: "ent",
    },
    {
      name: "الأشعة",
      icon: Activity,
      color: "#0891B2",
      bgColor: "#ECFEFF",
      slug: "radiology",
    },
    {
      name: "الجراحة العامة",
      icon: Scissors,
      color: "#4F46E5",
      bgColor: "#EEF2FF",
      slug: "general-surgery",
    },
    {
      name: "العيون",
      icon: Eye,
      color: "#16A34A",
      bgColor: "#ECFDF3",
      slug: "ophthalmology",
    },
    {
      name: "التجميل",
      icon: BeautyIcon,
      color: "#D946EF",
      bgColor: "#F5E6FF",
      slug: "aesthetics",
    },
    {
      name: "الأسنان",
      icon: ToothIcon,
      color: "#0EA5E9",
      bgColor: "#E0F2FE",
      slug: "dentistry",
    },
  ];

  // أيكونات الخدمات الرئيسية
  const quickActions = [
    
    {
      key: "pharmacy",
      label: "صيدلية",
      icon: Pill,
      color: "#16A34A",
      bgColor: "#DCFCE7",
    },
    {
      key: "labs",
      label: "تحليلات",
      icon: FlaskConical,
      color: "#F97316",
      bgColor: "#FFF7ED",
    },
    {
      key: "nursing",
      label: "تمريض",
      icon: NurseIcon,
      color: "#6366F1",
      bgColor: "#EEF2FF",
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  const [selectedSpecialty, setSelectedSpecialty] = useState(
    specialties[0].name
  );

  const scrollContainerRef = useRef(null); // للسلايدر
  const mainScrollRef = useRef(null); // للسكرول الرئيسي
  const [specialtiesY, setSpecialtiesY] = useState(0); // مكان التخصصات

  const navigation = useNavigation();

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const handleEmergencyCallPress = async () => {
    const phone = "911";
    const url = Platform.OS === "ios" ? `telprompt:${phone}` : `tel:${phone}`;
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        Alert.alert("تنبيه", "لا يمكن إجراء الاتصال على هذا الجهاز");
        return;
      }
      await Linking.openURL(url);
    } catch (_e) {
      Alert.alert("خطأ", "تعذّر إجراء الاتصال");
    }
  };

  const handleSpecialtyPress = (specialty) => {
    setSelectedSpecialty(specialty.name);
    navigation.navigate("Specialty", { slug: specialty.slug });
  };

  const scrollToIndex = (index) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        x: index * (SCREEN_WIDTH - 32),
        animated: true,
      });
      setCurrentIndex(index);
      currentIndexRef.current = index;
    }
  };

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (SCREEN_WIDTH - 32));
    setCurrentIndex(index);
    currentIndexRef.current = index;
  };

  useEffect(() => {
    if (!carouselImages || carouselImages.length <= 1) return;
    const id = setInterval(() => {
      const next = (currentIndexRef.current + 1) % carouselImages.length;
      scrollToIndex(next);
    }, 7000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carouselImages.length]);

  // الضغط على الأيقونات الرئيسية
  const handleQuickActionPress = (key) => {
    if (key === "specialties") {
      if (mainScrollRef.current) {
        mainScrollRef.current.scrollTo({
          y: Math.max(specialtiesY - 80, 0),
          animated: true,
        });
      }
      return;
    }

    if (key === "pharmacy") {
      // غيّرها لاحقاً إلى navigation.navigate("Pharmacy")
      Alert.alert("قريباً", "شاشة الصيدلية سيتم ربطها لاحقاً.");
      return;
    }

    if (key === "labs") {
      Alert.alert("قريباً", "شاشة التحليلات سيتم ربطها لاحقاً.");
      return;
    }

    if (key === "nursing") {
      Alert.alert("قريباً", "شاشة التمريض سيتم ربطها لاحقاً.");
      return;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        ref={mainScrollRef}
        style={styles.root}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Message */}
        <TypewriterWelcome colors={colors} />
        {/* Top Section - Image Carousel */}
        <View style={styles.carouselContainerOuter}>
          <View style={styles.carouselCard}>
            <ScrollView
              ref={scrollContainerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {carouselImages.map((image, index) => (
                <TouchableOpacity
                  key={index}
                  style={{ width: SCREEN_WIDTH - 32 }}
                >
                  <ImageWithFallback
                    src={image}
                    alt={`Medical carousel ${index + 1}`}
                    styles={styles}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Dots indicator */}
            <View style={styles.dotsContainer}>
              {carouselImages.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => scrollToIndex(index)}
                  style={[
                    styles.dot,
                    index === currentIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Quick Actions Icons (التخصصات / صيدلية / تحليلات / تمريض) */}
        <View style={styles.section}>
          <View style={styles.quickActionsRow}>
            {quickActions.map((action) => {
              const IconComp = action.icon;
              return (
                <TouchableOpacity
                  key={action.key}
                  style={styles.quickActionCard}
                  activeOpacity={0.9}
                  onPress={() => handleQuickActionPress(action.key)}
                >
                  <View
                    style={[
                      styles.quickActionIconWrapper,
                      { backgroundColor: action.bgColor },
                    ]}
                  >
                    <IconComp color={action.color} size={22} />
                  </View>
                  <Text style={styles.quickActionLabel}>{action.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Medical Specialties Grid */}
        <View
          style={styles.section}
          onLayout={(e) => setSpecialtiesY(e.nativeEvent.layout.y)}
        >
          <Text style={styles.sectionTitle}>التخصصات الطبية</Text>
          <View style={styles.grid}>
            {specialties.map((specialty) => {
              const Icon = specialty.icon;
              const isActive = selectedSpecialty === specialty.name;
              return (
                <TouchableOpacity
                  key={specialty.name}
                  style={[styles.gridItem, isActive && styles.gridItemActive]}
                  activeOpacity={0.8}
                  onPress={() => handleSpecialtyPress(specialty)}
                >
                  <View
                    style={[
                      styles.iconWrapper,
                      { backgroundColor: specialty.bgColor },
                    ]}
                  >
                    <Icon color={specialty.color} size={24} />
                  </View>
                  <Text style={styles.gridItemText}>{specialty.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Emergency Call */}
        <View style={styles.section}>
          <View style={styles.emergencyWrap}>
            <View style={styles.emergencyCard}>
              <Text style={styles.emergencyLabel}>اتصل على الطوارئ</Text>

              <View style={styles.emergencyButtonWrap}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.emergencyPulse,
                    {
                      opacity: pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.35, 0],
                      }),
                      transform: [
                        {
                          scale: pulseAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.65],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.emergencyButton}
                  onPress={handleEmergencyCallPress}
                >
                  <FontAwesome5 name="phone-alt" size={30} color="#fff" />
                  <Text style={styles.emergencyText}>911</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    root: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 16,
    },
    carouselContainerOuter: {
      paddingHorizontal: 16,
      paddingTop: 24,
      paddingBottom: 12,
    },
    carouselCard: {
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor: colors.surface,
      elevation: 4,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
    },
    carouselImage: {
      width: "100%",
      height: 190,
      resizeMode: "cover",
    },
    fallbackImage: {
      width: "100%",
      height: 190,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    fallbackText: {
      color: colors.textMuted,
    },
    dotsContainer: {
      position: "absolute",
      bottom: 10,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "center",
    },
    dot: {
      height: 8,
      width: 8,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.5)",
      marginHorizontal: 3,
    },
    dotActive: {
      width: 18,
      backgroundColor: "#FFFFFF",
    },
    section: {
      paddingHorizontal: 16,
      paddingVertical: 16,
    },

  // ===== emergency call =====
  emergencyWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 8,
  },
  emergencyCard: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "rgba(220,38,38,0.35)",
    backgroundColor: "rgba(220,38,38,0.10)",
  },
  emergencyButtonWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyPulse: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "#DC2626",
  },
  emergencyButton: {
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emergencyText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 22,
  },
  emergencyLabel: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: "rtl",
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 16,
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "right",
  },
  // ===== quick actions =====
  quickActionsRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: 8,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  quickActionIconWrapper: {
    padding: 10,
    borderRadius: 999,
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  // ===== specialties grid =====
  grid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    rowGap: 12,
    columnGap: 12,
  },
  gridItem: {
    flexBasis: "30%",
    minWidth: "29%",
    maxWidth: "33%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  gridItemActive: {
    borderWidth: 1,
    borderColor: colors.primary,
    shadowOpacity: 0.25,
    elevation: 3,
  },
  iconWrapper: {
    padding: 10,
    borderRadius: 999,
    marginBottom: 8,
  },
  gridItemText: {
    fontSize: 11,
    textAlign: "center",
    color: colors.textMuted,
  },
  hospitalCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  mapPreview: {
    borderRadius: 18,
    height: 120,
    marginBottom: 14,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  pinWrapper: {
    backgroundColor: "#EF4444",
    padding: 10,
    borderRadius: 999,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
  },
  hospitalInfo: {
    gap: 8,
  },
  hospitalName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    textAlign: "right",
  },
  hospitalDistanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    textAlign: "right",
    marginTop: 4,
  },
  hospitalDistanceText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "right",
  },
  hospitalDetailsText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "right",
  },
  detailsButton: {
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  });
