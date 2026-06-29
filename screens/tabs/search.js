import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import DoctorResultCard from "../../components/DoctorResultCard";
import { useAllDoctors, filterDoctors } from "../../lib/doctorSearch";
import { goToDoctorDetails } from "../search-results";
import { useAppTheme } from "../../lib/useTheme";

export default function SearchScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState("");

  const { doctors, loading, error, reload } = useAllDoctors();

  const results = useMemo(
    () => filterDoctors(doctors, query),
    [doctors, query]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>بحث</Text>
      </View>

      {/* حقل البحث */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="ابحث عن طبيب أو تخصص أو مدينة..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          textAlign="right"
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
            <Feather name="x" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* صف التصفية / الترتيب */}
      <View style={styles.filterRow}>
        <TouchableOpacity activeOpacity={0.7}>
          <Text style={styles.filterText}>تصفية</Text>
        </TouchableOpacity>
        <Text style={styles.sortText}>ترتيب: الأعلى تقييماً</Text>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => String(item._id || item.id)}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <DoctorResultCard
            doctor={item}
            index={index}
            onPress={(doc) => goToDoctorDetails(navigation, doc)}
          />
        )}
        ListHeaderComponent={
          loading && results.length === 0 ? (
            <View style={styles.loaderWrapper}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <Feather name="search" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyText}>
                {error || (query ? "لا توجد نتائج مطابقة." : "ابدأ بكتابة اسم طبيب أو تخصص.")}
              </Text>
              {error ? (
                <TouchableOpacity onPress={reload} style={styles.retryBtn}>
                  <Text style={styles.retryText}>إعادة المحاولة</Text>
                </TouchableOpacity>
              ) : query ? (
                <Text style={styles.emptySubText}>جرّب كلمة بحث أخرى.</Text>
              ) : null}
            </View>
          ) : null
        }
        ListFooterComponent={<View style={{ height: 96 }} />}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    headerTitle: {
      textAlign: "center",
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
    },
    searchWrap: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 10,
      marginHorizontal: 20,
      marginBottom: 6,
      paddingHorizontal: 16,
      height: 50,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      paddingVertical: 0,
    },
    filterRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 12,
    },
    filterText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.primary,
    },
    sortText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    loaderWrapper: {
      paddingVertical: 40,
    },
    emptyState: {
      paddingVertical: 48,
      alignItems: "center",
    },
    emptyIconWrapper: {
      width: 64,
      height: 64,
      borderRadius: 999,
      backgroundColor: colors.primary + "15",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
      textAlign: "center",
    },
    emptySubText: {
      fontSize: 13,
      color: colors.textMuted,
    },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    retryText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "600",
    },
  });
