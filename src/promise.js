const _         = require('lodash'),
      BbPromise = require('bluebird');

function each(input, fn) {
  var self = this;
  var promise = BbPromise.resolve();

  _.each(input, (obj, key) => promise.then(() => fn.call(self, obj, key)));

  return promise;
}

module.exports = {
  each: each
};
