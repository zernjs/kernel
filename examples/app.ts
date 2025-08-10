import { createKernel } from '../src/core/createKernel';
import { Database } from './database.plugin';
import { Utils } from './utils.plugin';
import { Auth } from './auth.plugin';

async function main(): Promise<void> {
  const kernel = createKernel()
    .use(Database)
    .use(Utils, { after: ['database'] })
    .use(Auth)
    .build();

  await kernel.init();

  const db = kernel.get('database')!;
  await db.connect('postgres://user:pass@localhost:5432/db');

  // Augmented method should appear as native after init
  await db.backup('daily');
}

void main();
