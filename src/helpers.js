export function retry({ fn, retriesLeft = 1, timeout = 2000 }, ...fnArgs) {
  return new Promise((resolve, reject) => {
    return fn(...fnArgs, timeout)
      .then(resolve)
      .catch(error => {
        if (retriesLeft === 0) {
          reject(error);

          return;
        }

        setTimeout(() => {
          retry({ fn, retriesLeft: retriesLeft - 1, timeout }, ...fnArgs).catch(
            () => {}
          );
        }, timeout);
      });
  });
}
