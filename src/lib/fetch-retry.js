import 'isomorphic-fetch';
// this is an adapted version of https://github.com/jonbern/fetch-retry

function fetchRT(url, options) {
  let retries = 3;
  let retryDelay = 1000;
  let retryOn = [];

  if (options && options.retries) {
    retries = options.retries;
  }

  if (options && options.retryDelay) {
    retryDelay = options.retryDelay;
  }

  if (options && options.retryOn) {
    if (options.retryOn instanceof Array) {
      retryOn = options.retryOn;
    } else {
      throw new Error('retryOn property expects an array');
    }
  }

  return new Promise((resolve, reject) => {
    function retry(n) {
      setTimeout(() => {
        let retryCount = n;
        retryCount -= 1;
        wrappedFetch(retryCount);
      }, retryDelay);
    }

    const wrappedFetch = function (n) {
      fetch(url, options)
        .then((response) => {
          if (retryOn.indexOf(response.status) === -1) {
            resolve(response);
            return;
          }

          if (n > 0) {
            retry(n);
            return;
          }

          resolve(response);
        })
        .catch((error) => {
          if (n > 0) {
            retry(n);
            return;
          }
          reject(error);
        });
    };

    wrappedFetch(retries);
  });
}

module.exports = fetchRT;
