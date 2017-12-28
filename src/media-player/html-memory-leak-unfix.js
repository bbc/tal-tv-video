var utils = require('../utils')
var HTMLPlayer = require('./html')

var HTMLMemoryLeakUnfixPlayer = utils.inherit(HTMLPlayer)
HTMLMemoryLeakUnfixPlayer.prototype._unloadMediaSrc = function () {}

module.exports = HTMLMemoryLeakUnfixPlayer
