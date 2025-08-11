import { plugin } from '../src';

export type DatabaseAPI = {
  connect: (dsn: string) => Promise<void>;
  query: <T = unknown>(sql: string) => Promise<T[]>;
  isConnected: () => boolean;
  // Augmented by Utils plugin after init
  backup?: (name: string) => Promise<boolean>;
};

export const Database = plugin.definePlugin({
  name: 'database',
  version: '1.0.0',
  async setup(): Promise<DatabaseAPI> {
    let connected = false;
    return {
      async connect(dsn: string): Promise<void> {
        void dsn;
        connected = true;
      },
      async query<T = unknown>(_sql: string): Promise<T[]> {
        return [];
      },
      isConnected(): boolean {
        return connected;
      },
    } satisfies DatabaseAPI;
  },
});
