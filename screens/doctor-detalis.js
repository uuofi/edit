import React, { useMemo, useRef, useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ArrowLeft, Pencil, MapPin, Star, ShieldCheck, CalendarCheck } from "lucide-react-native";
import { useAppTheme } from "../lib/useTheme";
import { API_BASE_URL } from "../lib/api";

const { width, height } = Dimensions.get("window");

const resolveMediaUrl = (value) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const prefix = raw.startsWith("/") ? "" : "/";
  return `${API_BASE_URL}${prefix}${raw}`;
};

export default function DoctorDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = route.params || {};

  const doctorName = params.name || "د. سارة القحطاني";
  const doctorSpecialty = params.role || params.specialty || "طبيب أسنان";
  const specialtyTitle = params.specialty || "قسم الأسنان";
  const doctorAge = params.age;
  const avatarUrl = resolveMediaUrl(params.avatarUrl);
  const location = params.location || "الرياض";
  const consultationFee = params.consultationFee;
  const ratingAverage = Number(params.ratingAverage);
  const ratingCount = Number(params.ratingCount);
  const hasRating = Number.isFinite(ratingAverage) && ratingCount > 0;
  
  const avatarSource = avatarUrl ? { uri: avatarUrl } : null;

  // Animation for blurred background
  const pulseAnim = useRef(new Animated.Value(0.7)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 3000,
            useNativeDriver: true,
          })
        ]),
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          })
        ])
      ])
    ).start();
  }, [pulseAnim, scaleAnim]);

  // Navigate to book appointment
  const handleBook = () => {
    navigation.navigate("BookAppointment", {
      ...params,
      doctorName,
      doctorRole: doctorSpecialty,
      specialty: specialtyTitle,
      avatarUrl: params.avatarUrl, // Pass raw
      location: location,
    });
  };

  return (
    <View style={styles.screen}>
      {/* Top Section */}
      <View style={styles.topSection}>
         {/* Background blurred image */}
         {avatarSource && (
            <Animated.Image 
               source={avatarSource} 
               style={[styles.bgImage, { opacity: pulseAnim, transform: [{ scale: scaleAnim }] }]}
               blurRadius={20}
            />
         )}
         {/* Clear image */}
         <View style={styles.clearImageContainer}>
            {avatarSource ? (
                <Image source={avatarSource} style={styles.clearImage} />
            ) : (
                <View style={styles.placeholderImage} />
            )}
         </View>
         
         {/* Top Actions */}
         <SafeAreaView style={styles.topActionsSafeArea} edges={['top']}>
            <View style={styles.topActions}>
               <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
                  <ArrowLeft color="#1F3A34" size={26} /> 
               </TouchableOpacity>
               <TouchableOpacity style={[styles.iconButton, styles.pencilButton]}>
                  <Pencil color="#4A9E96" size={20} />
               </TouchableOpacity>
            </View>
         </SafeAreaView>
      </View>
      
      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
         <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
             <Text style={styles.doctorName}>{doctorName}</Text>
             <Text style={styles.doctorSpecialty}>{doctorSpecialty}</Text>
             
             <View style={styles.statsRow}>
                 <Text style={styles.statText}>{doctorAge ? `${doctorAge} سنة` : '6 سنوات'}</Text>
                 <View style={styles.statDivider} />
                 <View style={styles.ratingWrap}>
                    <Text style={styles.statTextMuted}>({ratingCount || '150'})</Text>
                    <Text style={styles.statTextBold}>{hasRating ? ratingAverage.toFixed(1) : '4.9'}</Text>
                    <Star color="#F5B544" fill="#F5B544" size={16} />
                 </View>
             </View>
             
             <View style={styles.locationWrap}>
                 <Text style={styles.locationText}>{location}</Text>
                 <MapPin color="#4A9E96" size={18} />
             </View>
             
             <View style={styles.highlightsRow}>
                 <View style={[styles.highlightCard, styles.highlightActive]}>
                     <View style={styles.highlightIcon}>
                         <ShieldCheck color="#F5B544" size={26} />
                     </View>
                     <Text style={styles.highlightTitle}>مرخص ومعتمد</Text>
                     <Text style={styles.highlightSub}>معتمد</Text>
                 </View>
                 <View style={styles.highlightCard}>
                     <View style={styles.highlightIcon}>
                         <CalendarCheck color="#4A9E96" size={26} />
                     </View>
                     <Text style={styles.highlightTitle}>حجز سهل</Text>
                     <Text style={styles.highlightSub}>متاح</Text>
                 </View>
                 <View style={styles.highlightCard}>
                     <View style={styles.highlightIcon}>
                         <Star color="#F5B544" size={26} />
                     </View>
                     <Text style={styles.highlightTitle}>تقييمات ممتازة</Text>
                     <Text style={styles.highlightSub}>{ratingCount || '150'} تقييم</Text>
                 </View>
             </View>
             
             <View style={styles.servicesList}>
                 <View style={styles.serviceItem}>
                     <Text style={styles.serviceName}>تنظيف الأسنان</Text>
                     <View style={styles.servicePriceWrap}>
                        <Text style={styles.servicePrice}>{consultationFee || '250'}</Text>
                        <Text style={styles.serviceCurrency}>رس</Text>
                     </View>
                 </View>
                 <View style={styles.serviceItem}>
                     <Text style={styles.serviceName}>تبييض الأسنان</Text>
                     <View style={styles.servicePriceWrap}>
                        <Text style={styles.servicePrice}>650</Text>
                        <Text style={styles.serviceCurrency}>رس</Text>
                     </View>
                 </View>
                 <View style={[styles.serviceItem, { borderBottomWidth: 0 }]}>
                     <Text style={styles.serviceName}>تركيب توريد</Text>
                     <View style={styles.servicePriceWrap}>
                        <Text style={styles.servicePrice}>800</Text>
                        <Text style={styles.serviceCurrency}>رس</Text>
                     </View>
                 </View>
             </View>
         </ScrollView>
         
         <View style={styles.footer}>
            <TouchableOpacity style={styles.bookButton} onPress={handleBook}>
                <Text style={styles.bookButtonText}>احجز موعد</Text>
            </TouchableOpacity>
         </View>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#8CA4AF' },
  topSection: {
    height: height * 0.45,
    position: 'relative',
    backgroundColor: '#8CA4AF',
    overflow: 'hidden',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  clearImageContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  clearImage: {
    width: '100%',
    height: '90%',
    resizeMode: 'contain',
  },
  placeholderImage: {
    width: 120, height: 120,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 60,
    marginBottom: 40,
  },
  topActionsSafeArea: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
  },
  topActions: {
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'flex-start',
  },
  iconButton: {
    width: 44, height: 44,
    justifyContent: 'center', alignItems: 'center',
  },
  pencilButton: {
    marginTop: 15,
    backgroundColor: '#E5EFED',
    borderRadius: 14,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    marginTop: -30,
    paddingTop: 25,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  doctorName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1F3A34',
    textAlign: 'center',
    marginBottom: 6,
  },
  doctorSpecialty: {
    fontSize: 16,
    color: '#607d8b',
    textAlign: 'center',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  statText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A5568',
  },
  statTextBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F3A34',
    marginHorizontal: 4,
  },
  statTextMuted: {
    fontSize: 14,
    color: '#A0AEC0',
  },
  statDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#CBD5E0',
    marginHorizontal: 12,
  },
  ratingWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  locationWrap: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
  },
  locationText: {
    fontSize: 15,
    color: '#4A5568',
    marginRight: 6,
    fontWeight: '500',
  },
  highlightsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  highlightCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  highlightActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#4A9E96',
  },
  highlightIcon: {
    marginBottom: 10,
  },
  highlightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A5568',
    textAlign: 'center',
    marginBottom: 6,
  },
  highlightSub: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
  },
  servicesList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serviceItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F7FAFC',
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A5568',
  },
  servicePriceWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  servicePrice: {
    fontSize: 17,
    fontWeight: '800',
    color: '#4A5568',
  },
  serviceCurrency: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 25,
    paddingTop: 10,
    backgroundColor: '#FAFAFA',
  },
  bookButton: {
    backgroundColor: '#4A9E96',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
