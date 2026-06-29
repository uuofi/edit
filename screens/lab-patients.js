// screens/lab-patients.js — قائمة مرضى المختبر
import React, { useMemo, useState, useCallback } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { fetchLabPatients, fetchLabPatientOrders } from "../lib/api";
import { useAppTheme } from "../lib/useTheme";

const TL = "#0D9488";

export default function LabPatientsScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useAppTheme();
  const S = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [patients, setPatients] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchLabPatients({ search: search || undefined });
      setPatients(res.patients || []);
    } catch (e) {
      Alert.alert("خطأ", e.message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const viewHistory = async (patient) => {
    try {
      await fetchLabPatientOrders(patient.phone);
      navigation.navigate("LabOrders"); // could pass patientPhone as param for filtered view
    } catch (e) {
      Alert.alert("خطأ", e.message);
    }
  };

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Feather name="arrow-right" size={22} color={TL} /></TouchableOpacity>
        <Text style={S.title}>المرضى ({patients.length})</Text>
        <View />
      </View>

      <View style={S.searchBox}>
        <Feather name="search" size={16} color={colors.textSecondary} />
        <TextInput
          style={S.searchInput}
          placeholder="بحث بالاسم أو رقم الهاتف..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          onEndEditing={load}
          returnKeyType="search"
          onSubmitEditing={load}
        />
      </View>

      {loading
        ? <ActivityIndicator color={TL} style={{ marginTop: 30 }} />
        : (
          <FlatList
            data={patients}
            keyExtractor={(i) => i._id || i.phone}
            contentContainerStyle={S.list}
            ListEmptyComponent={<Text style={S.empty}>لا توجد سجلات مرضى</Text>}
            renderItem={({ item: p }) => (
              <TouchableOpacity style={S.card} onPress={() => viewHistory(p)}>
                <View style={S.avatar}>
                  <Text style={S.avatarText}>
                    {p.gender === "female" ? "♀" : "♂"}
                  </Text>
                </View>
                <View style={S.info}>
                  <Text style={S.name}>{p.name}</Text>
                  <Text style={S.sub}>{p.phone}{p.age ? ` · ${p.age} سنة` : ""}</Text>
                </View>
                <View style={S.right}>
                  <Text style={S.count}>{p.total}</Text>
                  <Text style={S.countLabel}>طلبات</Text>
                </View>
                <Feather name="chevron-left" size={18} color={colors.textSecondary} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            )}
          />
        )
      }
    </SafeAreaView>
  );
}

const createStyles = (c, dark) => StyleSheet.create({
  safe:        { flex: 1, backgroundColor: c.background },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  title:       { fontSize: 17, fontWeight: "700", color: c.text },
  searchBox:   { flexDirection: "row", alignItems: "center", margin: 12, backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: 12, gap: 8, borderWidth: 1, borderColor: c.border },
  searchInput: { flex: 1, height: 40, color: c.text, textAlign: "right" },
  list:        { padding: 12, gap: 8, paddingBottom: 40 },
  card:        { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 12, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  avatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: "#CCFBF1", alignItems: "center", justifyContent: "center" },
  avatarText:  { fontSize: 20, color: TL },
  info:        { flex: 1 },
  name:        { fontSize: 15, fontWeight: "700", color: c.text, textAlign: "right" },
  sub:         { fontSize: 12, color: c.textSecondary, textAlign: "right", marginTop: 2 },
  right:       { alignItems: "center" },
  count:       { fontSize: 18, fontWeight: "800", color: TL },
  countLabel:  { fontSize: 10, color: c.textSecondary },
  empty:       { textAlign: "center", color: c.textSecondary, marginTop: 40, fontSize: 15 },
});
