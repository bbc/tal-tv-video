var utils = require('../utils')
var HTMLPlayer = require('./html')

var HTMLUntypedPlayer = utils.inherit(HTMLPlayer)
HTMLUntypedPlayer.prototype._unloadMediaSrc = function () {}
HTMLUntypedPlayer.prototype._generateSourceElement = function _generateSourceElement (url) {
  var sourceElement = utils.createElement('source')
  sourceElement.src = url
  return sourceElement
}

module.exports = HTMLUntypedPlayer
