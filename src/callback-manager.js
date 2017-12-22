function CallbackManager () {
  this._callbacks = []
}
CallbackManager.prototype.addCallback = function addCallback (thisArg, callback) {
  if (this._getIndexOf(thisArg, callback) === undefined) {
    this._callbacks.push([thisArg, callback])
  }
}
CallbackManager.prototype.removeCallback = function removeCallback (thisArg, callback) {
  var foundIndex = this._getIndexOf(thisArg, callback)
  if (foundIndex !== undefined) {
    this._callbacks.splice(foundIndex, 1)
  }
}
CallbackManager.prototype._getIndexOf = function _getIndexOf (thisArg, callback) {
  var result
  for (var i = 0; i < this._callbacks.length; i++) {
    if (this._callbacks[i][0] === thisArg && this._callbacks[i][1] === callback) {
      result = i
      break
    }
  }
  return result
}
CallbackManager.prototype.removeAllCallbacks = function removeAllCallbacks () {
  this._callbacks = []
}
CallbackManager.prototype.callAll = function callAll () {
  // Convert arguments object to args array.
  var args = Array.prototype.slice.call(arguments)
  for (var i = 0; i < this._callbacks.length; i++) {
    var thisArg = this._callbacks[i][0]
    var callback = this._callbacks[i][1]
    callback.apply(thisArg, args)
  }
}

module.exports = CallbackManager
