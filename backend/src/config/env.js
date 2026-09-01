const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const LOCAL_MONGODB_URI = 'mongodb://127.0.0.1:27017/school-emart';

const resolveMongoUri = () => process.env.MONGODB_URI || process.env.MONGO_URI || null;

const parseDurationMs = (value, fallbackMs) => {
  if (!value) return fallbackMs;
  const match = /^(\d+)([smhd])$/.exec(String(value).trim());
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * multipliers[unit];
};

// Absent, empty or unrecognised all fall back to `fallback`. Only the listed
// spellings turn a flag off, so a typo can never silently disable a protection.
const parseBool = (value, fallback) => {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  return fallback;
};

const parseList = (value, fallback = []) => {
  if (!value) return fallback;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildEnv = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const mongoUri = resolveMongoUri() || (nodeEnv === 'production' ? null : LOCAL_MONGODB_URI);

  return {
  NODE_ENV: nodeEnv,
  PORT: Number(process.env.PORT) || 5000,
  MONGODB_URI: mongoUri,
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  API_VERSION: process.env.API_VERSION || 'v1',

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',
  JWT_ACCESS_EXPIRY_MS: parseDurationMs(process.env.JWT_ACCESS_EXPIRY || '15m', 15 * 60_000),
  JWT_REFRESH_EXPIRY_MS: parseDurationMs(process.env.JWT_REFRESH_EXPIRY || '7d', 7 * 86_400_000),
  JWT_ISSUER: process.env.JWT_ISSUER || 'school-emart',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'school-emart-api',

  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS) || 12,
  OTP_HMAC_SECRET: process.env.OTP_HMAC_SECRET || 'dev-otp-hmac-secret-change-me',

  COOKIE_SECURE:
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : (process.env.NODE_ENV || 'development') === 'production',
  COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE || 'strict',
  REFRESH_COOKIE_NAME: process.env.REFRESH_COOKIE_NAME || 'refreshToken',

  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,https://schoolemart.com',
  CORS_ORIGINS: parseList(process.env.CORS_ORIGIN, [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://schoolemart.com',
  ]),

  MAX_LOGIN_ATTEMPTS: Number(process.env.MAX_LOGIN_ATTEMPTS) || 5,
  LOGIN_LOCKOUT_MINUTES: Number(process.env.LOGIN_LOCKOUT_MINUTES) || 15,

  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60_000,
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 100,
  AUTH_RATE_LIMIT_MAX: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,

  OTP_EXPIRY_MS: parseDurationMs(process.env.OTP_EXPIRY || '10m', 10 * 60_000),
  OTP_RESEND_COOLDOWN_MS: Number(process.env.OTP_RESEND_COOLDOWN_MS) || 60_000,

  // Per PHONE NUMBER. This is the meaningful control: it caps how many SMS a
  // single number can be made to receive, so it bounds both SMS spend and using
  // the endpoint to harass someone.
  OTP_MAX_PER_WINDOW: Number(process.env.OTP_MAX_PER_WINDOW) || 8,

  // Per IP, and deliberately much higher. This used to share OTP_MAX_PER_WINDOW,
  // which meant one budget of 5 covered an entire IP: every parent at a school
  // behind one NAT competed for it, and the sixth in 15 minutes was refused even
  // though each had asked only once. It is a crude flood net, not the real limit
  // — the per-phone cap above is what protects an individual number.
  OTP_IP_MAX_PER_WINDOW: Number(process.env.OTP_IP_MAX_PER_WINDOW) || 60,

  OTP_WINDOW_MS: Number(process.env.OTP_WINDOW_MS) || 15 * 60_000,

  /**
   * OTP_ENABLED=false turns off real one-time passcodes: no SMS is sent, every OTP
   * becomes OTP_BYPASS_CODE, and the API hands that code back so the client can fill
   * the field in for the user.
   *
   * Understand what this is before switching it off. It is not "relaxed" login — it
   * is *no* login check at all: anyone who knows a registered phone number can sign
   * in as that person and read their child's records. It exists for demos and for
   * local work where no SMS gateway is wired up. It must never be false on a
   * deployment holding real families' data.
   *
   * Defaults to true, and an unrecognised value also resolves to true, so a missing
   * or fat-fingered variable can only ever leave real OTPs switched on.
   */
  OTP_ENABLED: parseBool(process.env.OTP_ENABLED, true),
  OTP_BYPASS_CODE: String(process.env.OTP_BYPASS_CODE || '123456').replace(/\D/g, '') || '123456',

  SMS_PROVIDER: process.env.SMS_PROVIDER || 'smsindiahub',
  SMS_TIMEOUT_MS: Number(process.env.SMS_TIMEOUT_MS) || 15_000,
  SMS_ENTITY_NAME: process.env.SMS_ENTITY_NAME || 'School E-Mart',
  // Must stay byte-identical to the DLT-registered template (id 1007282516644508833)
  // — operators drop messages whose text does not match, so the missing space
  // after "Appzeto." and the trailing ".BGADEC" are intentional, not typos.
  SMS_OTP_TEMPLATE:
    process.env.SMS_OTP_TEMPLATE ||
    'Welcome to the ##var## powered by Appzeto.Your OTP for registration is ##var##.BGADEC',

  SMSINDIAHUB_BASE_URL: process.env.SMSINDIAHUB_BASE_URL || 'http://cloud.smsindiahub.in',
  SMSINDIAHUB_API_KEY: process.env.SMSINDIAHUB_API_KEY || '',
  SMSINDIAHUB_SENDER_ID: process.env.SMSINDIAHUB_SENDER_ID || '',
  SMSINDIAHUB_COUNTRY_CODE: process.env.SMSINDIAHUB_COUNTRY_CODE || '91',
  // gwid 2 is the transactional route; OTPs must never go via the promo route
  SMSINDIAHUB_GATEWAY_ID: Number(process.env.SMSINDIAHUB_GATEWAY_ID) || 2,
  SMSINDIAHUB_PE_ID: process.env.SMSINDIAHUB_PE_ID || '',
  SMSINDIAHUB_TEMPLATE_ID: process.env.SMSINDIAHUB_TEMPLATE_ID || '',

  PASSWORD_RESET_EXPIRY_MS: parseDurationMs(process.env.PASSWORD_RESET_EXPIRY || '24h', 24 * 3_600_000),
  EMAIL_VERIFICATION_EXPIRY: process.env.EMAIL_VERIFICATION_EXPIRY || '24h',

  FRONTEND_URL: process.env.FRONTEND_URL || 'https://schoolemart.com',

  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || null,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || null,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || null,

  LOG_LEVEL: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  LOG_DIR: process.env.LOG_DIR || 'logs',
  REQUEST_ID_HEADER: process.env.REQUEST_ID_HEADER || 'x-request-id',

  SHUTDOWN_TIMEOUT_MS: Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10_000,

  REDIS_URL: process.env.REDIS_URL || null,
  REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX || 'school-emart:',
  REDIS_CONNECT_TIMEOUT_MS: Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 10_000,
  REDIS_STARTUP_MAX_ATTEMPTS: Number(process.env.REDIS_STARTUP_MAX_ATTEMPTS) || 5,
  REDIS_STARTUP_RETRY_DELAY_MS: Number(process.env.REDIS_STARTUP_RETRY_DELAY_MS) || 2000,

  DELIVERY_PROVIDER: process.env.DELIVERY_PROVIDER || 'shiprocket',
  SHIPROCKET_EMAIL: process.env.SHIPROCKET_EMAIL || '',
  SHIPROCKET_PASSWORD: process.env.SHIPROCKET_PASSWORD || '',
  SHIPROCKET_WEBHOOK_SECRET: process.env.SHIPROCKET_WEBHOOK_SECRET || '',
  SHIPROCKET_BASE_URL: process.env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in/v1/external',
  SHIPROCKET_RPM_LIMIT: Number(process.env.SHIPROCKET_RPM_LIMIT) || 500,
  SHIPROCKET_TOKEN_REFRESH_MS: Number(process.env.SHIPROCKET_TOKEN_REFRESH_MS) || 23 * 60 * 60 * 1000,

  OUTBOX_WORKER_ENABLED: process.env.OUTBOX_WORKER_ENABLED === 'true',
  OUTBOX_POLL_INTERVAL_MS: Number(process.env.OUTBOX_POLL_INTERVAL_MS) || 5000,
  OUTBOX_BATCH_SIZE: Number(process.env.OUTBOX_BATCH_SIZE) || 20,

  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'School E-Mart <noreply@schoolemart.com>',

  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || null,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || null,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : null,

  // Where uploaded bytes live on disk. Both default to a directory inside the repo, which
  // is fine when the server is updated in place. Point them at a path OUTSIDE the repo
  // (e.g. /var/lib/school-emart/...) if a deploy ever clones into a fresh directory,
  // otherwise the previous checkout's uploads are left behind.
  UPLOADS_DIR: process.env.UPLOADS_DIR || null,
  PRIVATE_UPLOADS_DIR: process.env.PRIVATE_UPLOADS_DIR || null,
  };
};

const validateEnv = (config) => {
  const requiredInProduction = ['JWT_ACCESS_SECRET', 'OTP_HMAC_SECRET'];

  if (config.NODE_ENV === 'production') {
    if (!resolveMongoUri()) {
      throw new Error('Missing required environment variable: MONGODB_URI or MONGO_URI');
    }

    if (!config.MONGODB_URI) {
      throw new Error('MongoDB URI must be configured in production');
    }

    requiredInProduction.forEach((key) => {
      if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
      }
    });

    const secretKeys = ['JWT_ACCESS_SECRET', 'OTP_HMAC_SECRET'];
    const minSecretLength = 32;

    secretKeys.forEach((key) => {
      if (config[key].startsWith('dev-')) {
        throw new Error(`${key} must not use development defaults in production`);
      }
      if (config[key].length < minSecretLength) {
        throw new Error(`${key} must be at least ${minSecretLength} characters in production`);
      }
    });

    if (config.OTP_ENABLED && (!config.SMSINDIAHUB_API_KEY || !config.SMSINDIAHUB_SENDER_ID)) {
      throw new Error(
        'SMSINDIAHUB_API_KEY and SMSINDIAHUB_SENDER_ID are required in production: without them no OTP can be delivered'
      );
    }
  }

  // Deliberately a warning, not a throw: a production demo build is a real use for
  // this. But it turns phone login into no check at all, so it must be impossible to
  // leave on by accident without it being obvious in the logs at every boot.
  if (!config.OTP_ENABLED) {
    const banner = '='.repeat(72);
    // eslint-disable-next-line no-console
    console.warn(
      `\n${banner}\n` +
        `  OTP VERIFICATION IS DISABLED (OTP_ENABLED=false)\n` +
        `  No SMS is sent. Every OTP is "${config.OTP_BYPASS_CODE}" and the API returns it\n` +
        `  to the client, which fills it in automatically.\n` +
        `  ANYONE WHO KNOWS A REGISTERED PHONE NUMBER CAN SIGN IN AS THAT PERSON.\n` +
        `  Set OTP_ENABLED=true before this serves real users.\n` +
        `${banner}\n`
    );
  }
};

const env = Object.freeze(buildEnv());
validateEnv(env);

module.exports = env;
