import { plugin, alerts, errors } from '../src';
import { Database } from './database.plugin';

const ui = alerts.createAlerts('ui', { Info: alerts.defineAlert() });
const err = errors.defineErrors('auth', { InvalidCredentials: (p: { reason: string }) => p });
const { InvalidCredentials } = err.factories;

export const Auth = plugin.definePlugin({
  name: 'auth',
  version: '1.0.0',
  dependsOn: [Database],
  alerts: { namespace: ui.namespace, kinds: ui.kinds },
  errors: err.spec,
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
