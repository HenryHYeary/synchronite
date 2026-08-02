const locks = new Map<string, Promise<void>>();

export async function withPathLock<T>(path: string, operation: () => Promise<T>): Promise<T> {
  const previous = locks.get(path) ?? Promise.resolve();

  const current = previous.then(operation, operation);

  locks.set(path, current.then(() => {}, () => {}));

  return current;
}