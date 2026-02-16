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
    isTokenExpired,
} from "@/db/upstox";

export class UpstoxClient {
    private apiKey: string;
    private apiSecret: string;
    private redirectUri: string;
    private baseUrl = "https://api.upstox.com";
    private userId: string;
    private axiosInstance: AxiosInstance;

    constructor(userId: string) {
        this.apiKey = process.env.UPSTOX_API_KEY!;
        this.apiSecret = process.env.UPSTOX_API_SECRET!;
        this.redirectUri = process.env.UPSTOX_REDIRECT_URI!;
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

            console.log("Upstox token response:", JSON.stringify(response.data, null, 2));

            // Calculate expiry time (default to 24 hours if not provided)
            const expiresInSeconds = response.data.expires_in || 86400; // 24 hours default
            const expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + expiresInSeconds);

            const token: UpstoxToken = {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token || "",
                expiresAt,
            };

            // Save token to database
            await saveUpstoxToken(this.userId, token);

            return token;
        } catch (error: any) {
            console.error("Error getting access token:", error.response?.data || error.message);
            throw new Error(
                error.response?.data?.message ||
                error.response?.data?.errors?.[0]?.message ||
                "Failed to exchange authorization code for token"
            );
        }
    }

    /**
     * Refresh access token using refresh token
     */
    private async refreshAccessToken(refreshToken: string): Promise<UpstoxToken> {
        try {
            const response = await axios.post<UpstoxTokenResponse>(
                `${this.baseUrl}/v2/login/authorization/token`,
                {
                    refresh_token: refreshToken,
                    client_id: this.apiKey,
                    client_secret: this.apiSecret,
                    grant_type: "refresh_token",
                },
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        Accept: "application/json",
                    },
                }
            );

            console.log("Token refreshed successfully");

            // Calculate expiry time (default to 24 hours if not provided)
            const expiresInSeconds = response.data.expires_in || 86400;
            const expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + expiresInSeconds);

            const newToken: UpstoxToken = {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token || refreshToken, // Keep old refresh token if new one not provided
                expiresAt,
            };

            // Save refreshed token to database
            await saveUpstoxToken(this.userId, newToken);

            return newToken;
        } catch (error: any) {
            console.error("Error refreshing token:", error.response?.data || error.message);
            throw new Error(
                error.response?.data?.message ||
                error.response?.data?.errors?.[0]?.message ||
                "Failed to refresh access token. Please reconnect your Upstox account."
            );
        }
    }

    /**
     * Get valid access token (refreshes if expired or about to expire)
     */
    private async getValidAccessToken(): Promise<string> {
        const token = await getUpstoxToken(this.userId);

        if (!token) {
            throw new Error("No Upstox token found. Please connect your account.");
        }

        // Check if token is expired or will expire in the next 5 minutes
        const now = new Date();
        const expiryTime = new Date(token.expiresAt);
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

        const needsRefresh = expiryTime <= fiveMinutesFromNow;

        if (needsRefresh) {
            console.log("Access token expired or expiring soon, attempting to refresh...");

            // Check if refresh token exists
            if (!token.refreshToken) {
                throw new Error("No refresh token available. Please reconnect your Upstox account.");
            }

            try {
                // Attempt to refresh the token
                const newToken = await this.refreshAccessToken(token.refreshToken);
                return newToken.accessToken;
            } catch (error) {
                // If refresh fails, user needs to reconnect
                throw error;
            }
        }

        return token.accessToken;
    }

    /**
     * Make authenticated API request
     */
    private async makeAuthenticatedRequest<T>(
        method: "GET" | "POST" | "PUT" | "DELETE",
        endpoint: string,
        data?: any
    ): Promise<T> {
        const accessToken = await this.getValidAccessToken();

        const response = await this.axiosInstance.request<T>({
            method,
            url: endpoint,
            data,
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        return response.data;
    }

    /**
     * Get market quotes for instruments
     */
    async getMarketQuotes(instrumentKeys: string[]): Promise<{ data: { [key: string]: MarketQuote } }> {
        const params = new URLSearchParams();
        instrumentKeys.forEach((key) => params.append("instrument_key", key));

        return this.makeAuthenticatedRequest<{ data: { [key: string]: MarketQuote } }>(
            "GET",
            `/v2/market-quote/quotes?${params.toString()}`
        );
    }

    /**
     * Get OHLC data for instruments
     */
    async getOHLC(instrumentKeys: string[]): Promise<{ data: { [key: string]: OHLCQuote } }> {
        const params = new URLSearchParams();
        instrumentKeys.forEach((key) => params.append("instrument_key", key));

        return this.makeAuthenticatedRequest<{ data: { [key: string]: OHLCQuote } }>(
            "GET",
            `/v2/market-quote/ohlc?${params.toString()}`
        );
    }

    /**
     * Get LTP (Last Traded Price) for instruments
     */
    async getLTP(instrumentKeys: string[]): Promise<{ data: { [key: string]: LTPQuote } }> {
        const params = new URLSearchParams();
        instrumentKeys.forEach((key) => params.append("instrument_key", key));

        return this.makeAuthenticatedRequest<{ data: { [key: string]: LTPQuote } }>(
            "GET",
            `/v2/market-quote/ltp?${params.toString()}`
        );
    }

    /**
     * Get WebSocket authorization for real-time data
     */
    async getWebSocketAuth(): Promise<{ data: { authorizedRedirectUri: string } }> {
        const accessToken = await this.getValidAccessToken();

        return {
            data: {
                authorizedRedirectUri: `wss://api.upstox.com/v2/feed/market-data-feed/authorize?token=${accessToken}`,
            },
        };
    }
}
