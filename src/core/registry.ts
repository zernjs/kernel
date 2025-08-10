import type { IPluginRegistry, PluginInstance, PluginLoadOrder } from '@types';
import { hasOwn } from '@utils';

export class PluginRegistry implements IPluginRegistry {
  private readonly plugins = new Map<string, PluginInstance>();
  private readonly loadOrder = new Map<string, PluginLoadOrder>();

  register(plugin: PluginInstance, order?: PluginLoadOrder): void {
    this.plugins.set(plugin.metadata.name, plugin);
    if (order && (hasOwn(order, 'before') || hasOwn(order, 'after')))
      this.loadOrder.set(plugin.metadata.name, order);
  }

  get<T extends PluginInstance = PluginInstance>(name: string): T | null {
    return (this.plugins.get(name) as T | undefined) ?? null;
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  list(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  getLoadOrder(name: string): PluginLoadOrder | undefined {
    return this.loadOrder.get(name);
  }

  clear(): void {
    this.plugins.clear();
    this.loadOrder.clear();
  }
}
