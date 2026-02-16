
import * as fs from "fs";
import * as path from "path";
import { eq } from "drizzle-orm"; // drizzle-orm is fine to import statically as it doesn't connect on import

// Manually load .env FIRST
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf8");
    envConfig.split("\n").forEach((line) => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, ""); // Remove quotes
            process.env[key] = value;
        }
    });
} else {
    console.error(".env file not found at", envPath);
}

async function checkToken() {
    console.log("Imports loading...");
    // Dynamic imports to ensure env is loaded before DB connection
    const { db } = await import("./src/db");
    const { upstoxTokens, users } = await import("./src/db/schema");
    const { UpstoxClient } = await import("./src/lib/upstox/client");

    console.log("Checking Upstox Token...");

    const userList = await db.select().from(users).limit(1);
    if (userList.length === 0) {
        console.log("No users found.");
        return;
    }
    const userId = userList[0].id;
    console.log(`Checking token for user: ${userId}`);

    const tokens = await db.select().from(upstoxTokens).where(eq(upstoxTokens.userId, userId));

    if (tokens.length === 0) {
        console.log("No Upstox token found in DB.");
        return;
    }

    const token = tokens[0];
    console.log("Token found:");
    console.log(`- Expires At: ${token.expireAt}`);
    console.log(`- Created At: ${token.createdAt}`);
    console.log(`- Updated At: ${token.updatedAt}`);
    console.log(`- Current Time: ${new Date()}`);

    const isExpired = new Date() >= token.expireAt;
    console.log(`- Is Expired? ${isExpired}`);

    console.log("\nAttempting to fetch Market Quotes using UpstoxClient...");
    const client = new UpstoxClient(userId);

    try {
        const instrumentKeys = ["NSE_EQ|INE002A01018", "NSE_EQ|INE467B01029"];
        const quotes = await client.getMarketQuotes(instrumentKeys);
        console.log("Market Quotes Response:");
        console.log(JSON.stringify(quotes, null, 2));
    } catch (error: any) {
        console.error("Error fetching quotes:", error.message);
        if (error.response) {
            console.error("API Error Response:", JSON.stringify(error.response.data || {}, null, 2));
        }
    }

    process.exit(0);
}

checkToken();
