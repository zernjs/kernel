import { createKernel } from '../src/core/createKernel';
import { definePlugin } from '../src/plugin/definePlugin';
import { defineErrors } from '../src/errors/error-bus';
import { createErrorHelpers } from '../src';

// Define typed errors for the auth domain
const AuthErrors = defineErrors('auth', {
  InvalidCredentials: (p: { user: string }) => p,
  LockedAccount: (p: { user: string }) => p,
});

// Simple utility plugin
const Utils = definePlugin({
  name: 'utils',
  version: '1.0.0',
  async setup() {
    return {
      formatDate(d: Date): string {
        return d.toISOString();
      },
    };
  },
});

// Auth plugin declares its errors for typing and DX (no runtime coupling needed)
const Auth = definePlugin({
  name: 'auth',
  version: '1.0.0',
  errors: AuthErrors,
  async setup() {
    return {
      async login(user: string, pass: string): Promise<boolean> {
        // Simula resultado
        return user === 'u1' && pass === 'secret';
      },
    };
  },
});

async function main(): Promise<void> {
  console.log('[example] start');

  // Use builder local (tipado) para aproveitar helpers vinculados com autocomplete/payload inferido
  const kernel = createKernel().use(Utils).use(Auth).build();
  await kernel.init();

  const utils = kernel.plugins.utils;
  console.log('[example] kernel inited @', utils.formatDate(new Date()));

  // Bind helpers ao kernel tipado
  const { on, report, once, fail } = createErrorHelpers(kernel);

  // Subscribe using bound helper with autocomplete and typed payload
  const offInvalid = await on('auth.InvalidCredentials', payload => {
    console.warn('[errors] InvalidCredentials:', payload.user);
  });
  // Trigger a report (does not throw) → listener gets called
  await report('auth.InvalidCredentials', { user: 'u1' }, { severity: 'warn' });

  // Await the next occurrence once (typed return)
  const nextInvalidP = once('auth.InvalidCredentials');
  await report('auth.InvalidCredentials', { user: 'u2' });
  const p = await nextInvalidP;
  console.log('[example] once payload:', p.user);

  // Demonstrate fail (throws)
  try {
    await fail('auth.LockedAccount', { user: 'u3' });
  } catch (e) {
    console.warn('[example] fail threw as expected:', e);
  }

  offInvalid();
  await kernel.destroy();
  console.log('[example] end');
}

void main();
