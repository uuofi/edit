import AsyncStorage from "@react-native-async-storage/async-storage";
import nacl from "tweetnacl";
import * as naclUtil from "tweetnacl-util";

export const E2EE_ALG = "x25519-xsalsa20-poly1305";
export const E2EE_VERSION = 1;

const keypairStorageKey = (userId) => `CHAT_E2EE_KEYPAIR_${String(userId || "").trim()}`;

const decodeBase64Safe = (value) => {
  try {
    return naclUtil.decodeBase64(String(value || ""));
  } catch {
    return null;
  }
};

export const ensureE2EEKeypair = async (userId) => {
  const id = String(userId || "").trim();
  if (!id) throw new Error("Missing userId");

  const storageKey = keypairStorageKey(id);
  const existing = await AsyncStorage.getItem(storageKey);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      const pub = decodeBase64Safe(parsed?.publicKey);
      const sec = decodeBase64Safe(parsed?.secretKey);

      if (pub?.length === nacl.box.publicKeyLength && sec?.length === nacl.box.secretKeyLength) {
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
  const mySecretKey = decodeBase64Safe(mySecretKeyB64);
  const otherPublicKey = decodeBase64Safe(otherPublicKeyB64);

  if (!mySecretKey || mySecretKey.length !== nacl.box.secretKeyLength) {
    throw new Error("Invalid my secret key for E2EE");
  }

  if (!otherPublicKey || otherPublicKey.length !== nacl.box.publicKeyLength) {
    throw new Error("Invalid peer public key for E2EE");
  }

  return nacl.box.before(otherPublicKey, mySecretKey);
};

export const encryptE2EE = (mySecretKeyB64, otherPublicKeyB64, plaintext) => {
  const msg = String(plaintext ?? "");
  const key = sharedKey(mySecretKeyB64, otherPublicKeyB64);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ciphertext = nacl.box.after(naclUtil.decodeUTF8(msg), nonce, key);

  return {
    v: E2EE_VERSION,
    alg: E2EE_ALG,
    nonce: naclUtil.encodeBase64(nonce),
    ciphertext: naclUtil.encodeBase64(ciphertext),
  };
};

export const decryptE2EE = (mySecretKeyB64, otherPublicKeyB64, e2ee) => {
  try {
    if (!e2ee) return "";

    const messageVersion = Number(e2ee?.v ?? e2ee?.e2eeVersion ?? E2EE_VERSION);
    const messageAlg = String(e2ee?.alg ?? e2ee?.e2eeAlg ?? E2EE_ALG).trim();

    if (messageVersion !== E2EE_VERSION) return "";
    if (messageAlg !== E2EE_ALG) return "";

    const nonce = decodeBase64Safe(e2ee.nonce);
    const ciphertext = decodeBase64Safe(e2ee.ciphertext);
    if (!nonce?.length || !ciphertext?.length) return "";
    if (nonce.length !== nacl.box.nonceLength) return "";

    const key = sharedKey(mySecretKeyB64, otherPublicKeyB64);
    const plainBytes = nacl.box.open.after(ciphertext, nonce, key);
    if (!plainBytes) return "";
    return naclUtil.encodeUTF8(plainBytes);
  } catch {
    return "";
  }
};
