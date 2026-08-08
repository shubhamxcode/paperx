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

function optionalWebOrigin(name: string, fallback: string): string {
  const value = process.env[name]?.trim() || fallback;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.pathname !== "/") throw new Error();
    return url.origin;
  } catch {
    throw new Error(`${name} must be a valid HTTPS origin without a path`);
  }
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
  get upstoxAnalyticsToken() {
    return required("UPSTOX_ANALYTICS_TOKEN");
  },
  get upstoxApiBaseUrl() {
    return webOrigin("UPSTOX_API_BASE_URL");
  },
  get brandfetchClientId() {
    const clientId = required("BRANDFETCH_CLIENT_ID");
    if (!/^[A-Za-z0-9_-]{6,128}$/.test(clientId)) {
      throw new Error("BRANDFETCH_CLIENT_ID has an invalid format");
    }
    return clientId;
  },
  get brandfetchLogoBaseUrl() {
    return optionalWebOrigin("BRANDFETCH_LOGO_BASE_URL", "https://cdn.brandfetch.io");
  },
  get geminiApiKey() {
    return required("GOOGLE_GENERATIVE_AI_API_KEY");
  },
  get geminiModel() {
    return process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  },
  get secureCookies() {
    return new URL(this.nextAuthUrl).protocol === "https:";
  },
} as const;
