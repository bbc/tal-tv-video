var utils = require('../utils')
var MediaPlayer = require('./media-player')

var CEHTMLPlayer = utils.inherit(MediaPlayer)
CEHTMLPlayer.prototype.PLAY_STATE_STOPPED = 0
CEHTMLPlayer.prototype.PLAY_STATE_PLAYING = 1
CEHTMLPlayer.prototype.PLAY_STATE_PAUSED = 2
CEHTMLPlayer.prototype.PLAY_STATE_CONNECTING = 3
CEHTMLPlayer.prototype.PLAY_STATE_BUFFERING = 4
CEHTMLPlayer.prototype.PLAY_STATE_FINISHED = 5
CEHTMLPlayer.prototype.PLAY_STATE_ERROR = 6
CEHTMLPlayer.prototype.setSource = function setSource (mediaType, url, mimeType) {
  if (this.getState() === this.STATE.EMPTY) {
    this._type = mediaType
    this._source = url
    this._mimeType = mimeType
    this._timeAtLastSenintelInterval = 0
    this._setSeekSentinelTolerance()
    this._createElement()
    this._addElementToDOM()
    this._mediaElement.data = this._source
    this._registerEventHandlers()
    this._toStopped()
  } else {
    this._toError('Cannot set source unless in the \'' + this.STATE.EMPTY + '\' state')
  }
}
CEHTMLPlayer.prototype.resume = function resume () {
  this._postBufferingState = this.STATE.PLAYING
  switch (this.getState()) {
    case this.STATE.PLAYING:
    case this.STATE.BUFFERING:
      break

    case this.STATE.PAUSED:
      this._mediaElement.play(1)
      this._toPlaying()
      break

    default:
      this._toError('Cannot resume while in the \'' + this.getState() + '\' state')
      break
  }
}
CEHTMLPlayer.prototype.playFrom = function playFrom (seconds) {
  this._postBufferingState = this.STATE.PLAYING
  this._sentinelLimits.seek.currentAttemptCount = 0
  switch (this.getState()) {
    case this.STATE.BUFFERING:
      this._deferSeekingTo = seconds
      break

    case this.STATE.COMPLETE:
      this._toBuffering()
      this._mediaElement.stop()
      this._playAndSetDeferredSeek(seconds)
      break

    case this.STATE.PLAYING:
      this._toBuffering()
      var seekResult = this._seekTo(seconds)
      if (seekResult === false) {
        this._toPlaying()
      }
      break

    case this.STATE.PAUSED:
      this._toBuffering()
      this._seekTo(seconds)
      this._mediaElement.play(1)
      break

    default:
      this._toError('Cannot playFrom while in the \'' + this.getState() + '\' state')
      break
  }
}
CEHTMLPlayer.prototype.beginPlayback = function beginPlayback () {
  this._postBufferingState = this.STATE.PLAYING
  switch (this.getState()) {
    case this.STATE.STOPPED:
      this._toBuffering()
      this._mediaElement.play(1)
      break

    default:
      this._toError('Cannot beginPlayback while in the \'' + this.getState() + '\' state')
      break
  }
}
CEHTMLPlayer.prototype.beginPlaybackFrom = function beginPlaybackFrom (seconds) {
  this._postBufferingState = this.STATE.PLAYING
  this._sentinelLimits.seek.currentAttemptCount = 0

  switch (this.getState()) {
    case this.STATE.STOPPED:
      // Seeking past 0 requires calling play first when media has not been loaded
      this._toBuffering()
      this._playAndSetDeferredSeek(seconds)
      break

    default:
      this._toError('Cannot beginPlayback while in the \'' + this.getState() + '\' state')
      break
  }
}
CEHTMLPlayer.prototype.pause = function pause () {
  this._postBufferingState = this.STATE.PAUSED
  switch (this.getState()) {
    case this.STATE.BUFFERING:
    case this.STATE.PAUSED:
      break

    case this.STATE.PLAYING:
      this._mediaElement.play(0)
      this._toPaused()
      break

    default:
      this._toError('Cannot pause while in the \'' + this.getState() + '\' state')
      break
  }
}
CEHTMLPlayer.prototype.stop = function stop () {
  switch (this.getState()) {
    case this.STATE.STOPPED:
      break

    case this.STATE.BUFFERING:
    case this.STATE.PLAYING:
    case this.STATE.PAUSED:
    case this.STATE.COMPLETE:
      this._sentinelSeekTime = undefined
      this._mediaElement.stop()
      this._toStopped()
      break

    default:
      this._toError('Cannot stop while in the \'' + this.getState() + '\' state')
      break
  }
}
CEHTMLPlayer.prototype.reset = function reset () {
  switch (this.getState()) {
    case this.STATE.EMPTY:
      break

    case this.STATE.STOPPED:
    case this.STATE.ERROR:
      this._toEmpty()
      break

    default:
      this._toError('Cannot reset while in the \'' + this.getState() + '\' state')
      break
  }
}
CEHTMLPlayer.prototype._isNearToEnd = function _isNearToEnd (seconds) {
  return (this.getDuration() - seconds <= 1)
}
CEHTMLPlayer.prototype.getCurrentTime = function getCurrentTime () {
  switch (this.getState()) {
    case this.STATE.STOPPED:
    case this.STATE.ERROR:
      break

    case this.STATE.COMPLETE:
      if (this._range) {
        return this._range.end
      }
      break

    default:
      if (this._mediaElement) {
        return this._mediaElement.playPosition / 1000
      }
      break
  }
}
CEHTMLPlayer.prototype.getSeekableRange = function getSeekableRange () {
  switch (this.getState()) {
    case this.STATE.STOPPED:
    case this.STATE.ERROR:
      break

    default:
      return this._range
  }
}
CEHTMLPlayer.prototype._getMediaDuration = function _getMediaDuration () {
  if (this._range) {
    return this._range.end
  }
}
CEHTMLPlayer.prototype._onFinishedBuffering = function _onFinishedBuffering () {
  this._cacheRange()

  if (this.getState() !== this.STATE.BUFFERING) {
    return
  }

  if (this._waitingToSeek()) {
    this._toBuffering()
    this._performDeferredSeek()
  } else if (this._waitingToPause()) {
    this._toPaused()
    this._mediaElement.play(0)
  } else {
    this._toPlaying()
  }
}
CEHTMLPlayer.prototype._onDeviceBuffering = function _onDeviceBuffering () {
  if (this.getState() === this.STATE.PLAYING) {
    this._toBuffering()
  }
}
CEHTMLPlayer.prototype._onEndOfMedia = function _onEndOfMedia () {
  if (this.getState() !== this.STATE.COMPLETE) {
    this._toComplete()
  }
}
CEHTMLPlayer.prototype._onStatus = function _onStatus () {
  if (this.getState() === this.STATE.PLAYING) {
    this._emitEvent(this.EVENT.STATUS)
  }
}
CEHTMLPlayer.prototype._createElement = function _createElement () {
  this._mediaElement = utils.createElement('object', 'mediaPlayer')
  this._mediaElement.type = this._mimeType
  this._mediaElement.style.position = 'absolute'
  this._mediaElement.style.top = '0px'
  this._mediaElement.style.left = '0px'
  this._mediaElement.style.width = '100%'
  this._mediaElement.style.height = '100%'
}
CEHTMLPlayer.prototype._registerEventHandlers = function _registerEventHandlers () {
  var self = this
  var DEVICE_UPDATE_PERIOD_MS = 500

  this._mediaElement.onPlayStateChange = function () {
    switch (self._mediaElement.playState) {
      case CEHTMLPlayer.PLAY_STATE_STOPPED:
        break
      case CEHTMLPlayer.PLAY_STATE_PLAYING:
        self._onFinishedBuffering()
        break
      case CEHTMLPlayer.PLAY_STATE_PAUSED:
        break
      case CEHTMLPlayer.PLAY_STATE_CONNECTING:
        break
      case CEHTMLPlayer.PLAY_STATE_BUFFERING:
        self._onDeviceBuffering()
        break
      case CEHTMLPlayer.PLAY_STATE_FINISHED:
        self._onEndOfMedia()
        break
      case CEHTMLPlayer.PLAY_STATE_ERROR:
        self._onDeviceError()
        break
    }
  }
  this._updateInterval = setInterval(function () {
    self._onStatus()
  }, DEVICE_UPDATE_PERIOD_MS)
}
CEHTMLPlayer.prototype._addElementToDOM = function _addElementToDOM () {
  utils.prependChildElement('body', this._mediaElement)
}
CEHTMLPlayer.prototype._cacheRange = function _cacheRange () {
  if (this._mediaElement) {
    this._range = {
      start: 0,
      end: this._mediaElement.playTime / 1000
    }
  }
}
CEHTMLPlayer.prototype._playAndSetDeferredSeek = function _playAndSetDeferredSeek (seconds) {
  this._mediaElement.play(1)
  if (seconds > 0) {
    this._deferSeekingTo = seconds
  }
}
CEHTMLPlayer.prototype._waitingToSeek = function _waitingToSeek () {
  return this._deferSeekingTo !== undefined
}
CEHTMLPlayer.prototype._performDeferredSeek = function _performDeferredSeek () {
  this._seekTo(this._deferSeekingTo)
  this._deferSeekingTo = undefined
}
CEHTMLPlayer.prototype._seekTo = function _seekTo (seconds) {
  var clampedTime = this._getClampedTime(seconds)
  this._sentinelSeekTime = clampedTime
  return this._mediaElement.seek(clampedTime * 1000)
}
CEHTMLPlayer.prototype._waitingToPause = function _waitingToPause () {
  return this._postBufferingState === this.STATE.PAUSED
}
CEHTMLPlayer.prototype._wipe = function _wipe () {
  this._type = undefined
  this._source = undefined
  this._mimeType = undefined
  this._sentinelSeekTime = undefined
  this._range = undefined
  if (this._mediaElement) {
    clearInterval(this._updateInterval)
    this._clearSentinels()
    this._destroyMediaElement()
  }
}
CEHTMLPlayer.prototype._destroyMediaElement = function _destroyMediaElement () {
  delete this._mediaElement.onPlayStateChange
  this._mediaElement.parentNode.removeElement(this._mediaElement)
  this._mediaElement = undefined
}
CEHTMLPlayer.prototype._reportError = function _reportError (errorMessage) {
  this._emitEvent(this.EVENT.ERROR, {'errorMessage': errorMessage})
}
CEHTMLPlayer.prototype._toStopped = function _toStopped () {
  this._state = this.STATE.STOPPED
  this._emitEvent(this.EVENT.STOPPED)
  if (this._sentinelInterval) {
    this._clearSentinels()
  }
}
CEHTMLPlayer.prototype._toBuffering = function _toBuffering () {
  this._state = this.STATE.BUFFERING
  this._emitEvent(this.EVENT.BUFFERING)
  this._setSentinels([this._exitBufferingSentinel])
}
CEHTMLPlayer.prototype._toPlaying = function _toPlaying () {
  this._state = this.STATE.PLAYING
  this._emitEvent(this.EVENT.PLAYING)
  this._setSentinels([
    this._shouldBeSeekedSentinel,
    this._enterCompleteSentinel,
    this._enterBufferingSentinel
  ])
}
CEHTMLPlayer.prototype._toPaused = function _toPaused () {
  this._state = this.STATE.PAUSED
  this._emitEvent(this.EVENT.PAUSED)
  this._setSentinels([
    this._shouldBePausedSentinel,
    this._shouldBeSeekedSentinel
  ])
}
CEHTMLPlayer.prototype._toComplete = function _toComplete () {
  this._state = this.STATE.COMPLETE
  this._emitEvent(this.EVENT.COMPLETE)
  this._clearSentinels()
}
CEHTMLPlayer.prototype._toEmpty = function _toEmpty () {
  this._wipe()
  this._state = this.STATE.EMPTY
}
CEHTMLPlayer.prototype._toError = function _toError (errorMessage) {
  this._wipe()
  this._state = this.STATE.ERROR
  this._reportError(errorMessage)
  throw new Error('ApiError: ' + errorMessage)
}
CEHTMLPlayer.prototype._setSentinels = function _setSentinels (sentinels) {
  this._sentinelLimits.pause.currentAttemptCount = 0
  var self = this
  this._timeAtLastSenintelInterval = this.getCurrentTime()
  this._clearSentinels()
  this._sentinelIntervalNumber = 0
  this._sentinelInterval = setInterval(function () {
    var newTime = self.getCurrentTime()
    self._sentinelIntervalNumber++

    self._timeHasAdvanced = newTime ? (newTime > (self._timeAtLastSenintelInterval + 0.2)) : false
    self._sentinelTimeIsNearEnd = self._isNearToEnd(newTime || self._timeAtLastSenintelInterval)

    for (var i = 0; i < sentinels.length; i++) {
      var sentinelActionPerformed = sentinels[i].call(self)
      if (sentinelActionPerformed) {
        break
      }
    }

    self._timeAtLastSenintelInterval = newTime
  }, 1100)
}
CEHTMLPlayer.prototype._clearSentinels = function _clearSentinels () {
  clearInterval(this._sentinelInterval)
}
CEHTMLPlayer.prototype._enterBufferingSentinel = function _enterBufferingSentinel () {
  var sentinelBufferingRequired = !this._timeHasAdvanced && !this._sentinelTimeIsNearEnd && (this._sentinelIntervalNumber > 1)
  if (sentinelBufferingRequired) {
    this._emitEvent(this.EVENT.SENTINEL_ENTER_BUFFERING)
    this._toBuffering()
  }
  return sentinelBufferingRequired
}
CEHTMLPlayer.prototype._exitBufferingSentinel = function _exitBufferingSentinel () {
  var sentinelExitBufferingRequired = this._timeHasAdvanced
  if (sentinelExitBufferingRequired) {
    this._emitEvent(this.EVENT.SENTINEL_EXIT_BUFFERING)
    this._onFinishedBuffering()
  }
  return sentinelExitBufferingRequired
}
CEHTMLPlayer.prototype._shouldBeSeekedSentinel = function _shouldBeSeekedSentinel () {
  if (this._sentinelSeekTime === undefined) {
    return false
  }
  var currentTime = this.getCurrentTime()
  var clampedSentinelSeekTime = this._getClampedTime(this._sentinelSeekTime)
  var sentinelSeekRequired = Math.abs(clampedSentinelSeekTime - currentTime) > this._seekSentinelTolerance
  var sentinelActionTaken = false

  if (sentinelSeekRequired) {
    var mediaElement = this._mediaElement
    sentinelActionTaken = this._nextSentinelAttempt(this._sentinelLimits.seek, function () {
      mediaElement.seek(clampedSentinelSeekTime * 1000)
    })
  } else if (this._sentinelIntervalNumber < 3) {
    this._sentinelSeekTime = currentTime
  } else {
    this._sentinelSeekTime = undefined
  }
  return sentinelActionTaken
}
CEHTMLPlayer.prototype._shouldBePausedSentinel = function _shouldBePausedSentinel () {
  var sentinelPauseRequired = this._timeHasAdvanced
  var sentinelActionTaken = false
  if (sentinelPauseRequired) {
    var mediaElement = this._mediaElement
    sentinelActionTaken = this._nextSentinelAttempt(this._sentinelLimits.pause, function () {
      mediaElement.play(0)
    })
  }
  return sentinelActionTaken
}
CEHTMLPlayer.prototype._enterCompleteSentinel = function _enterCompleteSentinel () {
  var sentinelCompleteRequired = !this._timeHasAdvanced && this._sentinelTimeIsNearEnd
  if (sentinelCompleteRequired) {
    this._emitEvent(this.EVENT.SENTINEL_COMPLETE)
    this._onEndOfMedia()
  }
  return sentinelCompleteRequired
}
CEHTMLPlayer.prototype._nextSentinelAttempt = function _nextSentinelAttempt (sentinelInfo, attemptFn) {
  sentinelInfo.currentAttemptCount += 1
  var currentAttemptCount = sentinelInfo.currentAttemptCount
  var maxAttemptCount = sentinelInfo.maximumAttempts
  if (currentAttemptCount === maxAttemptCount + 1) {
    this._emitEvent(sentinelInfo.failureEvent)
  }
  if (currentAttemptCount <= maxAttemptCount) {
    attemptFn()
    this._emitEvent(sentinelInfo.successEvent)
    return true
  }
  return false
}
CEHTMLPlayer.prototype._setSeekSentinelTolerance = function _setSeekSentinelTolerance () {
  var ON_DEMAND_SEEK_SENTINEL_TOLERANCE = 15
  var LIVE_SEEK_SENTINEL_TOLERANCE = 30
  this._seekSentinelTolerance = ON_DEMAND_SEEK_SENTINEL_TOLERANCE
  if (this._isLiveMedia()) {
    this._seekSentinelTolerance = LIVE_SEEK_SENTINEL_TOLERANCE
  }
}

module.exports = CEHTMLPlayer
