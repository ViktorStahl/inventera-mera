type SqlValue = string | number | bigint | null | Uint8Array;

type SqliteStatement = {
  all(...params: SqlValue[]): Record<string, unknown>[];
  get(...params: SqlValue[]): Record<string, unknown> | undefined;
  run(...params: SqlValue[]): {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  };
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
};

declare const require: (moduleName: string) => unknown;

const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (location: string) => SqliteDatabase;
};

export class SqliteTestAdapter {
  private readonly database = new DatabaseSync(":memory:");

  async execAsync(sql: string): Promise<void> {
    this.database.exec(sql);
  }

  async runAsync(
    sql: string,
    ...params: SqlValue[]
  ): Promise<{ changes: number; lastInsertRowId: number }> {
    const result = this.database.prepare(sql).run(...params);
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null> {
    return (this.database.prepare(sql).get(...params) as T | undefined) ?? null;
  }

  async getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]> {
    return this.database.prepare(sql).all(...params) as T[];
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.database.exec("BEGIN");
    try {
      await task();
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  async closeAsync(): Promise<void> {
    this.database.close();
  }
}
