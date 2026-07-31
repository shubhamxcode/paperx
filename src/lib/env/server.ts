import "server-only";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requiredUrl(name: string): string {
  const value = required(name);

  try {
    new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }

  return value.replace(/\/$/, "");
}

function databaseUrl(): string {
  const value = requiredUrl("DATABASE_URL");
  if (!["postgresql:", "postgres:"].includes(new URL(value).protocol)) {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol");
  }
  return value;
}

function webUrl(name: string): string {
  const value = requiredUrl(name);
  if (!["http:", "https:"].includes(new URL(value).protocol)) {
    throw new Error(`${name} must use HTTP or HTTPS`);
  }
  return value;
}

function webOrigin(name: string): string {
  const value = webUrl(name);
  const url = new URL(value);

  if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/") {
    throw new Error(`${name} must be an HTTP(S) origin without a path`);
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS in production`);
  }

  return url.origin;
}

export const serverEnv = {
  get databaseUrl() {
    return databaseUrl();
  },
  get googleClientId() {
    return required("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret() {
    return required("GOOGLE_CLIENT_SECRET");
  },
  get nextAuthUrl() {
    return webOrigin("NEXTAUTH_URL");
  },
  get nextAuthSecret() {
    const secret = required("NEXTAUTH_SECRET");
    if (secret.length < 32) {
      throw new Error("NEXTAUTH_SECRET must be at least 32 characters");
    }
    return secret;
  },
  get upstoxApiKey() {
    return required("UPSTOX_API_KEY");
  },
  get upstoxApiSecret() {
    return required("UPSTOX_API_SECRET");
  },
  get upstoxRedirectUri() {
    return webUrl("UPSTOX_REDIRECT_URI");
  },
  get upstoxApiBaseUrl() {
    return webOrigin("UPSTOX_API_BASE_URL");
  },
  get secureCookies() {
    return new URL(this.nextAuthUrl).protocol === "https:";
  },
} as const;
