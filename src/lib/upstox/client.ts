import axios, { AxiosInstance } from "axios";
import type {
    MarketQuote,
    OHLCQuote,
    LTPQuote,
} from "./types";
import { serverEnv } from "@/lib/env/server";

export class MarketDataUnavailableError extends Error {
    constructor(
        message = "Live market data is temporarily unavailable.",
        readonly providerStatus?: number
    ) {
        super(message);
        this.name = "MarketDataUnavailableError";
    }
}

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

export class UpstoxClient {
    private baseUrl: string;
    private axiosInstance: AxiosInstance;

    constructor() {
        this.baseUrl = serverEnv.upstoxApiBaseUrl;

        this.axiosInstance = axios.create({
            baseURL: this.baseUrl,
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        });
    }

    private async makeAuthenticatedRequest<T>(
        method: "GET" | "POST" | "PUT" | "DELETE",
        endpoint: string,
        data?: unknown
    ): Promise<T> {
        try {
            const response = await this.axiosInstance.request<T>({
                method,
                url: endpoint,
                data,
                headers: {
                    Authorization: `Bearer ${serverEnv.upstoxAnalyticsToken}`,
                },
            });
            return response.data;
        } catch (error: unknown) {
            const status = axios.isAxiosError(error) ? error.response?.status : undefined;
            if (status === 401 || status === 403) {
                throw new MarketDataUnavailableError(
                    "PaperX market-data credentials need administrator attention.",
                    status
                );
            }
            if (status === 429) {
                throw new MarketDataUnavailableError(
                    "Market data is busy. Please try again shortly.",
                    status
                );
            }
            throw new MarketDataUnavailableError(
                "Live market data is temporarily unavailable.",
                status
            );
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

    /** Current exchange session status, including holidays and special sessions. */
    async getMarketStatus(exchange: "NSE" | "BSE"): Promise<{
        data: { exchange: string; status: string; last_updated: number };
    }> {
        return this.makeAuthenticatedRequest<{
            data: { exchange: string; status: string; last_updated: number };
        }>("GET", `/v2/market/status/${exchange}`);
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

}
