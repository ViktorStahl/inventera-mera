export function confirmDestructive(title: string, message: string): Promise<boolean> {
  return Promise.resolve(globalThis.confirm(`${title}\n\n${message}`));
}
