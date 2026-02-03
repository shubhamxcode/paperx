CREATE TABLE "authenticator" (
	"credentialID" text NOT NULL,
	"userId" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"credentialPublicKey" text NOT NULL,
	"counter" integer NOT NULL,
	"credentialDeviceType" text NOT NULL,
	"credentialBackedUp" boolean NOT NULL,
	"transports" text,
	CONSTRAINT "authenticator_userId_credentialID_pk" PRIMARY KEY("userId","credentialID"),
	CONSTRAINT "authenticator_credentialID_unique" UNIQUE("credentialID")
);
--> statement-breakpoint
CREATE TABLE "holding" (
	"id" text PRIMARY KEY NOT NULL,
	"portfolioId" text NOT NULL,
	"symbol" text NOT NULL,
	"quantity" integer NOT NULL,
	"averageCost" numeric(15, 2) NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text DEFAULT 'Main Portfolio' NOT NULL,
	"balance" numeric(15, 2) DEFAULT '100000.00' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade" (
	"id" text PRIMARY KEY NOT NULL,
	"portfolioId" text NOT NULL,
	"symbol" text NOT NULL,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"price" numeric(15, 2) NOT NULL,
	"executedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"displayName" text,
	"bio" text,
	"phone" text,
	"avatarUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification_token" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "users" CASCADE;--> statement-breakpoint
DROP TABLE "verification_token" CASCADE;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId");--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "userId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "account" ADD COLUMN "providerAccountId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "sessionToken" text PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "userId" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "emailVerified" timestamp;--> statement-breakpoint
ALTER TABLE "authenticator" ADD CONSTRAINT "authenticator_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding" ADD CONSTRAINT "holding_portfolioId_portfolio_id_fk" FOREIGN KEY ("portfolioId") REFERENCES "public"."portfolio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio" ADD CONSTRAINT "portfolio_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_portfolioId_portfolio_id_fk" FOREIGN KEY ("portfolioId") REFERENCES "public"."portfolio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "provider_account_id";--> statement-breakpoint
ALTER TABLE "session" DROP COLUMN "session_token";--> statement-breakpoint
ALTER TABLE "session" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "email_verified";