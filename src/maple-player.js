var utils = require('./utils')
var MediaPlayer = require('./media-player')

var MaplePlayer = utils.inherit(MediaPlayer, function init (rootId, config) {
  this.init(rootId, config)
  this._state = this.STATE.EMPTY
  this._playerPlugin = document.getElementById('playerPlugin')
  this._deferSeekingTo = null
  this._postBufferingState = null
  this._tryingToPause = false
  this._currentTimeKnown = false
  this.CURRENT_TIME_TOLERANCE = 2.5
})
MaplePlayer.prototype.setSource = function setSource (mediaType, url, mimeType) {
  if (this.getState() === this.STATE.EMPTY) {
    this._type = mediaType
    this._source = url
    this._mimeType = mimeType
    this._registerEventHandlers()
    this._toStopped()
  } else {
    this._toError('Cannot set source unless in the \'' + this.STATE.EMPTY + '\' state')
  }
}
MaplePlayer.prototype.resume = function () {
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
      this._playerPlugin.Resume()
      this._toPlaying()
      break

    default:
      this._toError('Cannot resume while in the \'' + this.getState() + '\' state')
      break
  }
}
MaplePlayer.prototype.beginPlayback = function beginPlayback () {
  this._postBufferingState = this.STATE.PLAYING
  switch (this.getState()) {
    case this.STATE.STOPPED:
      this._toBuffering()
      this._setDisplayFullScreenForVideo()
      this._playerPlugin.Play(this._wrappedSource())
      break

    default:
      this._toError('Cannot beginPlayback while in the \'' + this.getState() + '\' state')
      break
  }
}
MaplePlayer.prototype.beginPlaybackFrom = function beginPlaybackFrom (seconds) {
  this._postBufferingState = this.STATE.PLAYING
  var seekingTo = this._range ? this._getClampedTimeForPlayFrom(seconds) : seconds

  switch (this.getState()) {
    case this.STATE.STOPPED:
      this._setDisplayFullScreenForVideo()
      this._playerPlugin.ResumePlay(this._wrappedSource(), seekingTo)
      this._toBuffering()
      break

    default:
      this._toError('Cannot beginPlayback while in the \'' + this.getState() + '\' state')
      break
  }
}
MaplePlayer.prototype.pause = function pause () {
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
MaplePlayer.prototype.stop = function stop () {
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
MaplePlayer.prototype.reset = function reset () {
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
MaplePlayer.prototype.getCurrentTime = function getCurrentTime () {
  if (this.getState() !== this.STATE.STOPPED) {
    return this._currentTime
  }
}
MaplePlayer.prototype.getSeekableRange = function getSeekableRange () {
  return this._range
}
MaplePlayer.prototype._getMediaDuration = function _getMediaDuration () {
  if (this._range) {
    return this._range.end
  }
}
MaplePlayer.prototype.getPlayerElement = function getPlayerElement () {
  return this._playerPlugin
}
MaplePlayer.prototype._onFinishedBuffering = function _onFinishedBuffering () {
  if (this.getState() !== this.STATE.BUFFERING) {
    return
  }

  if (this._deferSeekingTo === null) {
    if (this._postBufferingState === this.STATE.PAUSED) {
      this._tryPauseWithStateTransition()
    } else {
      this._toPlaying()
    }
  }
}
MaplePlayer.prototype._onDeviceError = function _onDeviceError (message) {
  this._reportError(message)
}
MaplePlayer.prototype._onDeviceBuffering = function _onDeviceBuffering () {
  if (this.getState() === this.STATE.PLAYING) {
    this._toBuffering()
  }
}
MaplePlayer.prototype._onEndOfMedia = function _onEndOfMedia () {
  this._toComplete()
}
MaplePlayer.prototype._stopPlayer = function _stopPlayer () {
  this._playerPlugin.Stop()
  this._currentTimeKnown = false
}
MaplePlayer.prototype._tryPauseWithStateTransition = function _tryPauseWithStateTransition () {
  var success = this._isSuccessCode(this._playerPlugin.Pause())
  if (success) {
    this._toPaused()
  }

  this._tryingToPause = !success
}
MaplePlayer.prototype._onStatus = function _onStatus () {
  var state = this.getState()
  if (state === this.STATE.PLAYING) {
    this._emitEvent(this.EVENT.STATUS)
  }
}
MaplePlayer.prototype._onMetadata = function _onMetadata () {
  this._range = {
    start: 0,
    end: this._playerPlugin.GetDuration() / 1000
  }
}
MaplePlayer.prototype._onCurrentTime = function _onCurrentTime (timeInMillis) {
  this._currentTime = timeInMillis / 1000
  this._onStatus()
  this._currentTimeKnown = true

  if (this._deferSeekingTo !== null) {
    this._deferredSeek()
  }

  if (this._tryingToPause) {
    this._tryPauseWithStateTransition()
  }
}
MaplePlayer.prototype._deferredSeek = function _deferredSeek () {
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
MaplePlayer.prototype._getClampedTimeForPlayFrom = function _getClampedTimeForPlayFrom (seconds) {
  var clampedTime = this._getClampedTime(seconds)
  return clampedTime
}
MaplePlayer.prototype._registerEventHandlers = function _registerEventHandlers () {
  var self = this

  window.SamsungMapleOnRenderError = function () {
    self._onDeviceError('Media element emitted OnRenderError')
  }
  this._playerPlugin.OnRenderError = 'SamsungMapleOnRenderError'

  window.SamsungMapleOnConnectionFailed = function () {
    self._onDeviceError('Media element emitted OnConnectionFailed')
  }
  this._playerPlugin.OnConnectionFailed = 'SamsungMapleOnConnectionFailed'

  window.SamsungMapleOnNetworkDisconnected = function () {
    self._onDeviceError('Media element emitted OnNetworkDisconnected')
  }
  this._playerPlugin.OnNetworkDisconnected = 'SamsungMapleOnNetworkDisconnected'

  window.SamsungMapleOnStreamNotFound = function () {
    self._onDeviceError('Media element emitted OnStreamNotFound')
  }
  this._playerPlugin.OnStreamNotFound = 'SamsungMapleOnStreamNotFound'

  window.SamsungMapleOnAuthenticationFailed = function () {
    self._onDeviceError('Media element emitted OnAuthenticationFailed')
  }
  this._playerPlugin.OnAuthenticationFailed = 'SamsungMapleOnAuthenticationFailed'

  window.SamsungMapleOnRenderingComplete = this._onEndOfMedia.bing(this)
  this._playerPlugin.OnRenderingComplete = 'SamsungMapleOnRenderingComplete'

  window.SamsungMapleOnBufferingStart = this._onDeviceBuffering.bind(this)
  this._playerPlugin.OnBufferingStart = 'SamsungMapleOnBufferingStart'

  window.SamsungMapleOnBufferingComplete = this._onFinishedBuffering.bind(this)
  this._playerPlugin.OnBufferingComplete = 'SamsungMapleOnBufferingComplete'

  window.SamsungMapleOnStreamInfoReady = this._onMetadata.bind(this)
  this._playerPlugin.OnStreamInfoReady = 'SamsungMapleOnStreamInfoReady'

  window.SamsungMapleOnCurrentPlayTime = this._onCurrentTime.bind(this)

  this._playerPlugin.OnCurrentPlayTime = 'SamsungMapleOnCurrentPlayTime'

  window.addEventListener('hide', this.stop.bind(this), false)
  window.addEventListener('unload', this.stop.bind(this), false)
}

MaplePlayer.prototype._unregisterEventHandlers = function _unregisterEventHandlers () {
  var eventHandlers = [
    'SamsungMapleOnRenderError',
    'SamsungMapleOnRenderingComplete',
    'SamsungMapleOnBufferingStart',
    'SamsungMapleOnBufferingComplete',
    'SamsungMapleOnStreamInfoReady',
    'SamsungMapleOnCurrentPlayTime',
    'SamsungMapleOnConnectionFailed',
    'SamsungMapleOnNetworkDisconnected',
    'SamsungMapleOnStreamNotFound',
    'SamsungMapleOnAuthenticationFailed'
  ]

  for (var i = 0; i < eventHandlers.length; i++) {
    var handler = eventHandlers[i]
    var hook = handler.substring('SamsungMaple'.length)
    this._playerPlugin[hook] = undefined

    delete window[handler]
  }

  window.removeEventListener('hide', this.stop.bind(this), false)
  window.removeEventListener('unload', this.stop.bind(this), false)
}
MaplePlayer.prototype._wipe = function _wipe () {
  this._stopPlayer()
  this._type = undefined
  this._source = undefined
  this._mimeType = undefined
  this._currentTime = undefined
  this._range = undefined
  this._deferSeekingTo = null
  this._tryingToPause = false
  this._currentTimeKnown = false
  this._unregisterEventHandlers()
}
MaplePlayer.prototype._seekTo = function _seekTo (seconds) {
  var offset = seconds - this.getCurrentTime()
  var success = this._isSuccessCode(this._jump(offset))

  if (success) {
    this._currentTime = seconds
  }

  return success
}
MaplePlayer.prototype._seekToWithFailureStateTransition = function _seekToWithFailureStateTransition (seconds) {
  var success = this._seekTo(seconds)
  if (!success) {
    this._toPlaying()
  }
}
MaplePlayer.prototype._jump = function _jump (offsetSeconds) {
  if (offsetSeconds > 0) {
    return this._playerPlugin.JumpForward(offsetSeconds)
  } else {
    return this._playerPlugin.JumpBackward(Math.abs(offsetSeconds))
  }
}
MaplePlayer.prototype._isHlsMimeType = function _isHlsMimeType () {
  var mime = this._mimeType.toLowerCase()
  return mime === 'application/vnd.apple.mpegurl' || mime === 'application/x-mpegurl'
}
MaplePlayer.prototype._wrappedSource = function _wrappedSource () {
  var source = this._source
  if (this._isHlsMimeType()) {
    source += '|COMPONENT=HLS'
  }
  return source
}
MaplePlayer.prototype._reportError = function _reportError (errorMessage) {
  this._emitEvent(this.EVENT.ERROR, {'errorMessage': errorMessage})
}
MaplePlayer.prototype._toStopped = function _toStopped () {
  this._currentTime = 0
  this._range = undefined
  this._state = this.STATE.STOPPED
  this._emitEvent(this.EVENT.STOPPED)
}
MaplePlayer.prototype._toBuffering = function _toBuffering () {
  this._state = this.STATE.BUFFERING
  this._emitEvent(this.EVENT.BUFFERING)
}
MaplePlayer.prototype._toPlaying = function _toPlaying () {
  this._state = this.STATE.PLAYING
  this._emitEvent(this.EVENT.PLAYING)
}
MaplePlayer.prototype._toPaused = function _toPaused () {
  this._state = this.STATE.PAUSED
  this._emitEvent(this.EVENT.PAUSED)
}
MaplePlayer.prototype._toComplete = function _toComplete () {
  this._state = this.STATE.COMPLETE
  this._emitEvent(this.EVENT.COMPLETE)
}
MaplePlayer.prototype._toEmpty = function _toEmpty () {
  this._wipe()
  this._state = this.STATE.EMPTY
}
MaplePlayer.prototype._setDisplayFullScreenForVideo = function _setDisplayFullScreenForVideo () {
  if (this._type === this.TYPE.VIDEO) {
    var dimensions = utils.getScreenSize()
    this._playerPlugin.SetDisplayArea(0, 0, dimensions.width, dimensions.height)
  }
}
MaplePlayer.prototype._isSuccessCode = function _isSuccessCode (code) {
  var samsung2010ErrorCode = -1
  return code && code !== samsung2010ErrorCode
}
module.exports = MaplePlayer
