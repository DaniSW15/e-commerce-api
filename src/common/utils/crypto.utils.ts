import * as crypto from 'crypto';

/**
 * Utilidades criptográficas para tokens, hashing, etc.
 */

/**
 * Generar token aleatorio seguro (hex)
 */
export function generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Generar UUID v4
 */
export function generateUUID(): string {
    return crypto.randomUUID();
}

/**
 * Hash SHA-256 de un string
 */
export function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Hash MD5 (para casos no críticos como ETags)
 */
export function md5(data: string): string {
    return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Generar HMAC SHA-256
 */
export function hmacSha256(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Encriptar datos usando AES-256-GCM
 */
export function encrypt(
    text: string,
    secretKey: string,
): { encrypted: string; iv: string; tag: string } {
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
    };
}

/**
 * Desencriptar datos usando AES-256-GCM
 */
export function decrypt(
    encrypted: string,
    secretKey: string,
    iv: string,
    tag: string,
): string {
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(iv, 'hex'),
    );

    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Generar código numérico aleatorio (para 2FA, etc.)
 */
export function generateNumericCode(digits: number = 6): string {
    const max = Math.pow(10, digits) - 1;
    const min = Math.pow(10, digits - 1);
    const code = Math.floor(Math.random() * (max - min + 1)) + min;
    return code.toString().padStart(digits, '0');
}

/**
 * Generar slug seguro desde un string
 */
export function generateSlug(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remover caracteres especiales
        .replace(/[\s_-]+/g, '-') // Reemplazar espacios/guiones múltiples
        .replace(/^-+|-+$/g, ''); // Remover guiones al inicio/final
}

/**
 * Tiempo constante de comparación (previene timing attacks)
 */
export function secureCompare(a: string, b: string): boolean {
    return crypto.timingSafeEqual(
        Buffer.from(a, 'utf8'),
        Buffer.from(b, 'utf8'),
    );
}
