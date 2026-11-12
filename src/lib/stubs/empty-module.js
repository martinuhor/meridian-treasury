const handler = {
  get(_target, prop) {
    if (prop === "__esModule") return true;
    if (prop === "then") return undefined;
    if (prop === "default") return module.exports;
    return function stubFn() {
      return new Proxy(function () {}, handler);
    };
  },
  apply() {
    return new Proxy(function () {}, handler);
  },
};

module.exports = new Proxy(function () {}, handler);
