import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

function secret(name: 'PII_ENCRYPTION_KEY' | 'PII_LOOKUP_HMAC_KEY') {
  const value = process.env[name];
  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} must be set to 32 bytes of hexadecimal key material`);
  return Buffer.from(value, 'hex');
}

export function encryptPii(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secret('PII_ENCRYPTION_KEY'), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptPii(encoded: string) {
  const [ivPart, tagPart, ciphertextPart] = encoded.split('.');
  if (!ivPart || !tagPart || !ciphertextPart) throw new Error('Invalid encrypted field format');
  const decipher = createDecipheriv('aes-256-gcm', secret('PII_ENCRYPTION_KEY'), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextPart, 'base64url')), decipher.final()]).toString('utf8');
}

export function hashCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, '');
  if (!/^\d{11}$/.test(digits)) throw new Error('CPF must contain 11 digits');
  return createHmac('sha256', secret('PII_LOOKUP_HMAC_KEY')).update(digits).digest('hex');
}

export function maskCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, '');
  if (!/^\d{11}$/.test(digits)) return '***.***.***-**';
  return `***.***.***-${digits.slice(-2)}`;
}

export function maskName(name: string) {
  return name.trim().split(/\s+/).map((part, index) => index === 0 ? part : `${part[0] ?? ''}***`).join(' ');
}

export function constantTimeEqual(left: string, right: string) {
  const leftHash = createHmac('sha256', Buffer.alloc(32)).update(left).digest();
  const rightHash = createHmac('sha256', Buffer.alloc(32)).update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}