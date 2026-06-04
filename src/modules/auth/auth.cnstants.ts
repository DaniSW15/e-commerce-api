export const AUTH_CONSTANTS = {
    // JWT
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d',

    // Rate limiting
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_MINUTES: 30,

    // 2FA
    TOTP_ISSUER: 'ECommerceApp',
    TOTP_PERIOD: 30,
    TOTP_DIGITS: 6,

    // Password reset
    RESET_TOKEN_EXPIRY_HOURS: 24,

    // Security
    BCRYPT_ROUNDS: 12,

    // Messages
    MESSAGES: {
        LOGIN_SUCCESS: 'Login successful',
        LOGOUT_SUCCESS: 'Logout successful',
        TOKEN_REFRESHED: 'Token refreshed successfully',
        INVALID_CREDENTIALS: 'Invalid email or password',
        ACCOUNT_LOCKED: 'Account temporarily locked. Try again later',
        TWO_FACTOR_REQUIRED: '2FA verification required',
        TWO_FACTOR_ENABLED: '2FA enabled successfully',
        TWO_FACTOR_DISABLED: '2FA disabled successfully',
        PASSWORD_RESET_SENT: 'Password reset email sent',
        PASSWORD_RESET_SUCCESS: 'Password reset successful',
    },
} as const;
