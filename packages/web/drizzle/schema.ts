import { drizzle } from 'drizzle-orm/postgres-js';
import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
  boolean,
} from 'drizzle-orm/pg-core';
import { eq, sql } from 'drizzle-orm';
import postgres from 'postgres';

const client = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL!);
export const db = drizzle(client);

// Table to store tier configurations
export const TierConfigTable = pgTable('tier_config', {
  id: serial('id').primaryKey(),
  tierName: text('tier_name').notNull().unique(),
  maxTokens: integer('max_tokens').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type TierConfig = typeof TierConfigTable.$inferSelect;
export type NewTierConfig = typeof TierConfigTable.$inferInsert;

// Default token budget for API-key-backed usage records.
export const DEFAULT_API_KEY_TOKENS = 100000;

// Create a pgTable that maps to a table in your DB to track user usage
export const UserUsageTable = pgTable(
  'user_usage',
  {
    id: serial('id').primaryKey(),
    userId: text('userId').notNull().unique(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    tokenUsage: integer('tokenUsage').notNull().default(0),
    maxTokenUsage: integer('maxTokenUsage').notNull().default(0),
    tier: text('tier').notNull().default('free'),
  },
  (userUsage) => {
    return {
      uniqueUserIdx: uniqueIndex('unique_user_idx').on(userUsage.userId),
    };
  }
);

// Table to track one-time Christmas token claims
export const christmasClaims = pgTable(
  'christmas_claims',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    claimedAt: timestamp('claimed_at').defaultNow().notNull(),
  },
  (table) => {
    return {
      uniqueUserIdx: uniqueIndex('unique_christmas_claim_idx').on(table.userId),
    };
  }
);

export type ChristmasClaim = typeof christmasClaims.$inferSelect;

// Helper function to check if a user has claimed their Christmas tokens
export const hasClaimedChristmasTokens = async (
  userId: string
): Promise<boolean> => {
  try {
    const claims = await db
      .select()
      .from(christmasClaims)
      .where(eq(christmasClaims.userId, userId))
      .limit(1);

    return claims.length > 0;
  } catch (error) {
    console.error('Error checking Christmas token claims:', error);
    return false;
  }
};

export const vercelTokens = pgTable('vercel_tokens', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  token: text('token').notNull(),
  projectId: text('project_id'),
  deploymentUrl: text('deployment_url'),
  projectUrl: text('project_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastDeployment: timestamp('last_deployment'),
  modelProvider: text('model_provider').default('openai'),
  modelName: text('model_name').default('gpt-4.1-mini'),
  visionModelName: text('vision_model_name').default('gpt-4.1-mini'),
  lastApiKeyUpdate: timestamp('last_api_key_update'),
});

export type VercelToken = typeof vercelTokens.$inferSelect;
export type NewVercelToken = typeof vercelTokens.$inferInsert;

export const createEmptyUserUsage = async (userId: string) => {
  await db
    .insert(UserUsageTable)
    .values({
      userId,
      tokenUsage: 0,
      maxTokenUsage: DEFAULT_API_KEY_TOKENS,
      tier: 'free',
    })
    .onConflictDoNothing({
      target: [UserUsageTable.userId],
    });
};

// Initialize the tier config table with default values if none exist
export const initializeTierConfig = async () => {
  try {
    const existingTiers = await db.select().from(TierConfigTable).limit(1);

    if (existingTiers.length === 0) {
      // Insert default tier configurations
      await db.insert(TierConfigTable).values([
        {
          tierName: 'free',
          maxTokens: DEFAULT_API_KEY_TOKENS,
          isActive: true,
        },
        {
          tierName: 'paid',
          maxTokens: 1000000, // 1 million tokens for paid tier
          isActive: true,
        },
      ]);
      console.log('Initialized default tier configurations');
    }
  } catch (error) {
    console.error('Error initializing tier configurations:', error);
  }
};

export async function incrementTokenUsage(
  userId: string,
  tokens: number
): Promise<{ remaining: number; usageError: boolean }> {
  try {
    // Validate tokens is a valid number
    if (Number.isNaN(tokens) || !Number.isFinite(tokens)) {
      console.warn(
        `Invalid token value received for user ${userId}: ${tokens}, using 0 instead`
      );
      tokens = 0;
    }

    // Ensure tokens is a non-negative integer
    tokens = Math.max(0, Math.floor(tokens));

    // First check if the user has a usage row
    const existingUsage = await db
      .select()
      .from(UserUsageTable)
      .where(eq(UserUsageTable.userId, userId))
      .limit(1);

    // If no usage row exists, create one with initial values
    if (existingUsage.length === 0) {
      await db.insert(UserUsageTable).values({
        userId,
        tokenUsage: 0,
        maxTokenUsage: DEFAULT_API_KEY_TOKENS,
        tier: 'free',
      });
    }

    // Now update the token usage
    const userUsage = await db
      .update(UserUsageTable)
      .set({
        tokenUsage: sql`${UserUsageTable.tokenUsage} + ${tokens}`,
      })
      .where(eq(UserUsageTable.userId, userId))
      .returning({
        remaining: sql<number>`${UserUsageTable.maxTokenUsage} - COALESCE(${UserUsageTable.tokenUsage}, 0)`,
      });

    console.log(
      'Incremented token usage for user:',
      userId,
      userUsage[0]?.remaining,
      userUsage
    );
    return {
      remaining: userUsage[0]?.remaining ?? 0,
      usageError: false,
    };
  } catch (error) {
    console.error('Error incrementing token usage:', error);
    return {
      remaining: 0,
      usageError: true,
    };
  }
}

export const checkTokenUsage = async (userId: string) => {
  try {
    const userUsage = await db
      .select()
      .from(UserUsageTable)
      .where(eq(UserUsageTable.userId, userId))
      .limit(1);

    // If user doesn't exist yet, return the default token budget
    if (!userUsage.length) {
      console.log(
        `No user record found for ${userId} in checkTokenUsage, returning default token budget`
      );
      return {
        remaining: DEFAULT_API_KEY_TOKENS,
        usageError: false,
      };
    }

    if (userUsage[0]?.tokenUsage >= userUsage[0]?.maxTokenUsage) {
      return {
        remaining: 0,
        usageError: false,
      };
    }

    return {
      remaining: userUsage[0]?.maxTokenUsage - userUsage[0]?.tokenUsage,
      usageError: false,
    };
  } catch (error) {
    console.error('Error checking token usage:', error);
    return {
      remaining: 0,
      usageError: true,
    };
  }
};


export const uploadedFiles = pgTable('uploaded_files', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  blobUrl: text('blob_url').notNull(),
  r2Key: text('r2_key'),
  fileType: text('file_type').notNull(),
  originalName: text('original_name').notNull(),
  status: text('status').notNull().default('pending'),
  textContent: text('text_content'),
  tokensUsed: integer('tokens_used'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  error: text('error'),
  processType: text('process_type').default('standard-ocr'),
  generatedImageUrl: text('generated_image_url'),
});

export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type NewUploadedFile = typeof uploadedFiles.$inferInsert;
