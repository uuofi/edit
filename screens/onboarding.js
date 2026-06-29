// screens/onboarding.js
// First-launch intro slides shown before login / signup.
// Faithful to the soft sage-teal "Aura" reference: a frameless illustration,
// a bold centered title, a muted description, page dots and a circular
// teal advance button. Fully RTL / Arabic.
import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Animatable from "react-native-animatable";
import { ArrowLeft } from "lucide-react-native";
import { setOnboardingSeen } from "../lib/api";
import authColors from "../lib/authTheme";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    key: "care",
    image: require("../assets/images/FirstPage1.png"),
    title: "رعاية صحية مصممة من أجلك",
    description: "نجمع لك أفضل الأطباء والمراكز الطبية في مكان واحد.",
  },
  {
    key: "booking",
    image: require("../assets/images/firstPage2.png"),
    title: "احجز بسهولة وفي دقائق",
    description: "احجز موعدك المفضل بخطوات بسيطة وسريعة.",
  },
  {
    key: "secure",
    image: require("../assets/images/FirstPage3.png"),
    title: "جميع معلوماتك في مكان آمن",
    description: "سجلاتك الطبية محمية ومشفّرة بأعلى معايير الأمان.",
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(), []);
  const [index, setIndex] = useState(0);
  const contentRef = useRef(null);

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const finish = async () => {
    try {
      await setOnboardingSeen();
    } catch (e) {
      // non-fatal: still proceed to the auth flow
    }
    navigation.reset({ index: 0, routes: [{ name: "RoleSelection" }] });
  };

  const handleNext = () => {
    if (isLast) {
      finish();
      return;
    }
    contentRef.current?.fadeIn?.(260);
    setIndex((i) => Math.min(i + 1, SLIDES.length - 1));
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Skip */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={finish} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.skip}>تخطّي</Text>
        </TouchableOpacity>
      </View>

      <Animatable.View
        ref={contentRef}
        key={slide.key}
        animation="fadeIn"
        duration={320}
        useNativeDriver
        style={styles.content}
      >
        {/* Illustration (frameless) */}
        <Image source={slide.image} style={styles.illustration} resizeMode="contain" />

        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.description}>{slide.description}</Text>
      </Animatable.View>

      {/* Bottom controls: dots + advance button */}
      <View style={styles.bottomBar}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={[styles.dot, i === index ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isLast ? "ابدأ الآن" : "التالي"}
        >
          {isLast ? (
            <Text style={styles.nextLabel}>ابدأ</Text>
          ) : (
            <ArrowLeft size={26} color={authColors.onPrimary} strokeWidth={2.4} />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = () =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: authColors.background,
    },
    topBar: {
      flexDirection: "row",
      justifyContent: "flex-start",
      paddingHorizontal: 24,
      paddingTop: 8,
      height: 40,
    },
    skip: {
      fontSize: 15,
      color: authColors.muted,
      fontWeight: "500",
    },
    content: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    illustration: {
      width: width - 48,
      maxWidth: 420,
      height: width * 0.78,
      maxHeight: 360,
      marginBottom: 36,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: authColors.heading,
      textAlign: "center",
      writingDirection: "rtl",
      marginBottom: 14,
      lineHeight: 38,
    },
    description: {
      fontSize: 16,
      color: authColors.muted,
      textAlign: "center",
      writingDirection: "rtl",
      lineHeight: 26,
      paddingHorizontal: 8,
    },
    bottomBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 32,
      paddingBottom: 24,
      paddingTop: 12,
    },
    dots: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    dot: {
      height: 8,
      borderRadius: 4,
    },
    dotActive: {
      width: 26,
      backgroundColor: authColors.primary,
    },
    dotInactive: {
      width: 8,
      backgroundColor: authColors.primarySoftBorder,
    },
    nextButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: authColors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: authColors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 5,
    },
    nextLabel: {
      color: authColors.onPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
  });
