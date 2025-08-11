import { plugin } from '../src';
import { Database } from './database.plugin';

export type UtilsAPI = {
  formatDate: (d: Date) => string;
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
    } satisfies UtilsAPI;
  },
});
