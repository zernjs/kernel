import { plugin, alerts, errors, events, useEvents } from '../src';
import { Database } from './database.plugin';

const ui = alerts.createAlerts('ui', { Info: alerts.defineAlert() });
export const ev = events.createEvents('auth', { login: events.event<{ userId: string }>() });
const err = errors.defineErrors('auth', { InvalidCredentials: (p: { reason: string }) => p });
export const InvalidCredentials = err.factories.InvalidCredentials;

export const Auth = plugin.definePlugin({
  name: 'auth',
  version: '1.0.0',
  dependsOn: [Database],
  alerts: { namespace: ui.namespace, kinds: ui.kinds },
  events: ev,
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
        // Typed emit using the declared spec
        const auth = await useEvents(ev);
        await auth.emit('login', { userId: _user });
        await ctx.errors.Throw(InvalidCredentials({ reason: 'demo' }));
        return false;
      },
    };
  },
});
