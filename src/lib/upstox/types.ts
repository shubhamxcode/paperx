// Upstox API Types

export interface UpstoxTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
}

export interface UpstoxToken {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
}

export interface MarketQuote {
    instrument_key: string;
    instrument_token?: string; // Added to handle Upstox response format
    last_price: number;
    volume: number;
    average_price: number;
    oi: number;
    net_change: number;
    total_buy_quantity: number;
    total_sell_quantity: number;
    lower_circuit_limit: number;
    upper_circuit_limit: number;
    last_traded_time: string;
    oi_day_high: number;
    oi_day_low: number;
}

export interface OHLCQuote {
    instrument_key: string;
    ohlc: {
        open: number;
        high: number;
        low: number;
        close: number;
    };
}

export interface LTPQuote {
    instrument_key: string;
    last_price: number;
}

export interface WebSocketFeed {
    type: 'ltpc' | 'full';
    feeds: {
        [key: string]: {
            ff?: {
                marketFF?: {
                    ltpc?: {
                        ltp?: number;
                        ltt?: string;
                        ltq?: number;
                        cp?: number;
                    };
                };
            };
        };
    };
}

export interface UpstoxError {
    status: string;
    errors: Array<{
        errorCode: string;
        message: string;
        propertyPath: string | null;
        invalidValue: string | null;
    }>;
}
