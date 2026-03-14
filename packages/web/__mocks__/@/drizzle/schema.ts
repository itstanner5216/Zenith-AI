// In-memory database for testing
const mockDatabase: Record<string, any[]> = {};

// Helper to evaluate SQL expressions used in token usage updates.
function evaluateSqlExpression(sqlObj: any, record: any): number {
  // Check if this is a SQL object (has queryChunks)
  if (!sqlObj || !sqlObj.queryChunks || !Array.isArray(sqlObj.queryChunks)) {
    return sqlObj; // Not a SQL object, return as-is
  }

  // Get current record values
  const currentMaxTokenUsage = record.maxTokenUsage || 0;
  const currentTokenUsage = record.tokenUsage || 0;
  return currentMaxTokenUsage - currentTokenUsage;
}

// Mock database object with stateful operations
export const db = {
  select: jest.fn(() => ({
    from: jest.fn((table: any) => ({
      where: jest.fn((_condition: any) => {
        // Simple mock: return all records for the table
        // Handle both table object and string
        const tableName =
          table?.name || (typeof table === 'string' ? table : 'user_usage');
        const records = mockDatabase[tableName] || [];

        // If condition exists, try to filter (simple userId matching)
        if (_condition && records.length > 0) {
          // For simple eq() conditions on userId, filter records
          // This is a simplified filter - real drizzle conditions are more complex
          return Promise.resolve(records); // Return all for now, tests can override
        }

        return Promise.resolve(records);
      }),
    })),
  })),
  insert: jest.fn((table: any) => ({
    values: jest.fn((values: any) => {
      const tableName = table?.name || 'user_usage';
      if (!mockDatabase[tableName]) {
        mockDatabase[tableName] = [];
      }
      // Handle single or array of values
      const recordsToInsert = Array.isArray(values) ? values : [values];
      mockDatabase[tableName].push(...recordsToInsert);
      return Promise.resolve({ rowCount: recordsToInsert.length });
    }),
  })),
  update: jest.fn((table: any) => ({
    set: jest.fn((updates: any) => ({
      where: jest.fn((condition: any) => {
        const tableName = table?.name || 'user_usage';
        const records = mockDatabase[tableName] || [];
        let updatedCount = 0;

        records.forEach((record: any) => {
          // Handle SQL expressions in updates.
          const processedUpdates: any = {};
          for (const [key, value] of Object.entries(updates)) {
            // Check if value is a SQL object and needs evaluation
            // Use type assertion to check for SQL object structure
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sqlValue = value as any;
            if (
              sqlValue &&
              typeof sqlValue === 'object' &&
              'queryChunks' in sqlValue &&
              Array.isArray(sqlValue.queryChunks)
            ) {
              // This is a SQL expression, evaluate it using current record values
              processedUpdates[key] = evaluateSqlExpression(sqlValue, record);
            } else {
              processedUpdates[key] = value;
            }
          }
          Object.assign(record, processedUpdates);
          updatedCount++;
        });

        return Promise.resolve({ rowCount: updatedCount });
      }),
    })),
  })),
  delete: jest.fn((table: any) => ({
    where: jest.fn((_condition: any) => {
      const tableName = table?.name || 'user_usage';
      const records = mockDatabase[tableName] || [];
      // Simple: clear all records (tests can override this)
      const deletedCount = records.length;
      mockDatabase[tableName] = [];
      return Promise.resolve({ rowCount: deletedCount });
    }),
  })),
};

// Helper to clear database between tests
export const clearMockDatabase = () => {
  Object.keys(mockDatabase).forEach((key) => {
    delete mockDatabase[key];
  });
};

// Mock UserUsageTable
export const UserUsageTable = {
  name: 'user_usage',
  userId: 'userId',
  tokenUsage: 'tokenUsage',
  maxTokenUsage: 'maxTokenUsage',
  tier: 'tier',
};

// Mock other exports that might be needed
export const incrementTokenUsage = jest.fn().mockResolvedValue({
  remaining: 1000000,
  usageError: false,
});

export const checkTokenUsage = jest.fn().mockResolvedValue({
  remaining: 1000000,
  usageError: false,
});

export const createEmptyUserUsage = jest.fn().mockResolvedValue({});

export const initializeTierConfig = jest.fn().mockResolvedValue({});
