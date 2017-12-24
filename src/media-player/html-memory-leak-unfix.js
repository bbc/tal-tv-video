var utils = require('../utils')
var HTMLPlayer = require('./html-player')

var HTMLMemoryLeakUnfixPlayer = utils.inherit(HTMLPlayer)
HTMLMemoryLeakUnfixPlayer.prototype._unloadMediaSrc = function () {}

module.exports = HTMLMemoryLeakUnfixPlayer
