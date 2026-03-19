import { drizzle } from 'drizzle-orm/postgres-js';
import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import postgres from 'postgres';

const client = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL!);
export const db = drizzle(client);

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

// Stubs — imported by lib/incrementAndLogTokenUsage.ts which Plan A will delete.
// Remove after Plan A merges.
export const incrementTokenUsage = async (
  _userId: string,
  _tokens: number
): Promise<{ remaining: number; usageError: boolean }> => ({ remaining: 0, usageError: false });

export const checkTokenUsage = async (
  _userId: string
): Promise<{ remaining: number; usageError: boolean }> => ({ remaining: 0, usageError: false });
