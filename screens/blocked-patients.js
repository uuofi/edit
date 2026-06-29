import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import { fetchBlockedPatients, setBlock } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

export default function BlockedPatientsScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBlockedPatients({ scope: "chat", search });
      setRows(Array.isArray(data?.patients) ? data.patients : []);
    } catch (err) {
      Alert.alert("خطأ", err?.message || "تعذّر تحميل قائمة المحظورين");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      loadRows();
    }, [loadRows])
  );

  const handleUnblock = useCallback(
    async (patientId) => {
      const id = String(patientId || "").trim();
      if (!id || busyId) return;

      setBusyId(id);
      try {
        await setBlock(id, { blockChat: false });
        setRows((prev) => prev.filter((row) => String(row.patientId) !== id));
        Alert.alert("تم", "تم رفع حظر الرسائل عن المراجع");
      } catch (err) {
        Alert.alert("خطأ", err?.message || "تعذّر رفع الحظر");
      } finally {
        setBusyId("");
      }
    },
    [busyId]
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-right" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المحظورون من الرسائل</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="بحث بالاسم أو الرقم"
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={loadRows}
        />
        <TouchableOpacity onPress={loadRows}>
          <Feather name="refresh-cw" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.patientId)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const itemBusy = busyId === String(item.patientId);
            return (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.nameText}>{item.patientName || "مراجع"}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>حظر رسائل</Text>
                  </View>
                </View>
                <Text style={styles.phoneText}>{item.patientPhone || "-"}</Text>

                <TouchableOpacity
                  style={[styles.unblockBtn, itemBusy && styles.unblockBtnDisabled]}
                  onPress={() => handleUnblock(item.patientId)}
                  disabled={itemBusy}
                >
                  {itemBusy ? (
                    <ActivityIndicator color={colors.surface} size="small" />
                  ) : (
                    <Text style={styles.unblockText}>رفع الحظر</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>لا يوجد مراجعون محظورون من الرسائل</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 20 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    iconBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
      writingDirection: "rtl",
    },
    searchWrap: {
      margin: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 8,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      textAlign: "right",
      writingDirection: "rtl",
      paddingVertical: 4,
    },
    loaderWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    listContent: {
      paddingHorizontal: 12,
      paddingTop: 2,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 12,
      marginBottom: 10,
    },
    cardRow: {
      flexDirection: "row-reverse",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    nameText: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
      textAlign: "right",
      writingDirection: "rtl",
    },
    phoneText: {
      marginTop: 6,
      color: colors.textMuted,
      fontSize: 13,
      textAlign: "right",
      writingDirection: "rtl",
    },
    badge: {
      borderRadius: 999,
      backgroundColor: `${colors.danger}20`,
      borderWidth: 1,
      borderColor: `${colors.danger}55`,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    badgeText: {
      color: colors.danger,
      fontSize: 11,
      fontWeight: "700",
      writingDirection: "rtl",
    },
    unblockBtn: {
      marginTop: 10,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
    },
    unblockBtnDisabled: {
      opacity: 0.7,
    },
    unblockText: {
      color: colors.surface,
      fontSize: 14,
      fontWeight: "700",
      writingDirection: "rtl",
    },
    emptyWrap: {
      paddingVertical: 26,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      writingDirection: "rtl",
    },
  });
