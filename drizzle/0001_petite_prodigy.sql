ALTER TABLE "account" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "portfolio" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trade" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verificationToken" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "account" CASCADE;--> statement-breakpoint
DROP TABLE "portfolio" CASCADE;--> statement-breakpoint
DROP TABLE "session" CASCADE;--> statement-breakpoint
DROP TABLE "trade" CASCADE;--> statement-breakpoint
DROP TABLE "verificationToken" CASCADE;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "emailVerified";