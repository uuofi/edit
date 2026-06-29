import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchDoctors, ApiError } from "./api";

const CACHE_KEY = "cache_all_doctors_v1";

// ترتيب حسب التقييم (الأعلى أولاً) — نفس منطق صفحة التخصص
export const compareDoctorsByRating = (a, b) => {
  const safeAvgA = Number.isFinite(Number(a?.ratingAverage)) ? Number(a.ratingAverage) : 0;
  const safeAvgB = Number.isFinite(Number(b?.ratingAverage)) ? Number(b.ratingAverage) : 0;
  const safeCountA = Number.isFinite(Number(a?.ratingCount)) ? Number(a.ratingCount) : 0;
  const safeCountB = Number.isFinite(Number(b?.ratingCount)) ? Number(b.ratingCount) : 0;

  const rankA = safeCountA > 0 ? safeAvgA : -1;
  const rankB = safeCountB > 0 ? safeAvgB : -1;

  if (rankB !== rankA) return rankB - rankA;
  if (safeCountB !== safeCountA) return safeCountB - safeCountA;

  const nameA = String(a?.displayName || a?.name || "");
  const nameB = String(b?.displayName || b?.name || "");
  return nameA.localeCompare(nameB, "ar");
};

// فلترة الأطباء حسب نص البحث + ترتيبهم حسب التقييم
export const filterDoctors = (doctors, query) => {
  const q = String(query || "").trim().toLowerCase();
  const list = Array.isArray(doctors) ? doctors : [];
  const filtered = !q
    ? list
    : list.filter((doc) => {
        const haystack = [
          doc.displayName,
          doc.name,
          doc.user?.name,
          doc.specialtyLabel,
          doc.specialty,
          doc.location,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
  return filtered.slice().sort(compareDoctorsByRating);
};

// Hook: يحمّل كل الأطباء (cache أولاً ثم تحديث من الشبكة)
export function useAllDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fetchingRef = useRef(false);

  const loadCached = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (!cached) return;
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length) {
        setDoctors(parsed);
        setLoading(false);
      }
    } catch (_e) {
      // تجاهل أخطاء الكاش
    }
  }, []);

  const reload = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const data = await fetchDoctors();
      const fresh = Array.isArray(data?.doctors) ? data.doctors : [];
      setDoctors(fresh);
      setError("");
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh)).catch(() => {});
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "تعذّر تحميل الأطباء";
      setError(msg);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCached();
    reload();
  }, [loadCached, reload]);

  return { doctors, loading, error, reload };
}
