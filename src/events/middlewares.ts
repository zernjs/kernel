import type { EventContext, Next } from '@types';

export type Middleware = (ctx: EventContext, next: Next) => Promise<void> | void;
