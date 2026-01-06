import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActionSheetIOS,
  Alert,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  fetchMessages,
  sendMessage,
  sendMessageE2EE,
  deleteMessage,
  getUserRole,
  API_BASE_URL,
  uploadChatImage,
  reportMessage,
  fetchMe,
  setMyChatPublicKey,
  fetchChatE2EEKeys,
} from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAppTheme } from "../lib/useTheme";
import { decryptE2EE, encryptE2EE, ensureE2EEKeypair } from "../lib/e2ee";

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params || {};

  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [imageRatios, setImageRatios] = useState({});
  const [sending, setSending] = useState(false);
  const socketRef = useRef(null);
  const messageHandlerRef = useRef(null);
  const deleteHandlerRef = useRef(null);
  const e2eeRef = useRef({ mySecretKey: "", otherPublicKey: "" });
  const [role, setRole] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const appointmentId = params.appointmentId;
  const cacheKey = appointmentId ? `CHAT_CACHE_${appointmentId}` : null;

  const decodeMessageText = (m) => {
    if (!m || m.deleted) return "";
    const ctx = e2eeRef.current || {};
    if (m.e2ee?.ciphertext && ctx.mySecretKey && ctx.otherPublicKey) {
      const dec = decryptE2EE(ctx.mySecretKey, ctx.otherPublicKey, m.e2ee);
      return dec || "";
    }
    return m.text || "";
  };

  const formatMessage = (m) => ({
    id: m._id || m.id || `temp-${Date.now()}`,
    sender: m.senderType || m.sender || "user",
    text: decodeMessageText(m),
    time: new Date(m.createdAt || Date.now()).toLocaleTimeString("ar", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    deleted: !!m.deleted,
    reply: m.replyTo
      ? {
          id: m.replyTo._id,
          text: decodeMessageText(m.replyTo),
          sender: m.replyTo.senderType,
          deleted: !!m.replyTo.deleted,
        }
      : null,
  });

  const counterpartName = params.doctorName || params.patientName || "المحادثة";
  const headerStatus = params.appointmentTime && params.appointmentDate
    ? `${params.appointmentDate} • ${params.appointmentTime}`
    : "متصل";
  const avatarUrl = params.avatarUrl;

  const loadHistory = async () => {
    if (!appointmentId) return;
    try {
      if (cacheKey) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const cleaned = parsed
              .map(formatMessage)
              .filter((m) => !m.deleted);
            setMessages(cleaned);
          }
        }
      }
      const data = await fetchMessages(appointmentId);
      const history = (data.messages || [])
        .filter((m) => !m.deleted)
        .map(formatMessage);
      setMessages(history);
      if (cacheKey) {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(history));
      }
    } catch (err) {
      console.log("chat history error", err);
    }
  };

  const setupSocket = async () => {
    if (!appointmentId) return;
    const socket = await getSocket();
    socketRef.current = socket;
    if (messageHandlerRef.current) {
      socket.off("message", messageHandlerRef.current);
    }
    if (deleteHandlerRef.current) {
      socket.off("messageDeleted", deleteHandlerRef.current);
    }
    socket.emit("join", { appointmentId });
    const handler = (msg) => {
      if (msg.appointmentId !== appointmentId) return;
      setMessages((prev) => {
        if (msg._id && prev.some((m) => m.id === msg._id)) return prev; // prevent duplicates
        const next = [...prev, formatMessage(msg)];
        if (cacheKey) AsyncStorage.setItem(cacheKey, JSON.stringify(next)).catch(() => {});
        return next;
      });
    };
    messageHandlerRef.current = handler;
    socket.on("message", handler);

    const deleteHandler = (payload) => {
      if (!payload || payload.appointmentId !== appointmentId) return;
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== payload._id);
        if (cacheKey) AsyncStorage.setItem(cacheKey, JSON.stringify(next)).catch(() => {});
        return next;
      });
    };
    deleteHandlerRef.current = deleteHandler;
    socket.on("messageDeleted", deleteHandler);
  };

  const teardownSocket = () => {
    if (socketRef.current && messageHandlerRef.current) {
      socketRef.current.off("message", messageHandlerRef.current);
      messageHandlerRef.current = null;
    }
    if (socketRef.current && deleteHandlerRef.current) {
      socketRef.current.off("messageDeleted", deleteHandlerRef.current);
      deleteHandlerRef.current = null;
    }
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      getUserRole().then(setRole).catch(() => {});

      // Initialize E2EE context (best-effort). If it fails, chat still works (legacy).
      try {
        const me = await fetchMe();
        const myUserId = me?.user?._id;
        if (myUserId) {
          const kp = await ensureE2EEKeypair(myUserId);
          setMyChatPublicKey(kp.publicKey).catch(() => {});

          if (appointmentId) {
            const keys = await fetchChatE2EEKeys(appointmentId).catch(() => null);
            const otherPublicKey = String(keys?.other?.publicKey || "").trim();
            if (alive) {
              e2eeRef.current = {
                mySecretKey: kp.secretKey,
                otherPublicKey,
              };
            }
          }
        }
      } catch (err) {
        // ignore
      }

      if (!alive) return;
      await loadHistory();
      await setupSocket();
    })();

    return () => {
      alive = false;
      teardownSocket();
    };
  }, [appointmentId]);

  const sendContent = async (content) => {
    if (!content || !appointmentId) return;
    try {
      const socket = socketRef.current || (await getSocket());

      const ctx = e2eeRef.current || {};
      const canE2EE = !!(ctx.mySecretKey && ctx.otherPublicKey);

      if (canE2EE) {
        const e2ee = encryptE2EE(ctx.mySecretKey, ctx.otherPublicKey, content);
        if (socket && socket.connected) {
          socket.emit("message", { appointmentId, e2ee, replyTo: replyTarget?.id });
        } else {
          const res = await sendMessageE2EE(appointmentId, e2ee, replyTarget?.id);
          if (res?.message) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === res.message._id)) return prev;
              const next = [...prev, formatMessage(res.message)];
              if (cacheKey) AsyncStorage.setItem(cacheKey, JSON.stringify(next)).catch(() => {});
              return next;
            });
          }
        }

        setReplyTarget(null);
        return;
      }

      if (socket && socket.connected) {
        socket.emit("message", { appointmentId, text: content, replyTo: replyTarget?.id });
      } else {
        const res = await sendMessage(appointmentId, content, replyTarget?.id);
        if (res?.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === res.message._id)) return prev;
            const next = [...prev, formatMessage(res.message)];
            if (cacheKey) AsyncStorage.setItem(cacheKey, JSON.stringify(next)).catch(() => {});
            return next;
          });
        }
      }
      setReplyTarget(null);
    } catch (err) {
      console.log("send error", err);
    }
  };

  const handleSend = async () => {
    if (!appointmentId || sending) return;
    const text = input.trim();
    const hasText = !!text;
    const hasImage = !!pendingImage?.uri;
    if (!hasText && !hasImage) return;

    // Clear input immediately for responsiveness.
    setInput("");

    setSending(true);

    if (hasText) {
      await sendContent(text);
    }

    if (hasImage) {
      try {
        const uploaded = await uploadChatImage(appointmentId, pendingImage);
        if (uploaded?.url) {
          await sendContent(uploaded.url);
        } else {
          Alert.alert("خطأ", "تعذّر رفع الصورة.");
        }
      } catch (err) {
        Alert.alert("خطأ", err?.message || "تعذّر إرسال الصورة");
      } finally {
        setPendingImage(null);
      }
    }

    setSending(false);
  };

  const isImageContent = (value) => {
    if (typeof value !== "string") return false;
    const lower = value.toLowerCase();
    return (
      lower.startsWith("data:image") ||
      lower.startsWith("file://") ||
      lower.startsWith("/uploads/") ||
      lower.match(/\.(png|jpe?g|gif|webp|heic)(\?|$)/)
    );
  };

  const resolveMediaUri = (uri) => {
    if (!uri) return uri;
    const s = String(uri);
    if (s.startsWith("/uploads/")) return `${API_BASE_URL}${s}`;
    return s;
  };

  const isMyMessage = (msg) => {
    if (role === "doctor") return true;
    return false;
  };

  const handlePickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("الصلاحيات", "يجب منح صلاحية الوصول للصور لإرسال مرفق.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        base64: false,
        quality: 1,
        allowsEditing: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;

      if (!asset.uri) {
        Alert.alert("خطأ", "تعذّر قراءة الصورة.");
        return;
      }

      // Attach only; do not send until the user presses Send.
      setPendingImage({
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
      });
    } catch (err) {
      console.log("image pick error", err);
      Alert.alert("خطأ", err?.message || "تعذّر إرسال الصورة");
    }
  };
  const handleDelete = async (msg) => {
    try {
      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit("deleteMessage", { appointmentId, messageId: msg.id });
      }
      await deleteMessage(appointmentId, msg.id);
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== msg.id);
        if (cacheKey) AsyncStorage.setItem(cacheKey, JSON.stringify(next)).catch(() => {});
        return next;
      });

      if (replyTarget?.id === msg.id) setReplyTarget(null);
    } catch (err) {
      console.log("delete error", err);
    }
  };

  const handleReport = async (msg) => {
    if (!appointmentId || !msg?.id) return;

    Alert.alert(
      "تبليغ عن محتوى",
      "هل تريد تبليغ هذه الرسالة؟ سيتم إرسال البلاغ للمراجعة.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تبليغ",
          style: "destructive",
          onPress: async () => {
            try {
              await reportMessage(appointmentId, msg.id, "user_report");
              Alert.alert("تم", "تم إرسال البلاغ للمراجعة.");
            } catch (err) {
              Alert.alert("خطأ", err?.message || "تعذّر إرسال البلاغ.");
            }
          },
        },
      ]
    );
  };

  const handleMessageOptions = (msg) => {
    const canDelete = isMyMessage(msg) && !msg.deleted;
    const canReply = !msg.deleted;
    const canReport = !msg.deleted;

    if (Platform.OS === "ios") {
      const optionLabels = [];
      const actions = [];
      let destructiveButtonIndex = -1;
      let cancelButtonIndex = -1;

      if (canReply) {
        optionLabels.push("Reply");
        actions.push(() => setReplyTarget(msg));
      }

      if (canReport) {
        optionLabels.push("Report");
        actions.push(() => handleReport(msg));
      }

      if (canDelete) {
        destructiveButtonIndex = optionLabels.length;
        optionLabels.push("Unsend");
        actions.push(() => handleDelete(msg));
      }

      cancelButtonIndex = optionLabels.length;
      optionLabels.push("Cancel");
      actions.push(() => {});

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: optionLabels,
          cancelButtonIndex,
          destructiveButtonIndex: destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined,
        },
        (buttonIndex) => {
          const fn = actions[buttonIndex];
          if (fn) fn();
        }
      );
      return;
    }

    const options = [];
    if (canReport) {
      options.push({
        text: "تبليغ",
        style: "destructive",
        onPress: () => handleReport(msg),
      });
    }
    if (canDelete) {
      options.push({
        text: "حذف",
        style: "destructive",
        onPress: () => handleDelete(msg),
      });
    }
    if (canReply) {
      options.push({
        text: "رد",
        onPress: () => setReplyTarget(msg),
      });
    }
    options.push({ text: "إلغاء", style: "cancel" });
    Alert.alert("خيارات الرسالة", "", options);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.goBack()}
            >
            <Feather name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar} />
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{counterpartName}</Text>
            <Text style={styles.headerStatus}>{headerStatus}</Text>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          style={styles.messagesList}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg, idx) => {
            const isUser = msg.sender === "user" || msg.sender === "patient";
            const replyText = msg.reply
              ? msg.reply.deleted
                ? "تم حذف الرسالة"
                : msg.reply.text || ""
              : null;
            const showImage = isImageContent(msg.text);
            return (
              <View
                key={msg.id || idx}
                style={[
                  styles.messageRow,
                  { justifyContent: isUser ? "flex-end" : "flex-start" },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.messagePressable, showImage && styles.messagePressableImage]}
                  onLongPress={() => handleMessageOptions(msg)}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isUser ? styles.messageUser : styles.messageDoctor,
                      showImage && styles.messageImageBubble,
                    ]}
                  >
                    {replyText !== null && (
                      <View style={styles.replyPreview}>
                        <Text style={styles.replyLabel}>ردًا على</Text>
                        <Text
                          style={[
                            styles.replyText,
                            isUser && styles.replyTextUser,
                            msg.reply?.deleted && styles.replyDeletedText,
                          ]}
                          numberOfLines={1}
                        >
                          {replyText || "..."}
                        </Text>
                      </View>
                    )}
                    {showImage ? (
                      <Image
                        source={{ uri: resolveMediaUri(msg.text) }}
                        style={[
                          styles.messageImage,
                          {
                            aspectRatio:
                              typeof imageRatios[msg.id] === "number" && imageRatios[msg.id] > 0
                                ? imageRatios[msg.id]
                                : 1,
                          },
                        ]}
                        resizeMode="contain"
                        onLoad={(e) => {
                          const src = e?.nativeEvent?.source;
                          const w = Number(src?.width);
                          const h = Number(src?.height);
                          if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
                          const ratio = w / h;
                          setImageRatios((prev) => (prev[msg.id] === ratio ? prev : { ...prev, [msg.id]: ratio }));
                        }}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.messageText,
                          isUser && styles.messageTextUser,
                        ]}
                      >
                        {msg.text}
                      </Text>
                    )}
                    <Text
                      style={[
                        styles.messageTime,
                        isUser ? styles.messageTimeUser : styles.messageTimeDoctor,
                      ]}
                    >
                      {msg.time}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>

        {/* Reply bar */}
        {replyTarget && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarText}>
              <Text style={styles.replyBarLabel}>الرد على</Text>
              <Text style={styles.replyBarContent} numberOfLines={1}>
                {replyTarget.deleted ? "تم حذف الرسالة" : replyTarget.text}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTarget(null)}>
              <Feather name="x" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Pending attachment */}
        {pendingImage?.uri && (
          <View style={styles.attachmentBar}>
            <View style={styles.attachmentBarText}>
              <Text style={styles.attachmentBarLabel}>مرفق</Text>
              <Text style={styles.attachmentBarContent} numberOfLines={1}>
                صورة جاهزة للإرسال
              </Text>
            </View>
            <TouchableOpacity onPress={() => setPendingImage(null)}>
              <Feather name="x" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.iconButton} onPress={handlePickImage}>
            <Feather name="paperclip" size={20} color={colors.placeholder} />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="اكتب رسالة..."
            placeholderTextColor={colors.placeholder}
            value={input}
            onChangeText={setInput}
          />
          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 999,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  headerStatus: {
    fontSize: 11,
    color: "#16A34A",
    marginTop: 2,
  },
  messages: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },
  messagesList: {
    flex: 1,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 8,
    width: "100%",
  },
  messagePressable: {
    maxWidth: "60%",
  },
  messagePressableImage: {
    maxWidth: "92%",
  },
  messageBubble: {
    maxWidth: "100%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexShrink: 1,
    direction: "rtl",
  },
  messageDoctor: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  messageUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageDeleted: {
    backgroundColor: colors.border,
  },
  messageText: {
    fontSize: 14,
    color: colors.text,
    textAlign: "right",
    writingDirection: "rtl",
    flexWrap: "wrap",
  },
  messageTextUser: {
    color: "#fff",
  },
  messageTextDeleted: {
    color: colors.textMuted,
    fontStyle: "italic",
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
  },
  messageTimeDoctor: {
    color: colors.textMuted,
  },
  messageTimeUser: {
    color: "#BFDBFE",
  },
  replyPreview: {
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    paddingLeft: 8,
    marginBottom: 6,
  },
  messageImage: {
    width: "100%",
    borderRadius: 14,
    marginTop: 4,
    backgroundColor: "#000",
    alignSelf: "stretch",
  },
  messageImageBubble: {
    padding: 6,
    backgroundColor: colors.surfaceAlt,
    maxWidth: "100%",
  },
  replyLabel: {
    fontSize: 11,
    color: colors.primary,
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
    color: colors.text,
  },
  replyTextUser: {
    color: "#fff",
  },
  replyDeletedText: {
    color: colors.textMuted,
    fontStyle: "italic",
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  replyBarText: { flex: 1 },
  replyBarLabel: {
    fontSize: 12,
    color: colors.primary,
    marginBottom: 4,
    fontWeight: "600",
  },
  replyBarContent: {
    fontSize: 13,
    color: colors.text,
  },

  attachmentBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  attachmentBarText: { flex: 1 },
  attachmentBarLabel: {
    fontSize: 12,
    color: colors.text,
    marginBottom: 4,
    fontWeight: "600",
  },
  attachmentBarContent: {
    fontSize: 13,
    color: colors.textMuted,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
});
