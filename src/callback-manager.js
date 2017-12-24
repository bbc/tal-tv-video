function _getIndexOf (callbacks, that, callback) {
  return callbacks.reduce(function (acc, next, i) {
    return (next.that === that && next.fn === callback) ? i : acc
  }, -1)
}

function CallbackManager () {
  var _callbacks = []
  function addCallback (thisArg, callback) {
    if (_getIndexOf(_callbacks, thisArg, callback) === -1) {
      _callbacks.push({ that: thisArg, fn: callback })
    }
  }
  function callAll () {
    var args = Array.prototype.slice.call(arguments)
    _callbacks.forEach(function (callback) {
      callback.fn.apply(callback.that, args)
    })
  }
  function removeCallback (thisArg, callback) {
    var foundIndex = _getIndexOf(_callbacks, thisArg, callback)
    if (foundIndex !== -1) {
      _callbacks.splice(foundIndex, 1)
    }
  }
  function removeAllCallbacks () {
    _callbacks = []
  }
  return {
    addCallback: addCallback,
    callAll: callAll,
    removeCallback: removeCallback,
    removeAllCallbacks: removeAllCallbacks
  }
}

module.exports = CallbackManager
