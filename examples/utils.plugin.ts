import { plugin } from '../src';
import { Database } from './database.plugin';

export type UtilsAPI = {
  formatDate: (d: Date) => string;
  log: (msg: string) => void;
};

export const Utils = plugin.definePlugin({
  name: 'utils',
  version: '1.0.0',
  dependsOn: [Database],
  augments: {
    database: {
      async backup(name: string): Promise<boolean> {
        void name;
        return true;
      },
    },
  },
  async setup(): Promise<UtilsAPI> {
    return {
      formatDate(d: Date): string {
        return d.toISOString();
      },
      log(msg: string): void {
        console.log(`[utils] ${msg}`);
      },
    } satisfies UtilsAPI;
  },
});
