export function confirmDestructive(title: string, message: string, _confirmLabel = "Radera"): Promise<boolean> {
  return Promise.resolve(globalThis.confirm(`${title}\n\n${message}`));
}
