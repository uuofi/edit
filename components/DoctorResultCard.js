import React, { useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { API_BASE_URL } from "../lib/api";
import {
  Stethoscope,
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
  Star,
  Shield,
  Droplet,
  ClipboardList,
} from "lucide-react-native";
import { useAppTheme } from "../lib/useTheme";

const GOLD = "#F5B544";

// أيقونة لكل تخصص (مطابقة لروح التصميم)
const SPECIALTY_ICON = {
  cardiology: Heart,
  neurology: Brain,
  dermatology: Droplet,
  pediatrics: Baby,
  orthopedics: Bone,
  ent: Ear,
  radiology: Activity,
  "general-surgery": Scissors,
  ophthalmology: Eye,
  aesthetics: Sparkles,
  dentistry: Smile,
};

// أيقونات بديلة دوّارة لإعطاء تنوّع بصري عند غياب الـ slug (مثل التصميم)
const FALLBACK_ICONS = [Droplet, Smile, Shield, ClipboardList];

const resolveIcon = (doctor, index = 0) => {
  const bySlug = SPECIALTY_ICON[doctor?.specialtySlug];
  if (bySlug) return bySlug;
  return FALLBACK_ICONS[index % FALLBACK_ICONS.length] || Stethoscope;
};

export default function DoctorResultCard({ doctor, index = 0, onPress }) {
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [imgFailed, setImgFailed] = useState(false);

  const Icon = resolveIcon(doctor, index);
  const name = doctor.displayName || doctor.name || doctor.user?.name || "طبيب";
  const specialty =
    doctor.specialtyLabel || doctor.specialty || doctor.role || "";
  const city = doctor.location || "";
  const ratingCount = Number(doctor.ratingCount) || 0;
  const ratingAvg = Number(doctor.ratingAverage) || 0;
  const experience =
    doctor.experienceYears ?? doctor.yearsOfExperience ?? null;
  const rawAvatarUrl = doctor.avatarUrl || "";
  const avatarUrl = rawAvatarUrl
    ? rawAvatarUrl.startsWith("http://") || rawAvatarUrl.startsWith("https://")
      ? rawAvatarUrl
      : `${API_BASE_URL}${rawAvatarUrl.startsWith("/") ? "" : "/"}${rawAvatarUrl}`
    : "";

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress?.(doctor)}
      accessibilityRole="button"
      accessibilityLabel={`${name}${specialty ? "، " + specialty : ""}`}
    >
      {/* العمود الأيسر: أيقونة التخصص + التقييم */}
      <View style={styles.leftColumn}>
        <View style={styles.iconSquare}>
          <Icon size={24} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={styles.ratingRow}>
          <Star size={15} color={GOLD} fill={GOLD} strokeWidth={2} />
          <Text style={styles.ratingValue}>
            {ratingCount > 0 ? ratingAvg.toFixed(1) : "0.0"}
          </Text>
          <Text style={styles.ratingCount}>({ratingCount})</Text>
        </View>
      </View>

      {/* المعلومات: الاسم، التخصص، المدينة */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {specialty ? (
          <Text style={styles.specialty} numberOfLines={1}>
            {specialty}
          </Text>
        ) : null}
        {city ? (
          <Text style={styles.city} numberOfLines={1}>
            {city}
          </Text>
        ) : null}
      </View>

      {/* الأفاتار + شارة سنوات الخبرة */}
      <View style={styles.avatarBlock}>
        {avatarUrl && !imgFailed ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Stethoscope size={28} color={colors.primary} strokeWidth={2} />
          </View>
        )}
        {experience != null ? (
          <Text style={styles.expBadge}>{`${experience}+`}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row-reverse",
      alignItems: "stretch",
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      marginBottom: 16,
      shadowColor: "#0B1F2A",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
      elevation: 2,
    },
    avatarBlock: {
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 14,
    },
    avatar: {
      width: 66,
      height: 66,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
    },
    avatarFallback: {
      alignItems: "center",
      justifyContent: "center",
    },
    expBadge: {
      marginTop: 6,
      fontSize: 13,
      fontWeight: "700",
      color: colors.textMuted,
    },
    info: {
      flex: 1,
      alignItems: "flex-end",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    name: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      textAlign: "right",
      alignSelf: "stretch",
    },
    specialty: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "right",
      alignSelf: "stretch",
      marginTop: 7,
    },
    city: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "right",
      alignSelf: "stretch",
      marginTop: 7,
    },
    leftColumn: {
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginRight: 4,
    },
    iconSquare: {
      width: 50,
      height: 50,
      borderRadius: 14,
      backgroundColor: colors.primary + "1A",
      alignItems: "center",
      justifyContent: "center",
    },
    ratingRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 4,
    },
    ratingValue: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    ratingCount: {
      fontSize: 13,
      color: colors.textMuted,
    },
  });
