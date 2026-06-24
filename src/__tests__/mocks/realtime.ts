type EventCallback = (payload: any) => void;

export class MockChannel {
  name: string;
  private listeners = new Map<string, EventCallback[]>();
  private statusCb: ((status: string) => void) | null = null;
  subscribed = false;

  constructor(name: string) {
    this.name = name;
  }

  on(event: string, filter: any, callback?: EventCallback) {
    const cb = callback || filter;
    const key = event;
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key)!.push(cb);
    return this;
  }

  subscribe(callback?: (status: string) => void) {
    this.statusCb = callback ?? null;
    setTimeout(() => {
      this.subscribed = true;
      this.statusCb?.('SUBSCRIBED');
    }, 0);
    return this;
  }

  send(_message: any) {
    return Promise.resolve('ok');
  }

  unsubscribe() {
    this.subscribed = false;
    this.listeners.clear();
  }

  receive(event: string, payload: any) {
    const cbs = this.listeners.get(event) ?? [];
    cbs.forEach(cb => cb({ event, payload }));
  }

  receiveUpdate(payload: { new: any; old?: any }) {
    const cbs = this.listeners.get('postgres_changes') ?? [];
    cbs.forEach(cb => cb(payload));
  }

  triggerStatus(status: string) {
    this.statusCb?.(status);
  }

  get topic() {
    return `realtime:${this.name}`;
  }
}
