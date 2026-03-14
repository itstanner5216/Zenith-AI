ALTER TABLE "user_usage" DROP COLUMN IF EXISTS "billingCycle";--> statement-breakpoint
ALTER TABLE "user_usage" DROP COLUMN IF EXISTS "audioTranscriptionMinutes";--> statement-breakpoint
ALTER TABLE "user_usage" DROP COLUMN IF EXISTS "maxAudioTranscriptionMinutes";--> statement-breakpoint
ALTER TABLE "user_usage" DROP COLUMN IF EXISTS "subscriptionStatus";--> statement-breakpoint
ALTER TABLE "user_usage" DROP COLUMN IF EXISTS "paymentStatus";--> statement-breakpoint
ALTER TABLE "user_usage" DROP COLUMN IF EXISTS "lastPayment";--> statement-breakpoint
ALTER TABLE "user_usage" DROP COLUMN IF EXISTS "currentProduct";--> statement-breakpoint
ALTER TABLE "user_usage" DROP COLUMN IF EXISTS "currentPlan";--> statement-breakpoint
ALTER TABLE "user_usage" DROP COLUMN IF EXISTS "hasCatalystAccess";
