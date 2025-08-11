import { getKernel, useErrors, useEvents } from '../src';
import { Database } from './database.plugin';
import { Utils } from './utils.plugin';
import { Auth, InvalidCredentials, ev as AuthEvents } from './auth.plugin';

async function main(): Promise<void> {
  const kernel = getKernel()
    .use(Database)
    .use(Utils, { after: ['database'] })
    .use(Auth)
    .build();

  await kernel.init();

  const db = kernel.plugins.database;
  await db.connect('postgres://user:pass@localhost:5432/db');

  // Augmented method should appear as native after init
  await db.backup('daily');

  const event = await useEvents();
  event.on('auth.login', p => {
    const utils = kernel.plugins.utils;
    utils.log(`(flat) User logged in: ${p.userId}`);
  });
  // Subscribe to typed events using the descriptor with automatic binding via useEvents
  const authEvents = await useEvents(AuthEvents);
  authEvents.on('login', p => {
    const utils = kernel.plugins.utils;
    utils.log(`User logged in: ${p.userId} @ ${utils.formatDate(new Date())}`);
  });

  // Subscribe to errors
  const errors = await useErrors();
  errors.on(InvalidCredentials, payload => {
    console.warn(`[errors] InvalidCredentials:`, payload);
  });

  // Trigger the flow
  const auth = kernel.plugins.auth as { login: (u: string, p: string) => Promise<boolean> };
  await auth.login('u1', 'secret');
}

void main();
