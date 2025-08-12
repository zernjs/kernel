declare module '@events/types' {
  interface ZernEvents {
  auth: {
    login: { __type: 'event-def' }
    userId: { __type: 'event-def' }
    delivery: { __type: 'event-def' }
  }
  }
}

declare module '@alerts/types' {
  interface ZernAlerts {
  ui: {
    Info: { __type: 'alert-def' }
  }
  }
}

declare module '@hooks/types' {
  interface ZernHooks {
  auth: {
    beforeLogin: { __type: 'hook-def' }
    user: { __type: 'hook-def' }
  }
  }
}
