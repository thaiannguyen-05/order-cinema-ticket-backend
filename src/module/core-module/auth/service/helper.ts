import { randomInt } from 'crypto';
import { hash, verify } from 'argon2';
export function hashTextByArgon2(password: string): Promise<string> {
  return hash(password);
}

export function verifyTextByArgon2(hash: string, text: string) {
  return verify(hash, text);
}

export function generateCode(): string {
  // crypto.randomInt: CSPRNG, avoids Math.random predictability for OTP.
  return randomInt(100000, 1000000).toString();
}
