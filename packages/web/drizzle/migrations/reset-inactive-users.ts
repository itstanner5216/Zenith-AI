import { db, UserUsageTable } from "../schema";
import { sql } from "drizzle-orm";

export async function resetInactiveUsers() {
  try {
    // Reset token usage for records with no active token budget.
    await db
      .update(UserUsageTable)
      .set({
        maxTokenUsage: 0,
        tokenUsage: 0,
      })
      .where(sql`${UserUsageTable.maxTokenUsage} <= 0`);

    console.log("Successfully reset token usage for zero-budget records");

    // Get count of affected users for logging
    const affectedUsers = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(UserUsageTable)
      .where(sql`${UserUsageTable.maxTokenUsage} <= 0`);

    console.log(`Reset ${affectedUsers[0].count} users`);
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  }
} 
