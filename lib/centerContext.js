import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CENTER_ID_KEY = "medicare_center_id";
const CENTER_NAME_KEY = "medicare_center_name";

const CenterContext = createContext({
  centerId: null,
  centerName: "",
  setCenter: async () => {},
  clearCenter: async () => {},
  loading: true,
});

export const CenterProvider = ({ children }) => {
  const [centerId, setCenterId] = useState(null);
  const [centerName, setCenterName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const storedId = await AsyncStorage.getItem(CENTER_ID_KEY);
      const storedName = await AsyncStorage.getItem(CENTER_NAME_KEY);
      setCenterId(storedId || null);
      setCenterName(storedName || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setCenter = useCallback(async ({ id, name }) => {
    const nextId = String(id || "").trim();
    const nextName = String(name || "").trim();
    if (!nextId) return;
    await AsyncStorage.setItem(CENTER_ID_KEY, nextId);
    await AsyncStorage.setItem(CENTER_NAME_KEY, nextName);
    setCenterId(nextId);
    setCenterName(nextName);
  }, []);

  const clearCenter = useCallback(async () => {
    await AsyncStorage.removeItem(CENTER_ID_KEY);
    await AsyncStorage.removeItem(CENTER_NAME_KEY);
    setCenterId(null);
    setCenterName("");
  }, []);

  const value = useMemo(
    () => ({ centerId, centerName, setCenter, clearCenter, loading }),
    [centerId, centerName, setCenter, clearCenter, loading]
  );

  return <CenterContext.Provider value={value}>{children}</CenterContext.Provider>;
};

export const useCenter = () => useContext(CenterContext);

export const getStoredCenterId = async () => {
  const id = await AsyncStorage.getItem(CENTER_ID_KEY);
  return id || null;
};

export const getStoredCenterName = async () => {
  const name = await AsyncStorage.getItem(CENTER_NAME_KEY);
  return name || "";
};
