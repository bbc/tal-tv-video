var utils = require('../utils')
var SamsungStreamingPlayer = require('./samsung-streaming')

var SamsungStreaming2015Player = utils.inherit(SamsungStreamingPlayer)
SamsungStreaming2015Player.prototype.setSource = function setSource (mediaType, url, mimeType) {
  if (this.getState() === this.STATE.EMPTY) {
    this._type = mediaType
    this._source = url
    this._mimeType = mimeType
    this._registerEventHandlers()
    this._toStopped()

    if (this._isHlsMimeType()) {
      this._source += '|COMPONENT=HLS'
    }
    this._openPlayerPlugin()

    this._initPlayer(this._source)
  } else {
    this._toError('Cannot set source unless in the \'' + this.STATE.EMPTY + '\' state')
  }
}
SamsungStreaming2015Player.prototype._updateRange = function _updateRange () {
  var self = this
  if (this._isHlsMimeType() && this._isLiveMedia()) {
    var range = this._playerPlugin.Execute('GetLiveDuration').split('|')
    this._range = {
      start: Math.floor(range[0] / 1000),
      end: Math.floor(range[1] / 1000)
    }
      // don't call range for the next RANGE_UPDATE_TOLERANCE seconds
    this._updatingTime = true
    setTimeout(function () {
      self._updatingTime = false
    }, self.RANGE_UPDATE_TOLERANCE * 1000)
  } else {
    var duration = this._playerPlugin.Execute('GetDuration') / 1000
    this._range = {
      start: 0,
      end: duration
    }
  }
}
SamsungStreaming2015Player.prototype._getClampedTimeForPlayFrom = function _getClampedTimeForPlayFrom (seconds) {
  if (this._isHlsMimeType() && this._isLiveMedia() && !this._updatingTime) {
    this._updateRange()
  }
  var clampedTime = this._getClampedTime(seconds)
  return clampedTime
}

module.exports = SamsungStreaming2015Player
