/**
 * @file Events middleware primitives.
 */
import type { EventContext } from '@types';

export type Middleware = (ctx: EventContext, next: () => Promise<void>) => Promise<void> | void;
