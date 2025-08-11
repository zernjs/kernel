import { definePlugin } from '../src/plugin/definePlugin';
import { createAlerts, defineAlert } from '../src/alerts/alert-bus';
import { defineErrors } from '../src/errors/error-bus';
import { Database } from './database.plugin';

const alerts = createAlerts('ui', { Info: defineAlert() });
const errors = defineErrors('auth', { InvalidCredentials: (p: { reason: string }) => p });
const { InvalidCredentials } = errors.factories;

export const Auth = definePlugin({
  name: 'auth',
  version: '1.0.0',
  dependsOn: [Database],
  alerts: { namespace: alerts.namespace, kinds: alerts.kinds },
  errors: errors.spec,
  async setup(ctx): Promise<{
    login: (u: string, p: string) => Promise<boolean>;
  }> {
    await ctx.kernel.alerts.emit('ui', 'Info', { message: 'Auth starting' });

    // access to dependent plugin API with autocomplete
    const db = ctx.use('database');
    void db.isConnected();
    return {
      async login(_user: string, _pass: string): Promise<boolean> {
        await ctx.errors.Throw(InvalidCredentials({ reason: 'demo' }));
        return false;
      },
    };
  },
});
