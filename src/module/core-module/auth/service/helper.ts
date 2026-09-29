import { hash, verify } from 'argon2';
export function hashTextByArgon2(password: string): Promise<string> {
    return hash(password);
}

export function verifyTextByArgon2(hash: string, text: string) {
    return verify(hash, text);
}

export function generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}