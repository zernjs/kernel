import type { EventAdapter, RxjsAdapterOptions, RxjsSubjectLike } from '@types';

export function createRxjsAdapter<T = unknown>(options: RxjsAdapterOptions<T>): EventAdapter {
  const subjects = new Map<string, RxjsSubjectLike<T>>();
  const key = (ns: string, ev: string): string => `${ns}:${ev}`;

  return {
    name: 'rxjs',
    onDefine(namespace, eventName): void {
      const k = key(namespace, eventName);
      if (!subjects.has(k)) subjects.set(k, options.subjectFactory(namespace, eventName));
    },
    onEmit(namespace, eventName, payload): void {
      const k = key(namespace, eventName);
      const subj = subjects.get(k);
      if (subj) subj.next(payload as T);
    },
  };
}
