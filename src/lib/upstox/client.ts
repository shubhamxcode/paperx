import axios, { AxiosInstance } from "axios";
import type {
    UpstoxTokenResponse,
    UpstoxToken,
    MarketQuote,
    OHLCQuote,
    LTPQuote,
} from "./types";
import {
    getUpstoxToken,
    saveUpstoxToken,
} from "@/db/upstox";
import { serverEnv } from "@/lib/env/server";

/**
 * Thrown only when the Upstox token is missing, expired, or rejected by Upstox
 * (HTTP 401). Routes use `instanceof UpstoxAuthError` to decide whether to ask
 * the user to reconnect — any other failure (network, 5xx, bad request) is a
 * normal error and must NOT trigger the reconnect flow.
 */
export class UpstoxAuthError extends Error {
    constructor(message = "Upstox session expired. Please reconnect your account.") {
        super(message);
        this.name = "UpstoxAuthError";
    }
}

type UpstoxApiErrorPayload = {
    message?: string;
    errors?: Array<{ message?: string }>;
};

export type UpstoxInstrumentSearchItem = {
    name?: string;
    short_name?: string;
    segment: string;
    exchange: string;
    isin?: string;
    instrument_key: string;
    exchange_token?: string;
    trading_symbol: string;
    tick_size?: number;
    lot_size?: number;
    instrument_type?: string;
};

/**
 * Upstox access tokens always expire daily at 03:30 AM IST (= 22:00 UTC the
 * previous day), regardless of when they were generated. There is no refresh
 * token, so this is the true expiry to store.
 */
export function getUpstoxTokenExpiry(from: Date = new Date()): Date {
    const expiry = new Date(from);
    // 22:00 UTC == 03:30 IST
    expiry.setUTCHours(22, 0, 0, 0);
    if (expiry <= from) {
        expiry.setUTCDate(expiry.getUTCDate() + 1);
    }
    return expiry;
}

export class UpstoxClient {
    private apiKey: string;
    private apiSecret: string;
    private redirectUri: string;
    private baseUrl: string;
    private userId: string;
    private axiosInstance: AxiosInstance;

    constructor(userId: string) {
        this.apiKey = serverEnv.upstoxApiKey;
        this.apiSecret = serverEnv.upstoxApiSecret;
        this.redirectUri = serverEnv.upstoxRedirectUri;
        this.baseUrl = serverEnv.upstoxApiBaseUrl;
        this.userId = userId;

        this.axiosInstance = axios.create({
            baseURL: this.baseUrl,
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        });
    }

    /**
     * Get authorization URL for OAuth flow
     */
    getAuthorizationUrl(state?: string): string {
        const params = new URLSearchParams({
            response_type: "code",
            client_id: this.apiKey,
            redirect_uri: this.redirectUri,
        });

        if (state) {
            params.append("state", state);
        }

        return `${this.baseUrl}/v2/login/authorization/dialog?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    async getAccessToken(code: string): Promise<UpstoxToken> {
        try {
            const response = await axios.post<UpstoxTokenResponse>(
                `${this.baseUrl}/v2/login/authorization/token`,
                {
                    code,
                    client_id: this.apiKey,
                    client_secret: this.apiSecret,
                    redirect_uri: this.redirectUri,
                    grant_type: "authorization_code",
                },
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        Accept: "application/json",
                    }, 
                }
            );

            // Upstox tokens expire at 03:30 AM IST regardless of expires_in.
            const expiresAt = getUpstoxTokenExpiry();

            const token: UpstoxToken = {
                accessToken: response.data.access_token,
                expiresAt,
            };

            // Save token to database
            await saveUpstoxToken(this.userId, token);

            return token;
        } catch (error: unknown) {
            const payload = axios.isAxiosError<UpstoxApiErrorPayload>(error)
                ? error.response?.data
                : undefined;
            console.error(
                "Error getting access token:",
                payload?.message ?? (error instanceof Error ? error.message : "Unknown error")
            );
            throw new Error(
                payload?.message ||
                payload?.errors?.[0]?.message ||
                "Failed to exchange authorization code for token"
            );
        }
    }

    /**
     * Get the stored access token, or throw UpstoxAuthError if it's missing or
     * expired. Upstox does not issue refresh tokens — tokens reset daily at
     * 03:30 AM IST — so an expired token can only be fixed by reconnecting.
     */
    private async getValidAccessToken(): Promise<string> {
        const token = await getUpstoxToken(this.userId);

        if (!token) {
            throw new UpstoxAuthError("No Upstox token found. Please connect your account.");
        }

        if (new Date(token.expiresAt).getTime() <= Date.now()) {
            throw new UpstoxAuthError("Upstox session expired. Please reconnect your account.");
        }

        return token.accessToken;
    }

    /**
     * Make authenticated API request. A 401 from Upstox is normalised to an
     * UpstoxAuthError; all other failures bubble up unchanged.
     */
    private async makeAuthenticatedRequest<T>(
        method: "GET" | "POST" | "PUT" | "DELETE",
        endpoint: string,
        data?: unknown
    ): Promise<T> {
        const accessToken = await this.getValidAccessToken();
        try {
            const response = await this.axiosInstance.request<T>({
                method,
                url: endpoint,
                data,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            return response.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                throw new UpstoxAuthError();
            }
            throw error;
        }
    }

    /**
     * Get market quotes for instruments
     */
    async getMarketQuotes(instrumentKeys: string[]): Promise<{ data: { [key: string]: MarketQuote } }> {
        const params = new URLSearchParams({ instrument_key: instrumentKeys.join(",") });
        return this.makeAuthenticatedRequest<{ data: { [key: string]: MarketQuote } }>(
            "GET",
            `/v2/market-quote/quotes?${params.toString()}`
        );
    }
    /**
     * Get OHLC data for instruments
     */

    async getOHLC(instrumentKeys: string[]): Promise<{ data: { [key: string]: OHLCQuote } }> {
        const params = new URLSearchParams({ instrument_key: instrumentKeys.join(",") });

        return this.makeAuthenticatedRequest<{ data: { [key: string]: OHLCQuote } }>(
            "GET",
            `/v2/market-quote/ohlc?${params.toString()}`
        );
    }

    /**
     * Get LTP (Last Traded Price) for instruments
     */
    async getLTP(instrumentKeys: string[]): Promise<{ data: { [key: string]: LTPQuote } }> {
        const params = new URLSearchParams({ instrument_key: instrumentKeys.join(",") });

        return this.makeAuthenticatedRequest<{ data: { [key: string]: LTPQuote } }>(
            "GET",
            `/v3/market-quote/ltp?${params.toString()}`
        );
    }

    /** Search Upstox's current instrument universe (fresh BOD-backed data). */
    async searchInstruments(query: string): Promise<{ data: UpstoxInstrumentSearchItem[] }> {
        const params = new URLSearchParams({
            query,
            exchanges: "NSE,BSE",
            segments: "EQ,INDEX",
            page_number: "1",
            records: "30",
        });
        return this.makeAuthenticatedRequest<{ data: UpstoxInstrumentSearchItem[] }>(
            "GET",
            `/v2/instruments/search?${params.toString()}`
        );
    }

    async getHistoricalCandles(params: {
        instrumentKey: string;
        unit: "minutes" | "hours" | "days" | "weeks" | "months";
        interval: number;
        toDate: string;
        fromDate: string;
    }): Promise<{ data: { candles: Array<[string, number, number, number, number, number, number]> } }> {
        const key = encodeURIComponent(params.instrumentKey);
        return this.makeAuthenticatedRequest(
            "GET",
            `/v3/historical-candle/${key}/${params.unit}/${params.interval}/${params.toDate}/${params.fromDate}`
        );
    }

    async getIntradayCandles(params: {
        instrumentKey: string;
        unit: "minutes" | "hours" | "days";
        interval: number;
    }): Promise<{ data: { candles: Array<[string, number, number, number, number, number, number]> } }> {
        const key = encodeURIComponent(params.instrumentKey);
        return this.makeAuthenticatedRequest(
            "GET",
            `/v3/historical-candle/intraday/${key}/${params.unit}/${params.interval}`
        );
    }

    async getCompanyProfile(isin: string): Promise<{
        data: {
            company_profile: string;
            sector: string;
            sector_market_cap_inr?: { value: number; unit: string; formatted: string };
        };
    }> {
        return this.makeAuthenticatedRequest("GET", `/v2/fundamentals/${encodeURIComponent(isin)}/profile`);
    }

    async getKeyRatios(isin: string): Promise<{
        data: Array<{ name: string; company_value: string; sector_value: string }>;
    }> {
        return this.makeAuthenticatedRequest("GET", `/v2/fundamentals/${encodeURIComponent(isin)}/key-ratios`);
    }

    async getIncomeStatement(
        isin: string,
        timePeriod: "quarterly" | "yearly"
    ): Promise<{
        data: {
            type: string;
            time_period: string;
            units_in: string;
            income_statement: Array<{
                category: "revenue" | "operating_profit" | "net_profit";
                history: Array<{ value: number; period: string; change?: string }>;
            }>;
        };
    }> {
        const query = new URLSearchParams({
            type: "consolidated",
            time_period: timePeriod,
        });
        return this.makeAuthenticatedRequest(
            "GET",
            `/v2/fundamentals/${encodeURIComponent(isin)}/income-statement?${query.toString()}`
        );
    }

    /**
     * Cheaply verify the stored token actually works against Upstox.
     * Returns false only when Upstox rejects the token (401); rethrows other
     * (e.g. network) errors so callers don't falsely log the user out.
     */
    async validateToken(): Promise<boolean> {
        try {
            await this.getLTP(["NSE_INDEX|Nifty 50"]);
            return true;
        } catch (error) {
            // Only a genuine auth failure means "not valid". Network/5xx errors
            // rethrow so the caller doesn't wrongly mark the session expired.
            if (error instanceof UpstoxAuthError) return false;
            throw error;
        }
    }

    /**
     * Get WebSocket authorization for real-time data
     */
    async getWebSocketAuth(): Promise<{ data: { authorizedRedirectUri: string } }> {
        // Ask Upstox server-side for a signed feed URL containing a single-use
        // code. The raw access token is never exposed to the browser.
        const response = await this.makeAuthenticatedRequest<{
            data: { authorized_redirect_uri: string };
        }>("GET", "/v3/feed/market-data-feed/authorize");

        return {
            data: { authorizedRedirectUri: response.data.authorized_redirect_uri },
        };
    }
}
