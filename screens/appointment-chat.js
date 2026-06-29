import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useRoute,
} from "@react-navigation/native";

import {
  API_BASE_URL,
  fetchMe,
  fetchChatContext,
  fetchChatMessages,
  getToken,
  getUserRole,
  markMessagesDelivered,
  markMessagesRead,
  sendChatMessage,
  sendTypingIndicator,
  setBlock,
  setChatPublicKey,
  uploadChatImage,
} from "../lib/api";
import {
  decryptE2EE,
  E2EE_ALG,
  E2EE_VERSION,
  encryptE2EE,
  ensureE2EEKeypair,
} from "../lib/e2ee";
import { getSocket } from "../lib/socket";
import { useAppTheme } from "../lib/useTheme";

const stripStatusPrefix = (message) =>
  String(message || "")
    .replace(/^\[\d+\]\s*/, "")
    .trim();

const CHAT_IMAGE_PAYLOAD_PREFIX = "__chat_image_v1__:";

const toAbsoluteMediaUrl = (uri) => {
  const value = String(uri || "").trim();
  if (!value) return "";
  if (/^(https?:|data:|file:|content:)/i.test(value)) return value;
  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

const encodeImagePayload = (imageUrl) => {
  const value = String(imageUrl || "").trim();
  if (!value) return "";
  return `${CHAT_IMAGE_PAYLOAD_PREFIX}${JSON.stringify({
    type: "image",
    secure: true,
    compressed: true,
    url: value,
  })}`;
};

const decodeImagePayload = (plaintext) => {
  const value = String(plaintext || "");
  if (!value.startsWith(CHAT_IMAGE_PAYLOAD_PREFIX)) return null;

  try {
    const raw = value.slice(CHAT_IMAGE_PAYLOAD_PREFIX.length);
    const parsed = JSON.parse(raw);
    const imageUrl = String(parsed?.url || "").trim();
    if (!imageUrl) return null;
    return { imageUrl };
  } catch {
    return null;
  }
};

const appendMediaQuery = (url, { appointmentId, patientId } = {}) => {
  const value = String(url || "").trim();
  if (!value) return "";
  if (!value.includes("/api/chat/media/")) return value;

  const parts = [];
  const normalizedAppointmentId = String(appointmentId || "").trim();
  const normalizedPatientId = String(patientId || "").trim();

  if (normalizedAppointmentId) {
    parts.push(`appointmentId=${encodeURIComponent(normalizedAppointmentId)}`);
  }
  if (normalizedPatientId) {
    parts.push(`patientId=${encodeURIComponent(normalizedPatientId)}`);
  }

  if (!parts.length) return value;
  return `${value}${value.includes("?") ? "&" : "?"}${parts.join("&")}`;
};

const formatTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "م" : "ص";
  hours = ((hours + 11) % 12) + 1;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}:${mm} ${period}`;
};

// لون فقاعة المُرسِل — teal غامق لضمان تباين كافٍ مع النص الأبيض (≥4.5:1)
const MINE_BUBBLE = "#127C71";

const computeMessageStatus = (message) => {
  if (message?.isRead) return "read";
  if (message?.delivered) return "delivered";
  return "sent";
};

const normalizeMessage = (message) => {
  const item = message && typeof message === "object" ? message : {};
  const normalized = {
    ...item,
    isRead: Boolean(item?.isRead),
    delivered: Boolean(item?.delivered),
  };

  const explicitStatus = item?.status;
  const fallbackStatus = computeMessageStatus(normalized);
  normalized.status =
    explicitStatus === "read" || explicitStatus === "delivered" || explicitStatus === "sent"
      ? explicitStatus
      : fallbackStatus;

  return normalized;
};

const mergeMessages = (existing, incoming) => {
  const map = new Map();

  (Array.isArray(existing) ? existing : []).forEach((item) => {
    const normalized = normalizeMessage(item);
    const id = String(normalized?._id || "");
    if (!id) return;
    map.set(id, normalized);
  });

  (Array.isArray(incoming) ? incoming : []).forEach((item) => {
    const normalized = normalizeMessage(item);
    const id = String(normalized?._id || "");
    if (!id) return;

    const previous = map.get(id);
    const next = previous ? normalizeMessage({ ...previous, ...normalized }) : normalized;
    map.set(id, next);
  });

  return Array.from(map.values()).sort((a, b) => {
    const left = new Date(a?.createdAt).getTime();
    const right = new Date(b?.createdAt).getTime();

    if (Number.isFinite(left) && Number.isFinite(right)) {
      if (left === right) {
        return String(a?._id || "").localeCompare(String(b?._id || ""));
      }
      return left - right;
    }

    return String(a?._id || "").localeCompare(String(b?._id || ""));
  });
};

const updateMessagesByIds = (messages, ids, updates) => {
  const idSet = new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || "")));
  if (!idSet.size) return messages;

  return (Array.isArray(messages) ? messages : []).map((item) => {
    const id = String(item?._id || "");
    if (!idSet.has(id)) return item;
    return normalizeMessage({ ...item, ...updates });
  });
};

const pickPendingMessageIds = ({
  items,
  senderType,
  pendingSet,
  predicate,
  max = 80,
}) => {
  const ids = [];

  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?._id || "");
    if (!id) continue;

    if (item?.senderType !== senderType && predicate(item) && !pendingSet.has(id)) {
      pendingSet.add(id);
      ids.push(id);
      if (ids.length >= max) break;
    }
  }

  return ids;
};

export default function AppointmentChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const params =
    route?.params && typeof route.params === "object" ? route.params : {};

  const appointmentId = String(params.appointmentId || "").trim();
  const patientIdParam = String(params.patientId || "").trim();
  const fallbackTitle =
    params.patientName || params.doctorName || params.title || "المحادثة";

  const [userRole, setUserRole] = useState(null);
  const [myUserId, setMyUserId] = useState("");
  const [context, setContext] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [updatingBlock, setUpdatingBlock] = useState(false);
  const [draft, setDraft] = useState("");
  const [chatNotice, setChatNotice] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [typingDots, setTypingDots] = useState(1);
  const [e2eeKeys, setE2eeKeys] = useState(null);
  const [authToken, setAuthToken] = useState("");
  const [previewImageUri, setPreviewImageUri] = useState("");
  const [savingPreviewImage, setSavingPreviewImage] = useState(false);

  const listRef = useRef(null);
  const socketRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null);
  const peerTypingTimeoutRef = useRef(null);
  const selfTypingStateRef = useRef(false);
  const deliveredPendingRef = useRef(new Set());
  const readPendingRef = useRef(new Set());
  const focusedRef = useRef(false);

  const chatParams = useMemo(() => {
    const payload = {};
    if (appointmentId) payload.appointmentId = appointmentId;
    if (patientIdParam) payload.patientId = patientIdParam;
    if (!patientIdParam && context?.patient?.id && userRole === "doctor") {
      payload.patientId = context.patient.id;
    }
    return payload;
  }, [appointmentId, context?.patient?.id, patientIdParam, userRole]);

  const buildSecureImageSource = useCallback(
    (rawUrl) => {
      const withQuery = appendMediaQuery(rawUrl, chatParams);
      const uri = toAbsoluteMediaUrl(withQuery);
      if (!uri) return null;

      if (withQuery.includes("/api/chat/media/") && authToken) {
        return {
          uri,
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        };
      }

      return { uri };
    },
    [authToken, chatParams]
  );

  const mySenderType = userRole === "doctor" ? "doctor" : "patient";
  const isDoctor = userRole === "doctor";
  const peerPublicKey = String(context?.e2ee?.peerPublicKey || "").trim();
  const serverE2EEAlg = String(context?.e2ee?.alg || "").trim();
  const isE2EEAlgCompatible = !serverE2EEAlg || serverE2EEAlg === E2EE_ALG;
  const hasE2EEHandshake = Boolean(e2eeKeys?.secretKey && peerPublicKey && isE2EEAlgCompatible);

  const headerTitle = useMemo(() => {
    if (isDoctor) {
      return context?.patient?.name || fallbackTitle;
    }
    return context?.doctor?.name || fallbackTitle;
  }, [context?.doctor?.name, context?.patient?.name, fallbackTitle, isDoctor]);

  const headerSubtitle = useMemo(() => {
    if (peerTyping) {
      return `يكتب الآن${".".repeat(typingDots)}`;
    }
    if (peerOnline) {
      return "متاح الآن";
    }
    if (context?.access?.hasArchive && !context?.access?.hasAppointment) {
      return "متاح عبر الأرشيف";
    }
    return "محادثة الطبيب والمراجع";
  }, [context?.access?.hasAppointment, context?.access?.hasArchive, peerOnline, peerTyping, typingDots]);

  const handleAccessError = useCallback((err, fallbackMessage) => {
    const status = Number(err?.status || 0);
    const message = stripStatusPrefix(err?.message || fallbackMessage || "تعذّر إكمال العملية");

    if (status === 403 || status === 409) {
      setChatNotice(message || "لا يمكن الوصول إلى المحادثة حالياً");
      return true;
    }

    return false;
  }, []);

  const loadRole = useCallback(async () => {
    try {
      const role = await getUserRole();
      setUserRole(role || null);
    } catch {
      setUserRole(null);
    }
  }, []);

  const bootstrapE2EE = useCallback(async () => {
    try {
      const meRes = await fetchMe();
      const me = meRes?.user || meRes || {};
      const id = String(me?.id || me?._id || "").trim();
      setMyUserId(id);

      if (!id) {
        setE2eeKeys(null);
        return;
      }

      const keys = await ensureE2EEKeypair(id);
      setE2eeKeys(keys);

      const serverPublicKey = String(me?.chatPublicKey || "").trim();
      if (keys?.publicKey && serverPublicKey !== keys.publicKey) {
        await setChatPublicKey(keys.publicKey);
      }
    } catch (err) {
      console.warn("E2EE bootstrap failed:", err?.message || err);
      setE2eeKeys(null);
      setMyUserId("");
    }
  }, []);

  const loadContextAndMessages = useCallback(async () => {
    setLoading(true);
    setChatNotice("");

    try {
      const [ctxRes, msgRes] = await Promise.all([
        fetchChatContext(chatParams),
        fetchChatMessages({ ...chatParams, limit: 80 }),
      ]);

      setContext(ctxRes?.context || null);
      setMessages(
        mergeMessages([], Array.isArray(msgRes?.messages) ? msgRes.messages : [])
      );
    } catch (err) {
      const handled = handleAccessError(err, "تعذّر تحميل المحادثة");
      if (!handled) {
        Alert.alert("خطأ", stripStatusPrefix(err?.message || "تعذّر تحميل المحادثة"));
      }
      setContext(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [chatParams, handleAccessError]);

  const refreshMessagesOnly = useCallback(async () => {
    if (!context?.conversationKey && !appointmentId && !patientIdParam) return;

    try {
      const msgRes = await fetchChatMessages({ ...chatParams, limit: 80 });
      const incoming = Array.isArray(msgRes?.messages) ? msgRes.messages : [];
      setMessages((prev) => mergeMessages(prev, incoming));

      if (!context?.conversationKey) {
        const ctxRes = await fetchChatContext(chatParams);
        if (ctxRes?.context) {
          setContext(ctxRes.context);
        }
      }
    } catch (err) {
      handleAccessError(err, "لا يمكن تحديث المحادثة الآن");
    }
  }, [appointmentId, chatParams, context?.conversationKey, handleAccessError, patientIdParam]);

  const syncDeliveredForMessages = useCallback(
    async (sourceMessages) => {
      if (!context?.conversationKey) return;

      const candidateIds = pickPendingMessageIds({
        items: sourceMessages,
        senderType: mySenderType,
        pendingSet: deliveredPendingRef.current,
        predicate: (item) => !item?.delivered,
      });

      if (!candidateIds.length) return;

      try {
        await markMessagesDelivered({
          ...chatParams,
          messageIds: candidateIds,
        });

        setMessages((prev) =>
          updateMessagesByIds(prev, candidateIds, {
            delivered: true,
            deliveredAt: new Date().toISOString(),
          })
        );
      } catch {
        candidateIds.forEach((id) => deliveredPendingRef.current.delete(id));
      }
    },
    [chatParams, context?.conversationKey, mySenderType]
  );

  const syncReadForMessages = useCallback(
    async (sourceMessages) => {
      if (!context?.conversationKey || !focusedRef.current) return;

      const candidateIds = pickPendingMessageIds({
        items: sourceMessages,
        senderType: mySenderType,
        pendingSet: readPendingRef.current,
        predicate: (item) => !item?.isRead,
      });

      if (!candidateIds.length) return;

      try {
        await markMessagesRead({
          ...chatParams,
          messageIds: candidateIds,
        });

        setMessages((prev) =>
          updateMessagesByIds(prev, candidateIds, {
            delivered: true,
            deliveredAt: new Date().toISOString(),
            isRead: true,
            readAt: new Date().toISOString(),
          })
        );
      } catch {
        candidateIds.forEach((id) => readPendingRef.current.delete(id));
      }
    },
    [chatParams, context?.conversationKey, mySenderType]
  );

  const emitTypingState = useCallback(
    (isTyping) => {
      const conversationKey = String(context?.conversationKey || "").trim();
      if (!conversationKey || !context?.access?.canSend) return;

      const nextTyping = Boolean(isTyping);
      if (selfTypingStateRef.current === nextTyping) return;
      selfTypingStateRef.current = nextTyping;

      const socket = socketRef.current;
      if (socket) {
        socket.emit("chat:typing", {
          conversationKey,
          isTyping: nextTyping,
        });
      }

      // REST fallback so typing still works even if the peer only receives user-room events.
      void sendTypingIndicator({ ...chatParams, isTyping: nextTyping }).catch(() => {});
    },
    [chatParams, context?.access?.canSend, context?.conversationKey]
  );

  const handleDraftChange = useCallback(
    (value) => {
      setDraft(value);

      const hasText = String(value || "").trim().length > 0;
      if (hasText) {
        emitTypingState(true);

        if (stopTypingTimeoutRef.current) {
          clearTimeout(stopTypingTimeoutRef.current);
        }

        stopTypingTimeoutRef.current = setTimeout(() => {
          emitTypingState(false);
        }, 1300);
      } else {
        if (stopTypingTimeoutRef.current) {
          clearTimeout(stopTypingTimeoutRef.current);
          stopTypingTimeoutRef.current = null;
        }
        emitTypingState(false);
      }
    },
    [emitTypingState]
  );

  const hydratedMessages = useMemo(() => {
    const mySecretKey = e2eeKeys?.secretKey;

    return (Array.isArray(messages) ? messages : []).map((item) => {
      const normalized = normalizeMessage(item);

      if (!normalized?.e2ee) {
        const fallbackText = normalized?.text || "";
        const decoded = decodeImagePayload(fallbackText);
        if (decoded?.imageUrl) {
          return {
            ...normalized,
            renderedText: "",
            renderedImageUrl: decoded.imageUrl,
          };
        }

        return {
          ...normalized,
          renderedText: fallbackText,
          renderedImageUrl: "",
        };
      }

      if (!mySecretKey || !peerPublicKey) {
        return {
          ...normalized,
          renderedText: "رسالة مشفّرة",
          renderedImageUrl: "",
        };
      }

      const plain = decryptE2EE(mySecretKey, peerPublicKey, {
        v: normalized?.e2eeVersion,
        alg: normalized?.e2eeAlg,
        nonce: normalized?.e2eeNonce,
        ciphertext: normalized?.e2eeCiphertext,
      });

      const decoded = decodeImagePayload(plain);
      if (decoded?.imageUrl) {
        return {
          ...normalized,
          renderedText: "",
          renderedImageUrl: decoded.imageUrl,
        };
      }

      return {
        ...normalized,
        renderedText: plain || "رسالة مشفّرة (تعذّر فكها)",
        renderedImageUrl: "",
      };
    });
  }, [e2eeKeys?.secretKey, messages, peerPublicKey]);

  const handleSend = useCallback(async () => {
    const text = String(draft || "").trim();
    if (!text || sending || uploadingImage) return;

    if (!context?.access?.canSend) {
      setChatNotice("لا يمكنك إرسال الرسائل حالياً");
      return;
    }

    if (!hasE2EEHandshake) {
      setChatNotice("التشفير غير جاهز بعد بين الطرفين. حاول بعد لحظات.");
      return;
    }

    setSending(true);
    try {
      const encrypted = encryptE2EE(e2eeKeys.secretKey, peerPublicKey, text);
      const payload = {
        ...chatParams,
        e2ee: true,
        e2eeVersion: E2EE_VERSION,
        e2eeAlg: E2EE_ALG,
        e2eeNonce: encrypted.nonce,
        e2eeCiphertext: encrypted.ciphertext,
      };

      const res = await sendChatMessage(payload);
      const nextMessage = res?.messageItem;

      if (nextMessage?._id) {
        setMessages((prev) => mergeMessages(prev, [nextMessage]));
      } else {
        await refreshMessagesOnly();
      }

      setDraft("");
      setChatNotice("");
      emitTypingState(false);
    } catch (err) {
      const handled = handleAccessError(err, "تعذّر إرسال الرسالة");
      if (!handled) {
        Alert.alert("خطأ", stripStatusPrefix(err?.message || "تعذّر إرسال الرسالة"));
      }
    } finally {
      setSending(false);
    }
  }, [
    chatParams,
    context?.access?.canSend,
    draft,
    e2eeKeys?.secretKey,
    emitTypingState,
    handleAccessError,
    hasE2EEHandshake,
    peerPublicKey,
    refreshMessagesOnly,
    sending,
    uploadingImage,
  ]);

  const handleSendImage = useCallback(async () => {
    if (sending || uploadingImage) return;

    if (!context?.access?.canSend) {
      setChatNotice("لا يمكنك إرسال الرسائل حالياً");
      return;
    }

    if (!hasE2EEHandshake) {
      setChatNotice("التشفير غير جاهز بعد بين الطرفين. حاول بعد لحظات.");
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission?.granted) {
        Alert.alert("تنبيه", "يجب السماح بالوصول للصور لإرسال صورة");
        return;
      }

      const picker = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.6,
      });

      if (picker.canceled) return;
      const selectedAsset = picker.assets?.[0];
      if (!selectedAsset?.uri) return;

      setUploadingImage(true);

      const uploadRes = await uploadChatImage({
        uri: selectedAsset.uri,
        appointmentId: chatParams.appointmentId,
        patientId: chatParams.patientId,
      });

      const uploadedImageUrl = String(uploadRes?.imageUrl || "").trim();
      if (!uploadedImageUrl) {
        throw new Error("تعذّر رفع الصورة");
      }

      const plaintext = encodeImagePayload(uploadedImageUrl);
      if (!plaintext) {
        throw new Error("تعذّر تجهيز الصورة للإرسال");
      }

      const encrypted = encryptE2EE(e2eeKeys.secretKey, peerPublicKey, plaintext);
      const payload = {
        ...chatParams,
        e2ee: true,
        e2eeVersion: E2EE_VERSION,
        e2eeAlg: E2EE_ALG,
        e2eeNonce: encrypted.nonce,
        e2eeCiphertext: encrypted.ciphertext,
      };

      const res = await sendChatMessage(payload);
      const nextMessage = res?.messageItem;

      if (nextMessage?._id) {
        setMessages((prev) => mergeMessages(prev, [nextMessage]));
      } else {
        await refreshMessagesOnly();
      }

      setChatNotice("");
    } catch (err) {
      const handled = handleAccessError(err, "تعذّر إرسال الصورة");
      if (!handled) {
        Alert.alert("خطأ", stripStatusPrefix(err?.message || "تعذّر إرسال الصورة"));
      }
    } finally {
      setUploadingImage(false);
    }
  }, [
    chatParams,
    context?.access?.canSend,
    e2eeKeys?.secretKey,
    handleAccessError,
    hasE2EEHandshake,
    peerPublicKey,
    refreshMessagesOnly,
    sending,
    uploadingImage,
  ]);

  const toggleChatBlock = useCallback(async () => {
    if (!isDoctor || !context?.patient?.id || updatingBlock) return;
    const next = !context?.access?.blockChat;

    setUpdatingBlock(true);
    try {
      await setBlock(context.patient.id, { blockChat: next });
      const ctxRes = await fetchChatContext({
        ...chatParams,
        patientId: context.patient.id,
      });
      setContext(ctxRes?.context || null);
      setChatNotice("");
      Alert.alert("تم", next ? "تم حظر الرسائل عن المراجع" : "تم رفع حظر الرسائل");
    } catch (err) {
      Alert.alert("خطأ", stripStatusPrefix(err?.message || "تعذّر تحديث الحظر"));
    } finally {
      setUpdatingBlock(false);
    }
  }, [chatParams, context?.access?.blockChat, context?.patient?.id, isDoctor, updatingBlock]);

  useEffect(() => {
    if (!isFocused) return;

    let active = true;
    const loadAuthToken = async () => {
      try {
        const token = await getToken();
        if (active) {
          setAuthToken(String(token || ""));
        }
      } catch {
        if (active) {
          setAuthToken("");
        }
      }
    };

    loadAuthToken();

    return () => {
      active = false;
    };
  }, [isFocused]);

  useEffect(() => {
    focusedRef.current = isFocused;
  }, [isFocused]);

  useEffect(() => {
    if (!peerTyping) return;
    const interval = setInterval(() => {
      setTypingDots((value) => (value >= 3 ? 1 : value + 1));
    }, 280);

    return () => clearInterval(interval);
  }, [peerTyping]);

  useEffect(() => {
    if (!messages.length) return;
    void syncDeliveredForMessages(messages);
    if (isFocused) {
      void syncReadForMessages(messages);
    }
  }, [isFocused, messages, syncDeliveredForMessages, syncReadForMessages]);

  useEffect(() => {
    if (isFocused) {
      void syncReadForMessages(messages);
    } else {
      emitTypingState(false);
    }
  }, [emitTypingState, isFocused, messages, syncReadForMessages]);

  useEffect(() => {
    const conversationKey = String(context?.conversationKey || "").trim();
    if (!conversationKey) return;

    let isActive = true;
    let socket = null;
    let roomCleanup = null;

    const mountSocket = async () => {
      try {
        socket = await getSocket();
        if (!isActive || !socket) return;

        socketRef.current = socket;

        const joinRoom = () => {
          socket.emit("chat:join", { conversationKey });
        };

        const onNewMessage = (payload) => {
          if (payload?.conversationKey !== conversationKey) return;
          if (!payload?.message?._id) return;
          setMessages((prev) => mergeMessages(prev, [payload.message]));
          setChatNotice("");
        };

        const onTyping = (payload) => {
          if (payload?.conversationKey !== conversationKey) return;

          const senderId = String(payload?.userId || "");
          if (senderId && senderId === String(myUserId || "")) return;

          const typing = Boolean(payload?.isTyping);
          setPeerTyping(typing);

          if (peerTypingTimeoutRef.current) {
            clearTimeout(peerTypingTimeoutRef.current);
            peerTypingTimeoutRef.current = null;
          }

          if (typing) {
            peerTypingTimeoutRef.current = setTimeout(() => {
              setPeerTyping(false);
            }, 2200);
          }
        };

        const onMessagesRead = (payload) => {
          if (payload?.conversationKey !== conversationKey) return;

          const ids = Array.isArray(payload?.messageIds) ? payload.messageIds : [];
          if (!ids.length) return;

          ids.forEach((id) => readPendingRef.current.add(String(id || "")));

          setMessages((prev) =>
            updateMessagesByIds(prev, ids, {
              delivered: true,
              deliveredAt: payload?.readAt || new Date().toISOString(),
              isRead: true,
              readAt: payload?.readAt || new Date().toISOString(),
            })
          );
        };

        const onDelivered = (payload) => {
          if (payload?.conversationKey !== conversationKey) return;

          const ids = Array.isArray(payload?.messageIds) ? payload.messageIds : [];
          if (!ids.length) return;

          ids.forEach((id) => deliveredPendingRef.current.add(String(id || "")));

          setMessages((prev) =>
            updateMessagesByIds(prev, ids, {
              delivered: true,
              deliveredAt: payload?.deliveredAt || new Date().toISOString(),
            })
          );
        };

        const onUserOnline = (payload) => {
          if (payload?.conversationKey !== conversationKey) return;

          const senderId = String(payload?.userId || "");
          if (senderId && senderId === String(myUserId || "")) return;

          setPeerOnline(Boolean(payload?.online));
        };

        socket.on("connect", joinRoom);
        socket.on("chat:newMessage", onNewMessage);
        socket.on("chat:typing", onTyping);
        socket.on("chat:messagesRead", onMessagesRead);
        socket.on("chat:delivered", onDelivered);
        socket.on("chat:userOnline", onUserOnline);

        if (socket.connected) {
          joinRoom();
        }

        socket.emit("chat:join", { conversationKey });

        const cleanup = () => {
          if (!socket) return;
          socket.off("connect", joinRoom);
          socket.off("chat:newMessage", onNewMessage);
          socket.off("chat:typing", onTyping);
          socket.off("chat:messagesRead", onMessagesRead);
          socket.off("chat:delivered", onDelivered);
          socket.off("chat:userOnline", onUserOnline);
          socket.emit("chat:leave", { conversationKey });
        };

        if (isActive) {
          socketRef.current = socket;
          roomCleanup = cleanup;
        } else {
          cleanup();
        }
      } catch {
        // Socket is optional; polling remains as fallback.
      }
    };

    mountSocket();

    return () => {
      isActive = false;

      if (peerTypingTimeoutRef.current) {
        clearTimeout(peerTypingTimeoutRef.current);
        peerTypingTimeoutRef.current = null;
      }

      setPeerTyping(false);
      setPeerOnline(false);

      if (typeof roomCleanup === "function") {
        roomCleanup();
      }
    };
  }, [context?.conversationKey, myUserId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const boot = async () => {
        await loadRole();
        await bootstrapE2EE();

        if (active) {
          await loadContextAndMessages();
        }
      };

      boot();

      const interval = setInterval(() => {
        void refreshMessagesOnly();
      }, 15000);

      return () => {
        active = false;
        clearInterval(interval);

        if (stopTypingTimeoutRef.current) {
          clearTimeout(stopTypingTimeoutRef.current);
          stopTypingTimeoutRef.current = null;
        }

        emitTypingState(false);
      };
    }, [bootstrapE2EE, emitTypingState, loadContextAndMessages, loadRole, refreshMessagesOnly])
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      listRef.current?.scrollToEnd?.({ animated: true });
    }, 120);

    return () => clearTimeout(timeout);
  }, [hydratedMessages.length, peerTyping]);

  const canCompose =
    Boolean(context?.access?.canSend) &&
    Boolean(hasE2EEHandshake) &&
    !sending &&
    !uploadingImage &&
    !chatNotice;

  const hasDraftText = String(draft || "").trim().length > 0;

  const previewImageSource = useMemo(
    () => buildSecureImageSource(previewImageUri),
    [buildSecureImageSource, previewImageUri]
  );

  const handleSavePreviewImage = useCallback(async () => {
    if (!previewImageSource?.uri || savingPreviewImage) return;

    try {
      setSavingPreviewImage(true);

      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission?.granted) {
        Alert.alert("تنبيه", "يجب السماح بالوصول للصور حتى يتم حفظ الصورة");
        return;
      }

      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDir) {
        throw new Error("لا يمكن الوصول إلى مساحة التخزين المؤقتة");
      }

      const cleanedUri = String(previewImageSource.uri || "").split("?")[0].split("#")[0];
      const ext = cleanedUri.split(".").pop()?.toLowerCase() || "webp";
      const safeExt = /^(jpg|jpeg|png|webp|gif)$/.test(ext) ? ext : "webp";
      const tempPath = `${baseDir}chat-${Date.now()}.${safeExt}`;

      const downloadRes = await FileSystem.downloadAsync(previewImageSource.uri, tempPath, {
        headers: previewImageSource?.headers || {},
      });

      const asset = await MediaLibrary.createAssetAsync(downloadRes.uri);
      if (Platform.OS === "android") {
        await MediaLibrary.createAlbumAsync("MediCare", asset, false).catch(() => {});
      }

      Alert.alert("تم", "تم حفظ الصورة في المعرض");
    } catch (err) {
      Alert.alert("خطأ", stripStatusPrefix(err?.message || "تعذر حفظ الصورة"));
    } finally {
      setSavingPreviewImage(false);
    }
  }, [previewImageSource, savingPreviewImage]);

  const renderStatusMark = (item) => {
    if (item?.status === "read") {
      return <Text style={styles.statusRead}>✓✓</Text>;
    }
    if (item?.status === "delivered") {
      return <Text style={styles.statusDelivered}>✓✓</Text>;
    }
    return <Text style={styles.statusSent}>✓</Text>;
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.goBack()}
            accessibilityLabel="رجوع"
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {headerTitle}
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                (peerOnline || peerTyping) && styles.headerSubtitleOnline,
              ]}
              numberOfLines={1}
            >
              {headerSubtitle}
            </Text>
          </View>

          {isDoctor ? (
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={toggleChatBlock}
              disabled={updatingBlock}
              accessibilityLabel={context?.access?.blockChat ? "رفع الحظر" : "حظر"}
            >
              <Feather
                name={context?.access?.blockChat ? "unlock" : "lock"}
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerIconBtn} />
          )}
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {chatNotice ? (
              <View style={styles.noticeWrap}>
                <Feather name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.noticeText}>{chatNotice}</Text>
                <TouchableOpacity
                  style={styles.noticeRetryBtn}
                  onPress={loadContextAndMessages}
                >
                  <Text style={styles.noticeRetryText}>إعادة المحاولة</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {!context?.access?.canSend && context ? (
              <View style={styles.warningWrap}>
                <Feather name="slash" size={14} color={colors.warning} />
                <Text style={styles.warningText}>
                  تم حظرك من إرسال الرسائل لهذا الطبيب.
                </Text>
              </View>
            ) : null}

            {context?.access?.canSend && !hasE2EEHandshake ? (
              <View style={styles.warningWrap}>
                <Feather name="lock" size={14} color={colors.warning} />
                <Text style={styles.warningText}>
                  {!isE2EEAlgCompatible
                    ? "إصدار التشفير غير متوافق بين الطرفين. حدّث التطبيق."
                    : "جاري تجهيز التشفير بين الطرفين. لن يتم إرسال رسائل غير مشفّرة."}
                </Text>
              </View>
            ) : null}

            <View style={styles.messagesPanel}>
              <FlatList
                ref={listRef}
                data={hydratedMessages}
                keyExtractor={(item, index) => String(item?._id || `msg-${index}`)}
                contentContainerStyle={styles.messagesList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const mine = item?.senderType === mySenderType;
                  const messageImageSource = buildSecureImageSource(item?.renderedImageUrl);

                  return (
                    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowOther]}>
                      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                        {item?.renderedImageUrl && messageImageSource ? (
                          <TouchableOpacity
                            style={styles.chatImageTouch}
                            activeOpacity={0.9}
                            onPress={() => setPreviewImageUri(item.renderedImageUrl)}
                          >
                            <Image
                              source={messageImageSource}
                              style={styles.chatImage}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                        ) : null}

                        {item?.renderedText ? (
                          <Text
                            style={[
                              styles.bubbleText,
                              mine ? styles.bubbleTextMine : styles.bubbleTextOther,
                              item?.renderedImageUrl ? styles.bubbleTextAfterImage : null,
                            ]}
                          >
                            {item.renderedText}
                          </Text>
                        ) : null}

                        <View
                          style={[
                            styles.metaRow,
                            mine ? styles.metaRowMine : styles.metaRowOther,
                          ]}
                        >
                          <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeOther]}>
                            {formatTime(item?.createdAt)}
                          </Text>
                          {mine ? renderStatusMark(item) : null}
                        </View>
                      </View>
                    </View>
                  );
                }}
                ListFooterComponent={
                  peerTyping ? (
                    <View style={[styles.bubbleRow, styles.bubbleRowOther]}>
                      <View style={[styles.bubble, styles.typingBubble]}>
                        <Text style={styles.typingText}>{`يكتب الآن${".".repeat(typingDots)}`}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.listBottomSpacer} />
                  )
                }
                ListEmptyComponent={
                  <View style={styles.emptyWrap}>
                    <Feather name="message-circle" size={22} color={colors.textMuted} />
                    <Text style={styles.emptyText}>لا توجد رسائل بعد</Text>
                    <Text style={styles.emptyHint}>ابدأ محادثة آمنة ومشفّرة بين الطرفين</Text>
                  </View>
                }
              />
            </View>

            <View style={styles.composerShell}>
              <View style={styles.composerWrap}>
                {/* زر الإجراء (teal): إرسال عند وجود نص، وإلا إرفاق صورة */}
                <TouchableOpacity
                  style={styles.sendBtn}
                  onPress={hasDraftText ? handleSend : handleSendImage}
                  disabled={!canCompose}
                  accessibilityLabel={hasDraftText ? "إرسال" : "إرفاق صورة"}
                >
                  {sending || uploadingImage ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <Feather
                      name={hasDraftText ? "send" : "plus"}
                      size={26}
                      color={canCompose ? colors.primary : colors.textMuted}
                    />
                  )}
                </TouchableOpacity>

                <TextInput
                  style={styles.input}
                  value={draft}
                  onChangeText={handleDraftChange}
                  placeholder={canCompose ? "اكتب رسالة..." : "الإرسال غير متاح حالياً"}
                  placeholderTextColor={colors.textMuted}
                  editable={canCompose}
                  multiline
                  textAlign="right"
                  textAlignVertical="center"
                  onSubmitEditing={hasDraftText ? handleSend : undefined}
                />

                {/* إرفاق صورة (يسار) */}
                <TouchableOpacity
                  style={styles.attachBtn}
                  onPress={handleSendImage}
                  disabled={!canCompose}
                  accessibilityLabel="إرفاق صورة"
                >
                  <Feather name="paperclip" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      <Modal
        visible={Boolean(previewImageUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUri("")}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewBackdrop}
            activeOpacity={1}
            onPress={() => setPreviewImageUri("")}
          />
          <View style={styles.previewCard}>
            {previewImageSource ? (
              <Image
                source={previewImageSource}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.previewLoaderWrap}>
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
            )}
            <TouchableOpacity
              style={styles.previewCloseBtn}
              onPress={() => setPreviewImageUri("")}
            >
              <Feather name="x" size={20} color={colors.surface} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.previewSaveBtn}
              onPress={handleSavePreviewImage}
              disabled={savingPreviewImage || !previewImageSource}
            >
              {savingPreviewImage ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Feather name="download" size={18} color={colors.surface} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors) => {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingTop: 6,
      paddingBottom: 10,
    },
    headerIconBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "800",
      writingDirection: "rtl",
    },
    headerSubtitle: {
      marginTop: 3,
      color: colors.textMuted,
      fontSize: 13,
      writingDirection: "rtl",
      fontWeight: "600",
    },
    headerSubtitleOnline: {
      color: colors.primary,
    },
    loaderWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    noticeWrap: {
      marginHorizontal: 12,
      marginTop: 6,
      marginBottom: 4,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.danger,
      backgroundColor: `${colors.danger}14`,
      paddingHorizontal: 10,
      paddingVertical: 10,
      flexDirection: "row-reverse",
      alignItems: "center",
    },
    noticeText: {
      flex: 1,
      marginHorizontal: 8,
      color: colors.danger,
      fontSize: 13,
      textAlign: "right",
      writingDirection: "rtl",
      fontWeight: "700",
    },
    noticeRetryBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: colors.danger,
    },
    noticeRetryText: {
      color: colors.surface,
      fontSize: 12,
      fontWeight: "700",
      writingDirection: "rtl",
    },
    warningWrap: {
      marginHorizontal: 12,
      marginTop: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: `${colors.warning}14`,
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: "row-reverse",
      alignItems: "center",
    },
    warningText: {
      marginHorizontal: 7,
      color: colors.warning,
      textAlign: "right",
      writingDirection: "rtl",
      fontSize: 12.5,
      fontWeight: "700",
      flex: 1,
    },
    messagesPanel: {
      flex: 1,
    },
    messagesList: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    bubbleRow: {
      flexDirection: "row",
      marginBottom: 16,
    },
    bubbleRowMine: {
      justifyContent: "flex-end",
    },
    bubbleRowOther: {
      justifyContent: "flex-start",
    },
    bubble: {
      maxWidth: "80%",
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    bubbleMine: {
      backgroundColor: MINE_BUBBLE,
      borderBottomRightRadius: 8,
    },
    bubbleOther: {
      backgroundColor: colors.surfaceAlt,
      borderBottomLeftRadius: 8,
    },
    chatImageTouch: {
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: `${colors.border}CC`,
    },
    chatImage: {
      width: 210,
      height: 210,
      backgroundColor: colors.inputBg,
    },
    bubbleText: {
      fontSize: 17,
      lineHeight: 26,
      writingDirection: "rtl",
      textAlign: "right",
    },
    bubbleTextMine: {
      color: "#FFFFFF",
      fontWeight: "600",
    },
    bubbleTextOther: {
      color: colors.text,
      fontWeight: "600",
    },
    bubbleTextAfterImage: {
      marginTop: 8,
    },
    metaRow: {
      marginTop: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    metaRowMine: {
      justifyContent: "flex-end",
    },
    metaRowOther: {
      justifyContent: "flex-start",
    },
    secureBadge: {
      flexDirection: "row-reverse",
      alignItems: "center",
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 3,
      backgroundColor: `${colors.background}30`,
    },
    secureBadgeText: {
      fontSize: 10,
      marginRight: 3,
      writingDirection: "rtl",
      fontWeight: "700",
    },
    secureBadgeTextMine: {
      color: `${colors.surface}CC`,
    },
    secureBadgeTextOther: {
      color: colors.textMuted,
    },
    metaRight: {
      flexDirection: "row",
      alignItems: "center",
    },
    bubbleTime: {
      fontSize: 12,
      fontWeight: "600",
    },
    bubbleTimeMine: {
      color: "rgba(255,255,255,0.8)",
    },
    bubbleTimeOther: {
      color: colors.textMuted,
    },
    statusSent: {
      fontSize: 12,
      fontWeight: "800",
      color: `${colors.surface}B3`,
      marginLeft: 3,
    },
    statusDelivered: {
      fontSize: 12,
      fontWeight: "800",
      color: `${colors.surface}D9`,
      marginLeft: 3,
    },
    statusRead: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.success,
      marginLeft: 3,
    },
    typingBubble: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomLeftRadius: 5,
    },
    typingText: {
      color: colors.textMuted,
      fontSize: 13,
      writingDirection: "rtl",
      textAlign: "right",
      fontWeight: "700",
    },
    listBottomSpacer: {
      height: 6,
    },
    emptyWrap: {
      paddingVertical: 34,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyText: {
      color: colors.text,
      fontSize: 14,
      marginTop: 8,
      writingDirection: "rtl",
      fontWeight: "700",
    },
    emptyHint: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 4,
      writingDirection: "rtl",
      textAlign: "center",
      paddingHorizontal: 26,
      fontWeight: "600",
    },
    composerShell: {
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: Platform.OS === "ios" ? 12 : 10,
    },
    composerWrap: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 6,
    },
    input: {
      flex: 1,
      minHeight: 50,
      maxHeight: 120,
      borderRadius: 26,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 18,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      writingDirection: "rtl",
    },
    attachBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtn: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtnDisabled: {
      opacity: 0.45,
    },
    previewOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.78)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
    },
    previewBackdrop: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    previewCard: {
      width: "100%",
      maxWidth: 420,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewImage: {
      width: "100%",
      height: 420,
      backgroundColor: colors.background,
    },
    previewLoaderWrap: {
      width: "100%",
      height: 420,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    previewCloseBtn: {
      position: "absolute",
      top: 10,
      left: 10,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    previewSaveBtn: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${colors.primary}CC`,
    },
  });
};