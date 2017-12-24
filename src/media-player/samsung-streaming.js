var utils = require('../utils')
var MediaPlayer = require('./media-player')

var SamsungStreamingPlayer = utils.inherit(MediaPlayer, function init (rootId, config) {
  this.init(rootId, config)
  this._deferSeekingTo = null
  this._nextSeekingTo = null
  this._postBufferingState = null
  this._tryingToPause = false
  this._currentTimeKnown = false
  this._updatingTime = false
  this._lastWindowRanged = false

  try {
    this._registerSamsungPlugins()
  } catch (ignoreErr) {
  }
})
SamsungStreamingPlayer.prototype.PlayerEventCodes = {
  CONNECTION_FAILED: 1,
  AUTHENTICATION_FAILED: 2,
  STREAM_NOT_FOUND: 3,
  NETWORK_DISCONNECTED: 4,
  NETWORK_SLOW: 5,
  RENDER_ERROR: 6,
  RENDERING_START: 7,
  RENDERING_COMPLETE: 8,
  STREAM_INFO_READY: 9,
  DECODING_COMPLETE: 10,
  BUFFERING_START: 11,
  BUFFERING_COMPLETE: 12,
  BUFFERING_PROGRESS: 13,
  CURRENT_PLAYBACK_TIME: 14,
  AD_START: 15,
  AD_END: 16,
  RESOLUTION_CHANGED: 17,
  BITRATE_CHANGED: 18,
  SUBTITLE: 19,
  CUSTOM: 20
}
SamsungStreamingPlayer.prototype.PlayerEmps = {
  Player: 0,
  StreamingPlayer: 1
}
SamsungStreamingPlayer.prototype.CURRENT_TIME_TOLERANCE = 4
SamsungStreamingPlayer.prototype.CLAMP_OFFSET_FROM_END_OF_LIVE_RANGE = 10
SamsungStreamingPlayer.prototype.CLAMP_OFFSET_FROM_START_OF_RANGE = 1.1
SamsungStreamingPlayer.prototype.RANGE_UPDATE_TOLERANCE = 8
SamsungStreamingPlayer.prototype.RANGE_END_TOLERANCE = 100

SamsungStreamingPlayer.prototype.setSource = function setSource (mediaType, url, mimeType) {
  if (this.getState() === this.STATE.EMPTY) {
    this._type = mediaType
    this._source = url
    this._mimeType = mimeType
    this._registerEventHandlers()
    this._toStopped()

    if (this._isHlsMimeType()) {
      this._openStreamingPlayerPlugin()
      if (this._isLiveMedia()) {
        this._source += '|HLSSLIDING|COMPONENT=HLS'
      } else {
        this._source += '|COMPONENT=HLS'
      }
    } else {
      this._openPlayerPlugin()
    }

    this._initPlayer(this._source)
  } else {
    this._toError('Cannot set source unless in the \'' + this.STATE.EMPTY + '\' state')
  }
}
SamsungStreamingPlayer.prototype._registerSamsungPlugins = function () {
  var self = this
  this._playerPlugin = document.getElementById('sefPlayer')
  this.tvmwPlugin = document.getElementById('pluginObjectTVMW')

  this.originalSource = this.tvmwPlugin.GetSource()
  window.addEventListener('hide', function () {
    self.stop()
    self.tvmwPlugin.SetSource(self.originalSource)
  }, false)
}
SamsungStreamingPlayer.prototype._openPlayerPlugin = function () {
  if (this._currentPlayer !== undefined) {
    this._playerPlugin.Close()
  }
  this._playerPlugin.Open('Player', '1.010', 'Player')
  this._currentPlayer = this.PlayerEmps.Player
}
SamsungStreamingPlayer.prototype._closePlugin = function _closePlugin () {
  this._playerPlugin.Close()
  this._currentPlayer = undefined
}
SamsungStreamingPlayer.prototype._initPlayer = function _initPlayer (source) {
  var result = this._playerPlugin.Execute('InitPlayer', source)

  if (result !== 1) {
    this._toError('Failed to initialize video: ' + this._source)
  }
}
SamsungStreamingPlayer.prototype.resume = function () {
  this._postBufferingState = this.STATE.PLAYING
  switch (this.getState()) {
    case this.STATE.PLAYING:
      break

    case this.STATE.BUFFERING:
      if (this._tryingToPause) {
        this._tryingToPause = false
        this._toPlaying()
      }
      break

    case this.STATE.PAUSED:
      this._playerPlugin.Execute('Resume')

      this._toPlaying()
      break

    default:
      this._toError('Cannot resume while in the \'' + this.getState() + '\' state')
      break
  }
}
SamsungStreamingPlayer.prototype.playFrom = function playFrom (seconds) {
  this._postBufferingState = this.STATE.PLAYING
  var seekingTo = this._range ? this._getClampedTimeForPlayFrom(seconds) : seconds

  switch (this.getState()) {
    case this.STATE.BUFFERING:
      this._nextSeekingTo = seekingTo
      break

    case this.STATE.PLAYING:
      this._toBuffering()
      if (!this._currentTimeKnown) {
        this._deferSeekingTo = seekingTo
      } else if (this._isNearToCurrentTime(seekingTo)) {
        this._toPlaying()
      } else {
        this._seekToWithFailureStateTransition(seekingTo)
      }
      break

    case this.STATE.PAUSED:
      this._toBuffering()
      if (!this._currentTimeKnown) {
        this._deferSeekingTo = seekingTo
      } else if (this._isNearToCurrentTime(seekingTo)) {
        this._playerPlugin.Execute('Resume')
        this._toPlaying()
      } else {
        this._seekToWithFailureStateTransition(seekingTo)
        this._playerPlugin.Execute('Resume')
      }
      break

    case this.STATE.COMPLETE:
      this._playerPlugin.Execute('Stop')
      this._initPlayer(this._source)
      this._playerPlugin.Execute('StartPlayback', seekingTo)
      this._toBuffering()
      break

    default:
      this._toError('Cannot playFrom while in the \'' + this.getState() + '\' state')
      break
  }
}
SamsungStreamingPlayer.prototype.beginPlayback = function beginPlayback () {
  this._postBufferingState = this.STATE.PLAYING
  switch (this.getState()) {
    case this.STATE.STOPPED:
      this._toBuffering()
      this._playerPlugin.Execute('StartPlayback')
      break

    default:
      this._toError('Cannot beginPlayback while in the \'' + this.getState() + '\' state')
      break
  }
}
SamsungStreamingPlayer.prototype.beginPlaybackFrom = function beginPlaybackFrom (seconds) {
  this._postBufferingState = this.STATE.PLAYING
  var seekingTo = this.getSeekableRange() ? this._getClampedTimeForPlayFrom(seconds) : seconds

  // StartPlayback from near start of range causes spoiler defect
  if (seekingTo < this.CLAMP_OFFSET_FROM_START_OF_RANGE && this._isLiveMedia()) {
    seekingTo = this.CLAMP_OFFSET_FROM_START_OF_RANGE
  } else {
    seekingTo = parseInt(Math.floor(seekingTo), 10)
  }

  switch (this.getState()) {
    case this.STATE.STOPPED:
      this._playerPlugin.Execute('StartPlayback', seekingTo)

      this._toBuffering()
      break

    default:
      this._toError('Cannot beginPlayback while in the \'' + this.getState() + '\' state')
      break
  }
}
SamsungStreamingPlayer.prototype.pause = function pause () {
  this._postBufferingState = this.STATE.PAUSED
  switch (this.getState()) {
    case this.STATE.BUFFERING:
    case this.STATE.PAUSED:
      break

    case this.STATE.PLAYING:
      this._tryPauseWithStateTransition()
      break

    default:
      this._toError('Cannot pause while in the \'' + this.getState() + '\' state')
      break
  }
}
SamsungStreamingPlayer.prototype.stop = function stop () {
  switch (this.getState()) {
    case this.STATE.STOPPED:
      break

    case this.STATE.BUFFERING:
    case this.STATE.PLAYING:
    case this.STATE.PAUSED:
    case this.STATE.COMPLETE:
      this._stopPlayer()
      this._toStopped()
      break

    default:
      this._toError('Cannot stop while in the \'' + this.getState() + '\' state')
      break
  }
}
SamsungStreamingPlayer.prototype.reset = function reset () {
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
SamsungStreamingPlayer.prototype.getCurrentTime = function getCurrentTime () {
  if (this.getState() !== this.STATE.STOPPED) {
    return this._currentTime
  }
}
SamsungStreamingPlayer.prototype._isLiveRangeOutdated = function _isLiveRangeOutdated () {
  var time = Math.floor(this._currentTime)
  if (time % 8 === 0 && !this._updatingTime && this._lastWindowRanged !== time) {
    this._lastWindowRanged = time
    return true
  } else {
    return false
  }
}
SamsungStreamingPlayer.prototype._getMediaDuration = function _getMediaDuration () {
  if (this._range) {
    return this._range.end
  }
}
SamsungStreamingPlayer.prototype.getPlayerElement = function getPlayerElement () {
  return this._playerPlugin
}
SamsungStreamingPlayer.prototype._onFinishedBuffering = function _onFinishedBuffering () {
  if (this.getState() !== this.STATE.BUFFERING) {
    return
  }

  if (!this._isInitialBufferingFinished() && this._nextSeekingTo !== null) {
    this._deferSeekingTo = this._nextSeekingTo
    this._nextSeekingTo = null
  }

  if (this._deferSeekingTo === null) {
    if (this._postBufferingState === this.STATE.PAUSED) {
      this._tryPauseWithStateTransition()
    } else {
      this._toPlaying()
    }
  }
}
SamsungStreamingPlayer.prototype._onDeviceError = function _onDeviceError (message) {
  this._reportError(message)
}
SamsungStreamingPlayer.prototype._onDeviceBuffering = function _onDeviceBuffering () {
  if (this.getState() === this.STATE.PLAYING) {
    this._toBuffering()
  }
}
SamsungStreamingPlayer.prototype._onEndOfMedia = function _onEndOfMedia () {
  this._toComplete()
}
SamsungStreamingPlayer.prototype._stopPlayer = function _stopPlayer () {
  this._playerPlugin.Execute('Stop')

  this._currentTimeKnown = false
}
SamsungStreamingPlayer.prototype._tryPauseWithStateTransition = function _tryPauseWithStateTransition () {
  var success = this._playerPlugin.Execute('Pause')
  success = success && (success !== -1)

  if (success) {
    this._toPaused()
  }

  this._tryingToPause = !success
}
SamsungStreamingPlayer.prototype._onStatus = function _onStatus () {
  var state = this.getState()
  if (state === this.STATE.PLAYING) {
    this._emitEvent(this.EVENT.STATUS)
  }
}
SamsungStreamingPlayer.prototype._updateRange = function _updateRange () {
  var self = this
  if (this._isHlsMimeType() && this._isLiveMedia()) {
    var range = this._playerPlugin.Execute('GetPlayingRange').split('-')
    this._range = {
      start: Math.floor(range[0]),
      end: Math.floor(range[1])
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
SamsungStreamingPlayer.prototype._onCurrentTime = function _onCurrentTime (timeInMillis) {
  this._currentTime = timeInMillis / 1000
  this._onStatus()
  this._currentTimeKnown = true

  // [optimisation] do not call player API periodically in HLS live
  // - calculate range manually when possible
  // - do not calculate range if player API was called less than RANGE_UPDATE_TOLERANCE seconds ago
  if (this._isLiveMedia() && this._isLiveRangeOutdated()) {
    this._range.start += 8
    this._range.end += 8
  }

  if (this._nextSeekingTo !== null) {
    this._deferSeekingTo = this._nextSeekingTo
    this._nextSeekingTo = null
  }

  if (this._deferSeekingTo !== null) {
    this._deferredSeek()
  }

  if (this._tryingToPause) {
    this._tryPauseWithStateTransition()
  }
}
SamsungStreamingPlayer.prototype._deferredSeek = function _deferredSeek () {
  var clampedTime = this._getClampedTimeForPlayFrom(this._deferSeekingTo)
  var isNearCurrentTime = this._isNearToCurrentTime(clampedTime)

  if (isNearCurrentTime) {
    this._toPlaying()
    this._deferSeekingTo = null
  } else {
    var seekResult = this._seekTo(clampedTime)
    if (seekResult) {
      this._deferSeekingTo = null
    }
  }
}
SamsungStreamingPlayer.prototype._getClampedTimeForPlayFrom = function _getClampedTimeForPlayFrom (seconds) {
  if (this._currentPlayer === this.PlayerEmps.StreamingPlayer && !this._updatingTime) {
    this._updateRange()
  }
  var clampedTime = this._getClampedTime(seconds)
  return clampedTime
}
SamsungStreamingPlayer.prototype._getClampOffsetFromConfig = function _getClampOffsetFromConfig () {
  var clampOffsetFromEndOfRange
  if (this._config && this._config.streaming && this._config.streaming.overrides) {
    clampOffsetFromEndOfRange = this._config.streaming.overrides.clampOffsetFromEndOfRange
  }

  if (clampOffsetFromEndOfRange !== undefined) {
    return clampOffsetFromEndOfRange
  } else if (this._isLiveMedia()) {
    return this.CLAMP_OFFSET_FROM_END_OF_LIVE_RANGE
  } else {
    return this.CLAMP_OFFSET_FROM_END_OF_RANGE
  }
}
SamsungStreamingPlayer.prototype._registerEventHandlers = function _registerEventHandlers () {
  var self = this
  this._playerPlugin.OnEvent = function (eventType, param1) {
    switch (eventType) {
      case self.PlayerEventCodes.STREAM_INFO_READY:
        self._updateRange()
        break

      case self.PlayerEventCodes.CURRENT_PLAYBACK_TIME:
        if (self._range && self._isLiveMedia()) {
          var seconds = Math.floor(param1 / 1000)
              // jump to previous current time if PTS out of range occurs
          if (seconds > self._range.end + self.RANGE_END_TOLERANCE) {
            self.playFrom(self._currentTime)
            break
              // call GetPlayingRange() on SEF emp if current time is out of range
          } else if (!self._isCurrentTimeInRangeTolerance(seconds)) {
            self._updateRange()
          }
        }
        self._onCurrentTime(param1)
        break

      case self.PlayerEventCodes.BUFFERING_START:
      case self.PlayerEventCodes.BUFFERING_PROGRESS:
        self._onDeviceBuffering()
        break

      case self.PlayerEventCodes.BUFFERING_COMPLETE:
          // For live HLS, don't update the range more than once every 8 seconds
        if (!self._updatingTime) {
          self._updateRange()
        }
          // [optimisation] if Stop() is not called after RENDERING_COMPLETE then player sends periodically BUFFERING_COMPLETE and RENDERING_COMPLETE
          // ignore BUFFERING_COMPLETE if player is already in COMPLETE state
        if (self.getState() !== this.STATE.COMPLETE) {
          self._onFinishedBuffering()
        }
        break

      case self.PlayerEventCodes.RENDERING_COMPLETE:
          // [optimisation] if Stop() is not called after RENDERING_COMPLETE then player sends periodically BUFFERING_COMPLETE and RENDERING_COMPLETE
          // ignore RENDERING_COMPLETE if player is already in COMPLETE state
        if (self.getState() !== this.STATE.COMPLETE) {
          self._onEndOfMedia()
        }
        break

      case self.PlayerEventCodes.CONNECTION_FAILED:
        self._onDeviceError('Media element emitted OnConnectionFailed')
        break

      case self.PlayerEventCodes.NETWORK_DISCONNECTED:
        self._onDeviceError('Media element emitted OnNetworkDisconnected')
        break

      case self.PlayerEventCodes.AUTHENTICATION_FAILED:
        self._onDeviceError('Media element emitted OnAuthenticationFailed')
        break

      case self.PlayerEventCodes.RENDER_ERROR:
        self._onDeviceError('Media element emitted OnRenderError')
        break

      case self.PlayerEventCodes.STREAM_NOT_FOUND:
        self._onDeviceError('Media element emitted OnStreamNotFound')
        break
    }
  }

  window.addEventListener('hide', this.stop.bind(this), false)
  window.addEventListener('unload', this.stop.bind(this), false)
}
SamsungStreamingPlayer.prototype._unregisterEventHandlers = function _unregisterEventHandlers () {
  this._playerPlugin.OnEvent = undefined
  window.removeEventListener('hide', this.stop.bind(this), false)
  window.removeEventListener('unload', this.stop.bind(this), false)
}
SamsungStreamingPlayer.prototype._wipe = function _wipe () {
  this._stopPlayer()
  this._closePlugin()
  this._unregisterEventHandlers()
  this._type = undefined
  this._source = undefined
  this._mimeType = undefined
  this._currentTime = undefined
  this._range = undefined
  this._deferSeekingTo = null
  this._nextSeekingTo = null
  this._tryingToPause = false
  this._currentTimeKnown = false
  this._updatingTime = false
  this._lastWindowRanged = false
}
SamsungStreamingPlayer.prototype._seekTo = function _seekTo (seconds) {
  var offset = seconds - this.getCurrentTime()
  var success = this._jump(offset)

  if (success === 1) {
    this._currentTime = seconds
  }

  return success
}
SamsungStreamingPlayer.prototype._seekToWithFailureStateTransition = function _seekToWithFailureStateTransition (seconds) {
  var success = this._seekTo(seconds)
  if (success !== 1) {
    this._toPlaying()
  }
}
SamsungStreamingPlayer.prototype._jump = function _jump (offsetSeconds) {
  if (offsetSeconds > 0) {
    return this._playerPlugin.Execute('JumpForward', offsetSeconds)
  } else {
    return this._playerPlugin.Execute('JumpBackward', Math.abs(offsetSeconds))
  }
}
SamsungStreamingPlayer.prototype._isHlsMimeType = function _isHlsMimeType () {
  var mime = this._mimeType.toLowerCase()
  return mime === 'application/vnd.apple.mpegurl' || mime === 'application/x-mpegurl'
}
SamsungStreamingPlayer.prototype._isCurrentTimeInRangeTolerance = function _isCurrentTimeInRangeTolerance (seconds) {
  if (seconds > this._range.end + this.RANGE_UPDATE_TOLERANCE ||
    seconds < this._range.start - this.RANGE_UPDATE_TOLERANCE) {
    return false
  } else {
    return true
  }
}
SamsungStreamingPlayer.prototype._isInitialBufferingFinished = function _isInitialBufferingFinished () {
  if (this._currentTime === undefined || this._currentTime === 0) {
    return false
  } else {
    return true
  }
}
SamsungStreamingPlayer.prototype._reportError = function _reportError (errorMessage) {
  this._emitEvent(this.EVENT.ERROR, {'errorMessage': errorMessage})
}
SamsungStreamingPlayer.prototype._toStopped = function _toStopped () {
  this._currentTime = 0
  this._range = undefined
  this._state = this.STATE.STOPPED
  this._emitEvent(this.EVENT.STOPPED)
}
SamsungStreamingPlayer.prototype._toBuffering = function _toBuffering () {
  this._state = this.STATE.BUFFERING
  this._emitEvent(this.EVENT.BUFFERING)
}
SamsungStreamingPlayer.prototype._toPlaying = function _toPlaying () {
  if (this._isHlsMimeType() && this._isLiveMedia() && !this._updatingTime) {
    this._updateRange()
  }
  this._state = this.STATE.PLAYING
  this._emitEvent(this.EVENT.PLAYING)
}
SamsungStreamingPlayer.prototype._toPaused = function _toPaused () {
  this._state = this.STATE.PAUSED
  this._emitEvent(this.EVENT.PAUSED)
}
SamsungStreamingPlayer.prototype._toComplete = function _toComplete () {
  this._state = this.STATE.COMPLETE
  this._emitEvent(this.EVENT.COMPLETE)
}
SamsungStreamingPlayer.prototype._toEmpty = function _toEmpty () {
  this._wipe()
  this._state = this.STATE.EMPTY
}

module.exports = SamsungStreamingPlayer
