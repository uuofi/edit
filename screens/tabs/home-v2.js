// screens/tabs/home-v2.js
// ⚠️ FRONT-END ONLY redesign — no backend calls. All data below is static mock
// data, matching the provided home design 1:1. Wire it to real data later.
// (The previous backend-connected version is saved as home-v2.backend.js.bak)
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import {
  Search,
  ScanLine,
  Building2,
  FlaskConical,
  Syringe,
  Heart,
  Brain,
  Sparkles,
  Baby,
  Bone,
  Ear,
  Activity,
  Scissors,
  Eye,
  Smile,
  Stethoscope,
  Star,
  User,
  ChevronLeft,
  MapPin,
} from "lucide-react-native";
import { specialtyItems } from "../../lib/constants/specialties";
import { API_BASE_URL, fetchCenters } from "../../lib/api";
import { useCenter } from "../../lib/centerContext";
import { useAllDoctors, filterDoctors } from "../../lib/doctorSearch";
import { goToDoctorDetails } from "../search-results";
import authColors from "../../lib/authTheme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/* ───────────────── Mock data (front-end only) ───────────────── */
const USER = { greeting: "صباح الخير،", name: "سارة" };


const QUICK_ACTIONS = [
  { key: "centers", label: "المجمعات الطبية", Icon: Building2 },
  { key: "labs", label: "مختبرات", Icon: FlaskConical },
  { key: "nursing", label: "ممرضين", Icon: Syringe },
];

// Icon + short label per specialty slug. The list itself is driven by
// `specialtyItems` (the slug source), so the Home stays in sync automatically.
const SPECIALTY_META = {
  cardiology: { Icon: Heart, label: "القلب" },
  neurology: { Icon: Brain, label: "الأعصاب" },
  dermatology: { Icon: Sparkles, label: "الجلدية" },
  pediatrics: { Icon: Baby, label: "الأطفال" },
  orthopedics: { Icon: Bone, label: "العظام" },
  ent: { Icon: Ear, label: "الأنف والأذن" },
  radiology: { Icon: Activity, label: "الأشعة" },
  "general-surgery": { Icon: Scissors, label: "الجراحة" },
  ophthalmology: { Icon: Eye, label: "العيون" },
  aesthetics: { Icon: Star, label: "التجميل" },
  dentistry: { Icon: Smile, label: "الأسنان" },
};

const SPECIALTIES = specialtyItems.map((item) => {
  const meta = SPECIALTY_META[item.slug] || {};
  return {
    slug: item.slug,
    title: item.title,
    label: meta.label || String(item.title || "").replace(/^تخصص\s+/, ""),
    Icon: meta.Icon || Stethoscope,
  };
});


/* ───────────────── Small pieces ───────────────── */
function SectionTitle({ children }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

// صورة الطبيب مع بديل (أيقونة) في حال فشل تحميل الصورة
function DoctorAvatar({ uri }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={s.apptAvatar}>
        <Stethoscope size={28} color={authColors.white} strokeWidth={2} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={s.apptAvatarImg}
      onError={() => setFailed(true)}
    />
  );
}

function HealthChart() {
  // decorative front-end-only line chart
  const w = SCREEN_WIDTH * 0.34;
  const h = 64;
  const line =
    "M2,52 C14,50 20,30 32,34 C44,38 50,14 64,20 C78,26 84,46 96,38 C108,30 116,10 126,16";
  const area = `${line} L126,62 L2,62 Z`;
  return (
    <Svg width={w} height={h} viewBox="0 0 128 64">
      <Defs>
        <SvgGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={authColors.primary} stopOpacity="0.25" />
          <Stop offset="1" stopColor={authColors.primary} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Path d={area} fill="url(#fill)" />
      <Path d={line} stroke={authColors.primary} strokeWidth={2.4} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/* ───────────────── Screen ───────────────── */
export default function HomeScreen() {
  const styles = useMemo(() => s, []);
  const navigation = useNavigation();
  const { setCenter } = useCenter();
  const [searchQuery, setSearchQuery] = useState("");
  const [topCenter, setTopCenter] = useState(null);

  // الأطباء (كاش + شبكة) — نختار الأعلى تقييماً (بيانات حقيقية)
  const { doctors, loading: doctorsLoading } = useAllDoctors();
  const topDoctor = useMemo(() => filterDoctors(doctors, "")[0] || null, [doctors]);

  const openTopDoctor = () => {
    if (topDoctor) goToDoctorDetails(navigation, topDoctor);
  };

  // نجلب المجمعات الطبية ونختار صاحب أعلى تقييم (بيانات حقيقية)
  useEffect(() => {
    let active = true;
    fetchCenters()
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data?.centers) ? data.centers : [];
        const ranked = list
          .slice()
          .sort((a, b) => {
            const avgA = Number(a?.ratingAverage) || 0;
            const avgB = Number(b?.ratingAverage) || 0;
            if (avgB !== avgA) return avgB - avgA;
            return (Number(b?.ratingCount) || 0) - (Number(a?.ratingCount) || 0);
          });
        setTopCenter(ranked[0] || null);
      })
      .catch(() => {
        if (active) setTopCenter(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const openTopCenter = async () => {
    if (!topCenter?._id) {
      navigation.navigate("CentersMini");
      return;
    }
    await setCenter({ id: topCenter._id, name: topCenter.name || "" });
    navigation.navigate("CenterDoctors", {
      centerId: topCenter._id,
      centerName: topCenter.name || "",
    });
  };

  const submitSearch = () => {
    navigation.navigate("SearchResults", { query: searchQuery.trim() });
  };

  const openSpecialty = (sp) => {
    // يفتح صفحة الأطباء الحالية حسب التخصص (الصفحة الموجودة)
    navigation.navigate("Specialty", { slug: sp.slug });
  };

  const handleQuickAction = (key) => {
    if (key === "centers") {
      navigation.navigate("CentersMini");
      return;
    }
    // مختبرات / ممرضين: قيد العمل عليهما
    Alert.alert("قريباً", "هذه الخدمة قيد العمل عليها وسيتم تفعيلها لاحقاً.");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.greetingWrap}>
            <Text style={styles.greetingSmall}>{USER.greeting}</Text>
            <Text style={styles.greetingName}>{USER.name}</Text>
          </View>
          <View style={styles.avatar}>
            <User size={26} color={authColors.primary} strokeWidth={2} />
          </View>
        </View>

        {/* Search */}
        <TouchableOpacity
          style={styles.searchWrap}
          activeOpacity={0.8}
          onPress={submitSearch}
        >
          <Search size={20} color={authColors.muted} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث عن طبيب أو تخصص..."
            placeholderTextColor={authColors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
          />
          <ScanLine size={20} color={authColors.muted} strokeWidth={2} />
        </TouchableOpacity>

        {/* Top rated doctor (real data) */}
        <SectionTitle>الطبيب الأعلى تقييماً</SectionTitle>
        {topDoctor ? (
          <TouchableOpacity activeOpacity={0.9} onPress={openTopDoctor}>
            <LinearGradient
              colors={["#5B9E91", "#3E6B62"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.apptCard}
            >
              <DoctorAvatar
                uri={
                  topDoctor.avatarUrl && /^https?:|^\//i.test(topDoctor.avatarUrl)
                    ? /^https?:/i.test(topDoctor.avatarUrl)
                      ? topDoctor.avatarUrl
                      : `${API_BASE_URL}${topDoctor.avatarUrl}`
                    : ""
                }
              />
              <View style={styles.apptInfo}>
                <Text style={styles.apptName} numberOfLines={1}>
                  {topDoctor.displayName || topDoctor.name || topDoctor.user?.name}
                </Text>
                <Text style={styles.apptSpecialty} numberOfLines={1}>
                  {topDoctor.specialtyLabel || topDoctor.specialty || "طبيب"}
                </Text>
                <View style={styles.apptRatingRow}>
                  <Star size={15} color="#F5B544" fill="#F5B544" strokeWidth={2} />
                  <Text style={styles.apptRatingValue}>
                    {Number(topDoctor.ratingCount) > 0
                      ? Number(topDoctor.ratingAverage).toFixed(1)
                      : "جديد"}
                  </Text>
                  {Number(topDoctor.ratingCount) > 0 ? (
                    <Text style={styles.apptRatingCount}>
                      ({topDoctor.ratingCount} تقييم)
                    </Text>
                  ) : null}
                </View>
              </View>
              <ChevronLeft size={22} color={authColors.white} strokeWidth={2} />
            </LinearGradient>
          </TouchableOpacity>
        ) : doctorsLoading ? (
          <View style={[styles.apptCard, styles.apptCardPlaceholder]}>
            <ActivityIndicator color={authColors.primary} />
            <Text style={styles.placeholderText}>جاري تحميل الأطباء…</Text>
          </View>
        ) : (
          <View style={[styles.apptCard, styles.apptCardPlaceholder]}>
            <Stethoscope size={22} color={authColors.muted} strokeWidth={2} />
            <Text style={styles.placeholderText}>
              لا يوجد أطباء متاحون حالياً.
            </Text>
          </View>
        )}

        {/* Quick actions */}
        <SectionTitle>خدمات سريعة</SectionTitle>
        <View style={styles.quickRow}>
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={styles.quickItem}
              activeOpacity={0.85}
              onPress={() => handleQuickAction(a.key)}
            >
              <View style={styles.quickIcon}>
                <a.Icon size={24} color={authColors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.quickLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Medical specialties — horizontal scroll of all slugs */}
        <SectionTitle>التخصصات الطبية</SectionTitle>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.specialtiesScroll}
          style={styles.specialtiesScrollOuter}
        >
          {SPECIALTIES.map((sp) => (
            <TouchableOpacity
              key={sp.slug}
              style={styles.specialtyItem}
              activeOpacity={0.85}
              onPress={() => openSpecialty(sp)}
            >
              <View style={styles.specialtyIcon}>
                <sp.Icon size={24} color={authColors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.specialtyLabel} numberOfLines={1}>
                {sp.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Featured medical center (top rated, real data) */}
        {topCenter ? (
          <>
            <SectionTitle>المجمعات الطبية المميزة</SectionTitle>
            <TouchableOpacity activeOpacity={0.9} onPress={openTopCenter}>
              <LinearGradient
                colors={["#33514B", "#1F3A34"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.featuredCard}
              >
                {topCenter.logoUrl ? (
                  <Image
                    source={{
                      uri: /^https?:/i.test(topCenter.logoUrl)
                        ? topCenter.logoUrl
                        : `${API_BASE_URL}${topCenter.logoUrl.startsWith("/") ? "" : "/"}${topCenter.logoUrl}`,
                    }}
                    style={styles.featuredAvatarImg}
                  />
                ) : (
                  <View style={styles.featuredAvatar}>
                    <Building2 size={32} color={authColors.white} strokeWidth={1.8} />
                  </View>
                )}
                <View style={styles.featuredInfo}>
                  <Text style={styles.featuredName} numberOfLines={1}>
                    {topCenter.name}
                  </Text>
                  {topCenter.location ? (
                    <View style={styles.featuredLocationRow}>
                      <MapPin size={13} color="rgba(255,255,255,0.75)" strokeWidth={2} />
                      <Text style={styles.featuredSpecialty} numberOfLines={1}>
                        {topCenter.location}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.ratingRow}>
                    <Star size={15} color="#F5B544" fill="#F5B544" strokeWidth={2} />
                    <Text style={styles.ratingValue}>
                      {Number(topCenter.ratingCount) > 0
                        ? Number(topCenter.ratingAverage).toFixed(1)
                        : "جديد"}
                    </Text>
                    {Number(topCenter.ratingCount) > 0 ? (
                      <Text style={styles.featuredTime}>
                        ({topCenter.ratingCount} تقييم)
                      </Text>
                    ) : null}
                  </View>
                  {Number(topCenter.doctorCount) > 0 ? (
                    <Text style={styles.featuredTime}>
                      {topCenter.doctorCount} طبيب
                    </Text>
                  ) : null}
                </View>
                <ChevronLeft size={22} color={authColors.white} strokeWidth={2} />
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : null}

        {/* Health tip */}
        <View style={styles.tipCard}>
          <View style={styles.tipChart}>
            <HealthChart />
          </View>
          <View style={styles.tipInfo}>
            <Text style={styles.tipTitle}>نصيحة صحية</Text>
            <Text style={styles.tipText}>
              حافظ على نشاطك اليومي ومتابعة معدل ضربات قلبك بانتظام لصحة أفضل.
            </Text>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ───────────────── Styles ───────────────── */
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: authColors.background,
  },
  root: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  greetingWrap: {
    flex: 1,
  },
  greetingSmall: {
    fontSize: 20,
    fontWeight: "600",
    color: authColors.heading,
    textAlign: "left",
    writingDirection: "rtl",
  },
  greetingName: {
    fontSize: 26,
    fontWeight: "800",
    color: authColors.heading,
    textAlign: "left",
    writingDirection: "rtl",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: authColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: authColors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: authColors.inputBorder,
    paddingHorizontal: 16,
    height: 54,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: authColors.heading,
    textAlign: "left",
    writingDirection: "ltr",
    paddingVertical: 0,
  },
  // Section title
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: authColors.heading,
    textAlign: "left",
    writingDirection: "ltr",
    marginBottom: 14,
  },
  // Upcoming appointment card
  apptCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 22,
    padding: 16,
    marginBottom: 26,
    shadowColor: "#2E4F49",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  apptCardPlaceholder: {
    justifyContent: "center",
    backgroundColor: authColors.card,
    borderWidth: 1,
    borderColor: authColors.inputBorder,
    shadowOpacity: 0,
    elevation: 0,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: "600",
    color: authColors.muted,
    writingDirection: "rtl",
  },
  apptAvatar: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  apptAvatarImg: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  apptInfo: { flex: 1 },
  apptName: {
    fontSize: 17,
    fontWeight: "800",
    color: authColors.white,
    textAlign: "left",
    writingDirection: "ltr",
  },
  apptSpecialty: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    textAlign: "left",
    writingDirection: "ltr",
    marginTop: 2,
  },
  apptRatingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
  },
  apptRatingValue: {
    fontSize: 14,
    fontWeight: "800",
    color: authColors.white,
  },
  apptRatingCount: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    writingDirection: "rtl",
  },
  // Quick actions / specialties row
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 26,
  },
  quickItem: {
    flex: 1,
    alignItems: "center",
  },
  quickIcon: {
    width: "100%",
    aspectRatio: 1,
    maxHeight: 72,
    borderRadius: 18,
    backgroundColor: authColors.card,
    borderWidth: 1,
    borderColor: authColors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: authColors.body,
    textAlign: "center",
  },
  // Specialties horizontal scroll
  specialtiesScrollOuter: {
    marginBottom: 26,
    marginHorizontal: -20, // bleed to screen edges
  },
  specialtiesScroll: {
    paddingHorizontal: 20,
    gap: 14,
  },
  specialtyItem: {
    width: 72,
    alignItems: "center",
  },
  specialtyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: authColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  specialtyLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: authColors.body,
    textAlign: "center",
  },
  // Featured doctor card
  featuredCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 22,
    padding: 16,
    marginBottom: 26,
    shadowColor: "#1F3A34",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 4,
  },
  featuredAvatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  featuredAvatarImg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  featuredLocationRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  featuredInfo: { flex: 1 },
  featuredName: {
    fontSize: 17,
    fontWeight: "800",
    color: authColors.white,
    textAlign: "right",
    writingDirection: "rtl",
  },
  featuredSpecialty: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    textAlign: "right",
    writingDirection: "rtl",
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    marginTop: 6,
  },
  ratingValue: {
    fontSize: 12,
    fontWeight: "700",
    color: authColors.white,
    marginRight: 4,
  },
  featuredTime: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
    textAlign: "right",
    writingDirection: "rtl",
    marginTop: 6,
  },
  // Health tip
  tipCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: authColors.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: authColors.inputBorder,
  },
  tipChart: {
    width: SCREEN_WIDTH * 0.34,
    alignItems: "center",
    justifyContent: "center",
  },
  tipInfo: { flex: 1 },
  tipTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: authColors.heading,
    textAlign: "right",
    writingDirection: "rtl",
    marginBottom: 6,
  },
  tipText: {
    fontSize: 13,
    color: authColors.muted,
    textAlign: "right",
    writingDirection: "rtl",
    lineHeight: 21,
  },
});
