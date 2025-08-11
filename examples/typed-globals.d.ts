import type { EventDef } from '@events/types';
import type { AlertDef } from '@alerts/types';

// Augmentations for example app to enable autocomplete in useEvents()/useAlerts()
declare module '@events/types' {
  interface ZernEvents {
    auth: {
      login: EventDef<{ userId: string }>;
    };
  }
}

declare module '@alerts/types' {
  interface ZernAlerts {
    ui: {
      Info: AlertDef<{ message: string }>;
    };
  }
}
