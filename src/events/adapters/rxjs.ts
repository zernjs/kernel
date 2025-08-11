/**
 * @file RxJS adapter for the Events layer.
 */
import type { EventAdapter, RxjsAdapterOptions, RxjsSubjectLike } from '@types';

export function createRxjsAdapter<T = unknown>(options: RxjsAdapterOptions<T>): EventAdapter {
  const subjectByCompositeName = new Map<string, RxjsSubjectLike<T>>();
  const toCompositeName = (ns: string, ev: string): string => `${ns}:${ev}`;

  return {
    name: 'rxjs',
    onDefine(namespace, eventName): void {
      const composite = toCompositeName(namespace, eventName);
      if (!subjectByCompositeName.has(composite))
        subjectByCompositeName.set(composite, options.subjectFactory(namespace, eventName));
    },
    onEmit(namespace, eventName, payload): void {
      const composite = toCompositeName(namespace, eventName);
      const subject = subjectByCompositeName.get(composite);
      if (subject) subject.next(payload as T);
    },
  };
}
