'use strict';

function lazy(fn) {
  var args = arguments;
  var result;
  var lazyEval = fn.bind.apply(fn, args);
  return function () {
    if (result) {
      return result
    }
    result = lazyEval()
    return result;
  }
}

module.exports = lazy;
