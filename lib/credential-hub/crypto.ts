import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm" as const;
const IV_BYTES = 12;
const DEFAULT_AAD = "credential-hub:v1";

export interface EncryptedSecret {
  algorithm: "aes-256-gcm";
  keyVersion: 1;
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function parseMasterKey(raw: string | undefined): Buffer {
  const value = raw?.trim();
  if (!value) throw new Error("CREDENTIAL_MASTER_KEY 未配置");

  const key = /^[a-f\d]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new Error("CREDENTIAL_MASTER_KEY 必须是 32 字节的 base64 或 64 位 hex");
  }
  return key;
}

export function encryptSecret(
  plaintext: string,
  key: Buffer,
  aad = DEFAULT_AAD,
): EncryptedSecret {
  if (!plaintext) throw new Error("凭证内容不能为空");
  if (key.length !== 32) throw new Error("保险柜总钥匙长度无效");

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    algorithm: ALGORITHM,
    keyVersion: 1,
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(
  encrypted: EncryptedSecret,
  key: Buffer,
  aad = DEFAULT_AAD,
): string {
  if (key.length !== 32) throw new Error("保险柜总钥匙长度无效");
  if (encrypted.algorithm !== ALGORITHM || encrypted.keyVersion !== 1) {
    throw new Error("不支持的凭证密文版本");
  }

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(encrypted.iv, "base64"),
    );
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("凭证解密失败");
  }
}
