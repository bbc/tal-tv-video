var CallbackManager = require('./callback-manager')

function MediaPlayer (rootId, config) {
  this._rootId = rootId
  this._config = config
  this._callbackManager = new CallbackManager()
  this._setSentinelLimits()
  this._state = this.STATE.EMPTY
}
MediaPlayer.prototype.STATE = {
  EMPTY: 'EMPTY',     // No source set
  STOPPED: 'STOPPED',   // Source set but no playback
  BUFFERING: 'BUFFERING', // Not enough data to play, waiting to download more
  PLAYING: 'PLAYING',   // Media is playing
  PAUSED: 'PAUSED',    // Media is paused
  COMPLETE: 'COMPLETE',  // Media has reached its end point
  ERROR: 'ERROR'      // An error occurred
}
MediaPlayer.prototype.EVENT = {
  STOPPED: 'stopped',   // Event fired when playback is stopped
  BUFFERING: 'buffering', // Event fired when playback has to suspend due to buffering
  PLAYING: 'playing',   // Event fired when starting (or resuming) playing of the media
  PAUSED: 'paused',    // Event fired when media playback pauses
  COMPLETE: 'complete',  // Event fired when media playback has reached the end of the media
  ERROR: 'error',     // Event fired when an error condition occurs
  STATUS: 'status',    // Event fired regularly during play
  SENTINEL_ENTER_BUFFERING: 'sentinel-enter-buffering', // Event fired when a sentinel has to act because the device has started buffering but not reported it
  SENTINEL_EXIT_BUFFERING: 'sentinel-exit-buffering',  // Event fired when a sentinel has to act because the device has finished buffering but not reported it
  SENTINEL_PAUSE: 'sentinel-pause',           // Event fired when a sentinel has to act because the device has failed to pause when expected
  SENTINEL_PLAY: 'sentinel-play',            // Event fired when a sentinel has to act because the device has failed to play when expected
  SENTINEL_SEEK: 'sentinel-seek',            // Event fired when a sentinel has to act because the device has failed to seek to the correct location
  SENTINEL_COMPLETE: 'sentinel-complete',        // Event fired when a sentinel has to act because the device has completed the media but not reported it
  SENTINEL_PAUSE_FAILURE: 'sentinel-pause-failure',   // Event fired when the pause sentinel has failed twice, so it is giving up
  SENTINEL_SEEK_FAILURE: 'sentinel-seek-failure',     // Event fired when the seek sentinel has failed twice, so it is giving up
  SEEK_ATTEMPTED: 'seek-attempted', // Event fired when a device using a seekfinishedemitevent modifier sets the source
  SEEK_FINISHED: 'seek-finished'    // Event fired when a device using a seekfinishedemitevent modifier has seeked successfully
}
MediaPlayer.prototype.TYPE = {
  VIDEO: 'video',
  AUDIO: 'audio',
  LIVE_VIDEO: 'live-video',
  LIVE_AUDIO: 'live-audio'
}
MediaPlayer.prototype.LIVE_SUPPORT = {
  NONE: 'none',
  PLAYABLE: 'playable',
  RESTARTABLE: 'restartable',
  SEEKABLE: 'seekable'
}

MediaPlayer.prototype.CLAMP_OFFSET_FROM_END_OF_RANGE = 1.1
MediaPlayer.prototype.CURRENT_TIME_TOLERANCE = 1
MediaPlayer.prototype.addEventCallback = function addEventCallback (thisArg, callback) {
  this._callbackManager.addCallback(thisArg, callback)
}
MediaPlayer.prototype.removeEventCallback = function removeEventCallback (thisArg, callback) {
  this._callbackManager.removeCallback(thisArg, callback)
}
MediaPlayer.prototype.removeAllEventCallbacks = function removeAllEventCallbacks () {
  this._callbackManager.removeAllCallbacks()
}
MediaPlayer.prototype._emitEvent = function _emitEvent (eventType, eventLabels) {
  var event = {
    type: eventType,
    currentTime: this.getCurrentTime(),
    seekableRange: this.getSeekableRange(),
    duration: this.getDuration(),
    url: this.getSource(),
    mimeType: this.getMimeType(),
    state: this.getState()
  }
  if (eventLabels) {
    for (var key in eventLabels) {
      if (eventLabels.hasOwnProperty(key)) {
        event[key] = eventLabels[key]
      }
    }
  }
  this._callbackManager.callAll(event)
}
MediaPlayer.prototype._getClampedTime = function _getClampedTime (seconds) {
  var range = this.getSeekableRange()
  var offsetFromEnd = this._getClampOffsetFromConfig()
  var nearToEnd = Math.max(range.end - offsetFromEnd, range.start)
  if (seconds < range.start) {
    return range.start
  } else if (seconds > nearToEnd) {
    return nearToEnd
  } else {
    return seconds
  }
}
MediaPlayer.prototype._isNearToCurrentTime = function _isNearToCurrentTime (seconds) {
  var currentTime = this.getCurrentTime()
  var targetTime = this._getClampedTime(seconds)
  return Math.abs(currentTime - targetTime) <= this.CURRENT_TIME_TOLERANCE
}

MediaPlayer.prototype.getDuration = function getDuration () {
  switch (this.getState()) {
    case this.STATE.STOPPED:
    case this.STATE.ERROR:
      return
    default :
      if (this._isLiveMedia()) {
        return Infinity
      }
      return this._getMediaDuration()
  }
}
MediaPlayer.prototype._getClampOffsetFromConfig = function _getClampOffsetFromConfig () {
  var clampOffsetFromEndOfRange
  if (this._config && this._config.streaming && this._config.streaming.overrides) {
    clampOffsetFromEndOfRange = this._config.streaming.overrides.clampOffsetFromEndOfRange
  }

  return clampOffsetFromEndOfRange || this.CLAMP_OFFSET_FROM_END_OF_RANGE
}
MediaPlayer.prototype._isLiveMedia = function _isLiveMedia () {
  return (this._type === this.TYPE.LIVE_VIDEO) || (this._type === this.TYPE.LIVE_AUDIO)
}
MediaPlayer.prototype._setSentinelLimits = function _setSentinelLimits () {
  this._sentinelLimits = {
    pause: {
      maximumAttempts: 2,
      successEvent: this.EVENT.SENTINEL_PAUSE,
      failureEvent: this.EVENT.SENTINEL_PAUSE_FAILURE,
      currentAttemptCount: 0
    },
    seek: {
      maximumAttempts: 2,
      successEvent: this.EVENT.SENTINEL_SEEK,
      failureEvent: this.EVENT.SENTINEL_SEEK_FAILURE,
      currentAttemptCount: 0
    }
  }
}
MediaPlayer.prototype.getSource = function getSource () {
  return this._source
}
MediaPlayer.prototype.getMimeType = function getMimeType () {
  return this._mimeType
}
MediaPlayer.prototype.getState = function getState () {
  return this._state
}
MediaPlayer.prototype.getPlayerElement = function getPlayerElement () {
  return this._mediaElement
}
MediaPlayer.prototype._onDeviceError = function _onDeviceError () {
  this._reportError('Media element error code: ' + this._mediaElement.error.code)
}
MediaPlayer.prototype._toError = function _toError (errorMessage) {
  this._wipe()
  this._state = this.STATE.ERROR
  this._reportError(errorMessage)
  throw new Error('ApiError: ' + errorMessage)
}
MediaPlayer.prototype.getSeekableRange = function getSeekableRange () {
  var state = this.getState()
  if (state !== this.STATE.STOPPED && state !== this.STATE.ERROR) {
    return this._getSeekableRange()
  }
}

module.exports = MediaPlayer
