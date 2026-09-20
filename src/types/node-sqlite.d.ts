declare module "node:sqlite" {
  interface RunResult {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }
  export interface StatementSync {
    run(...params: unknown[]): RunResult;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    iterate(...params: unknown[]): IterableIterator<unknown>;
  }
  export class DatabaseSync {
    constructor(path?: string, options?: { open?: boolean });
    open(path: string): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
