import AsyncStorage from "@react-native-async-storage/async-storage";
import nacl from "tweetnacl";
import * as naclUtil from "tweetnacl-util";

const keypairStorageKey = (userId) => `CHAT_E2EE_KEYPAIR_${String(userId || "").trim()}`;

export const ensureE2EEKeypair = async (userId) => {
  const id = String(userId || "").trim();
  if (!id) throw new Error("Missing userId");

  const storageKey = keypairStorageKey(id);
  const existing = await AsyncStorage.getItem(storageKey);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (parsed?.publicKey && parsed?.secretKey) {
        return {
          publicKey: String(parsed.publicKey),
          secretKey: String(parsed.secretKey),
        };
      }
    } catch {
      // fall through
    }
  }

  const kp = nacl.box.keyPair();
  const value = {
    publicKey: naclUtil.encodeBase64(kp.publicKey),
    secretKey: naclUtil.encodeBase64(kp.secretKey),
  };
  await AsyncStorage.setItem(storageKey, JSON.stringify(value));
  return value;
};

const sharedKey = (mySecretKeyB64, otherPublicKeyB64) => {
  const mySecretKey = naclUtil.decodeBase64(String(mySecretKeyB64 || ""));
  const otherPublicKey = naclUtil.decodeBase64(String(otherPublicKeyB64 || ""));
  return nacl.box.before(otherPublicKey, mySecretKey);
};

export const encryptE2EE = (mySecretKeyB64, otherPublicKeyB64, plaintext) => {
  const msg = String(plaintext ?? "");
  const key = sharedKey(mySecretKeyB64, otherPublicKeyB64);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ciphertext = nacl.box.after(naclUtil.decodeUTF8(msg), nonce, key);

  return {
    v: 1,
    alg: "x25519-xsalsa20-poly1305",
    nonce: naclUtil.encodeBase64(nonce),
    ciphertext: naclUtil.encodeBase64(ciphertext),
  };
};

export const decryptE2EE = (mySecretKeyB64, otherPublicKeyB64, e2ee) => {
  try {
    if (!e2ee) return "";
    const nonce = naclUtil.decodeBase64(String(e2ee.nonce || ""));
    const ciphertext = naclUtil.decodeBase64(String(e2ee.ciphertext || ""));
    if (!nonce?.length || !ciphertext?.length) return "";

    const key = sharedKey(mySecretKeyB64, otherPublicKeyB64);
    const plainBytes = nacl.box.open.after(ciphertext, nonce, key);
    if (!plainBytes) return "";
    return naclUtil.encodeUTF8(plainBytes);
  } catch {
    return "";
  }
};
