import { plugin, alerts, errors, events, useEvents, useHooks, hooks } from '../src';
import { Database } from './database.plugin';

export const ui = alerts.createAlerts('ui', { Info: alerts.defineAlert() });
export const ev = events.createEvents('auth', { login: events.event<{ userId: string }>() });
export const hk = hooks.createHooks('auth', { beforeLogin: hooks.defineHook<{ user: string }>() });
const err = errors.defineErrors('auth', { InvalidCredentials: (p: { reason: string }) => p });
export const InvalidCredentials = err.factories.InvalidCredentials;

export const Auth = plugin.definePlugin({
  name: 'auth',
  version: '1.0.0',
  dependsOn: [Database],
  alerts: ui,
  events: ev,
  hooks: hk,
  errors: err.spec,
  async setup(ctx): Promise<{
    login: (u: string, p: string) => Promise<boolean>;
  }> {
    await ctx.kernel.alerts.emit('ui.Info', { message: 'Auth starting' });

    // access to dependent plugin API with autocomplete
    const db = ctx.use('database');
    void db.isConnected();
    return {
      async login(_user: string, _pass: string): Promise<boolean> {
        // Hooks: emit before event
        const h = await useHooks(hk);
        await h.emit('beforeLogin', { user: _user });
        // Typed emit using the declared spec
        const auth = await useEvents(ev);
        await auth.emit('login', { userId: _user });
        await ctx.errors.Throw(InvalidCredentials({ reason: 'demo' }));
        return false;
      },
    };
  },
});
