export function retry<T>(fn: () => Promise<T>, times: number = 2): Promise<T> {
  function asyncTask(
    fn: () => Promise<T>,
    resolve: (value?: T) => void,
    reject: (reason?: any) => void,
  ): void {
    fn()
      .then(resolve)
      .catch((error) => {
        if (times === 1) {
          return reject(error);
        }

        times--;
        asyncTask(fn, resolve, reject);
      });
  }

  return new Promise((resolve, reject) => {
    asyncTask(fn, resolve, reject);
  });
}

export function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
