var utils = require('../utils')
var MediaPlayer = require('./media')

var HTMLPlayer = utils.inherit(MediaPlayer)
HTMLPlayer.prototype.setSource = function setSource (mediaType, url, mimeType) {
  if (this.getState() === this.STATE.EMPTY) {
    this._trustZeroes = false
    this._ignoreNextPauseEvent = false
    this._type = mediaType
    this._source = url
    this._mimeType = mimeType
    var idSuffix = 'Video'
    if (mediaType === this.TYPE.AUDIO || mediaType === this.TYPE.LIVE_AUDIO) {
      idSuffix = 'Audio'
    }
    this._setSeekSentinelTolerance()
    this._mediaElement = utils.createElement(idSuffix.toLowerCase(), 'mediaPlayer' + idSuffix)
    this._mediaElement.autoplay = false
    this._mediaElement.style.position = 'absolute'
    this._mediaElement.style.top = '0px'
    this._mediaElement.style.left = '0px'
    this._mediaElement.style.width = '100%'
    this._mediaElement.style.height = '100%'
    this._mediaElement.addEventListener('canplay', this._onFinishedBuffering.bind(this), false)
    this._mediaElement.addEventListener('seeked', this._onFinishedBuffering.bind(this), false)
    this._mediaElement.addEventListener('playing', this._onFinishedBuffering.bind(this), false)
    this._mediaElement.addEventListener('error', this._onDeviceError.bind(this), false)
    this._mediaElement.addEventListener('ended', this._onEndOfMedia.bind(this), false)
    this._mediaElement.addEventListener('waiting', this._onDeviceBuffering.bind(this), false)
    this._mediaElement.addEventListener('timeupdate', this._onStatus.bind(this), false)
    this._mediaElement.addEventListener('loadedmetadata', this._onMetadata.bind(this), false)
    this._mediaElement.addEventListener('pause', this._onPause.bind(this), false)

    utils.prependChildElement(document.getElementById(this._rootId), this._mediaElement)

    this._sourceElement = this._generateSourceElement(url, mimeType)
    this._sourceElement.addEventListener('error', this._onSourceError.bind(this), false)

    this._mediaElement.preload = 'auto'
    this._mediaElement.appendChild(this._sourceElement)
    this._mediaElement.load()

    this._toStopped()
  } else {
    this._toError('Cannot set source unless in the \'' + this.STATE.EMPTY + '\' state')
  }
}
HTMLPlayer.prototype.playFrom = function playFrom (seconds) {
  this._postBufferingState = this.STATE.PLAYING
  this._targetSeekTime = seconds
  this._sentinelLimits.seek.currentAttemptCount = 0

  switch (this.getState()) {
    case this.STATE.PAUSED:
    case this.STATE.COMPLETE:
      this._trustZeroes = true
      this._toBuffering()
      this._playFromIfReady()
      break

    case this.STATE.BUFFERING:
      this._playFromIfReady()
      break

    case this.STATE.PLAYING:
      this._trustZeroes = true
      this._toBuffering()
      this._targetSeekTime = this._getClampedTimeForPlayFrom(seconds)
      if (this._isNearToCurrentTime(this._targetSeekTime)) {
        this._targetSeekTime = undefined
        this._toPlaying()
      } else {
        this._playFromIfReady()
      }
      break

    default:
      this._toError('Cannot playFrom while in the \'' + this.getState() + '\' state')
      break
  }
}
HTMLPlayer.prototype.beginPlayback = function beginPlayback () {
  this._postBufferingState = this.STATE.PLAYING
  this._sentinelSeekTime = undefined
  switch (this.getState()) {
    case this.STATE.STOPPED:
      this._trustZeroes = true
      this._toBuffering()
      this._mediaElement.play()
      break

    default:
      this._toError('Cannot beginPlayback while in the \'' + this.getState() + '\' state')
      break
  }
}
HTMLPlayer.prototype.beginPlaybackFrom = function beginPlaybackFrom (seconds) {
  this._postBufferingState = this.STATE.PLAYING
  this._targetSeekTime = seconds
  this._sentinelLimits.seek.currentAttemptCount = 0

  switch (this.getState()) {
    case this.STATE.STOPPED:
      this._trustZeroes = true
      this._toBuffering()
      this._playFromIfReady()
      break

    default:
      this._toError('Cannot beginPlaybackFrom while in the \'' + this.getState() + '\' state')
      break
  }
}
HTMLPlayer.prototype.pause = function pause () {
  this._postBufferingState = this.STATE.PAUSED
  switch (this.getState()) {
    case this.STATE.PAUSED:
      break

    case this.STATE.BUFFERING:
      this._sentinelLimits.pause.currentAttemptCount = 0
      if (this._isReadyToPlayFrom()) {
        // If we are not ready to playFrom, then calling
        // pause would seek to the start of media, which we might not want.
        this._pauseMediaElement()
      }
      break

    case this.STATE.PLAYING:
      this._sentinelLimits.pause.currentAttemptCount = 0
      this._pauseMediaElement()
      this._toPaused()
      break

    default:
      this._toError('Cannot pause while in the \'' + this.getState() + '\' state')
      break
  }
}

HTMLPlayer.prototype.resume = function resume () {
  this._postBufferingState = this.STATE.PLAYING
  switch (this.getState()) {
    case this.STATE.PLAYING:
      break

    case this.STATE.BUFFERING:
      if (this._isReadyToPlayFrom()) {
        // If we are not ready to playFrom, then calling play
        // would seek to the start of media, which we might not want.
        this._mediaElement.play()
      }
      break

    case this.STATE.PAUSED:
      this._mediaElement.play()
      this._toPlaying()
      break

    default:
      this._toError('Cannot resume while in the \'' + this.getState() + '\' state')
      break
  }
}
HTMLPlayer.prototype.stop = function stop () {
  switch (this.getState()) {
    case this.STATE.STOPPED:
      break

    case this.STATE.BUFFERING:
    case this.STATE.PLAYING:
    case this.STATE.PAUSED:
    case this.STATE.COMPLETE:
      this._pauseMediaElement()
      this._toStopped()
      break

    default:
      this._toError('Cannot stop while in the \'' + this.getState() + '\' state')
      break
  }
}
HTMLPlayer.reset = function reset () {
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
HTMLPlayer.prototype.getCurrentTime = function getCurrentTime () {
  var state = this.getState()
  if (this._mediaElement && state !== this.STATE.STOPPED && state !== this.STATE.ERROR) {
    return this._mediaElement.currentTime
  }
}
HTMLPlayer.prototype._getMediaDuration = function _getMediaDuration () {
  if (this._mediaElement && this._isReadyToPlayFrom()) {
    return this._mediaElement.duration
  }
}
HTMLPlayer.prototype._getSeekableRange = function _getSeekableRange () {
  if (!this._mediaElement) return
  if (this._isReadyToPlayFrom() && this._mediaElement.seekable && this._mediaElement.seekable.length > 0) {
    return {
      start: this._mediaElement.seekable.start(0),
      end: this._mediaElement.seekable.end(0)
    }
  } else if (this._mediaElement.duration !== undefined) {
    return {
      start: 0,
      end: this._mediaElement.duration
    }
  }
}
HTMLPlayer.prototype._onFinishedBuffering = function _onFinishedBuffering () {
  this._exitBuffering()
}
HTMLPlayer.prototype._pauseMediaElement = function _pauseMediaElement () {
  this._mediaElement.pause()
  this._ignoreNextPauseEvent = true
}
HTMLPlayer.prototype._onPause = function _onPause () {
  if (this._ignoreNextPauseEvent) {
    this._ignoreNextPauseEvent = false
    return
  }

  if (this.getState() !== this.STATE.PAUSED) {
    this._toPaused()
  }
}
HTMLPlayer.prototype._onSourceError = function _onSourceError () {
  this._reportError('Media source element error')
}
HTMLPlayer.prototype._onDeviceBuffering = function _onDeviceBuffering () {
  if (this.getState() === this.STATE.PLAYING) {
    this._toBuffering()
  }
}
HTMLPlayer.prototype._onEndOfMedia = function _onEndOfMedia () {
  this._toComplete()
}
HTMLPlayer.prototype._onStatus = function _onStatus () {
  if (this.getState() === this.STATE.PLAYING) {
    this._emitEvent(this.EVENT.STATUS)
  }
}
HTMLPlayer.prototype._onMetadata = function _onMetadata () {
  this._metadataLoaded()
}
HTMLPlayer.prototype._exitBuffering = function _exitBuffering () {
  this._metadataLoaded()
  if (this.getState() !== this.STATE.BUFFERING) {

  } else if (this._postBufferingState === this.STATE.PAUSED) {
    this._toPaused()
  } else {
    this._toPlaying()
  }
}
HTMLPlayer.prototype._metadataLoaded = function _metadataLoaded () {
  this._readyToPlayFrom = true
  if (this._waitingToPlayFrom()) {
    this._deferredPlayFrom()
  }
}

HTMLPlayer.prototype._playFromIfReady = function _playFromIfReady () {
  if (this._isReadyToPlayFrom()) {
    if (this._waitingToPlayFrom()) {
      this._deferredPlayFrom()
    }
  }
}
HTMLPlayer.prototype._waitingToPlayFrom = function _waitingToPlayFrom () {
  return this._targetSeekTime !== undefined
}
HTMLPlayer.prototype._deferredPlayFrom = function _deferredPlayFrom () {
  this._seekTo(this._targetSeekTime)
  this._mediaElement.play()
  if (this._postBufferingState === this.STATE.PAUSED) {
    this._pauseMediaElement()
  }
  this._targetSeekTime = undefined
}
HTMLPlayer.prototype._seekTo = function _seekTo (seconds) {
  var clampedTime = this._getClampedTimeForPlayFrom(seconds)
  this._mediaElement.currentTime = clampedTime
  this._sentinelSeekTime = clampedTime
}
HTMLPlayer.prototype._getClampedTimeForPlayFrom = function _getClampedTimeForPlayFrom (seconds) {
  var clampedTime = this._getClampedTime(seconds)
  return clampedTime
}
HTMLPlayer.prototype._wipe = function _wipe () {
  this._type = undefined
  this._source = undefined
  this._mimeType = undefined
  this._targetSeekTime = undefined
  this._sentinelSeekTime = undefined
  this._clearSentinels()
  this._destroyMediaElement()
  this._readyToPlayFrom = false
}
HTMLPlayer.prototype._destroyMediaElement = function _destroyMediaElement () {
  if (this._mediaElement) {
    this._mediaElement.removeEventListener('canplay', this._onFinishedBuffering.bind(this), false)
    this._mediaElement.removeEventListener('seeked', this._onFinishedBuffering.bind(this), false)
    this._mediaElement.removeEventListener('playing', this._onFinishedBuffering.bind(this), false)
    this._mediaElement.removeEventListener('error', this._onDeviceError.bind(this), false)
    this._mediaElement.removeEventListener('ended', this._onEndOfMedia.bind(this), false)
    this._mediaElement.removeEventListener('waiting', this._onDeviceBuffering.bind(this), false)
    this._mediaElement.removeEventListener('timeupdate', this._onStatus.bind(this), false)
    this._mediaElement.removeEventListener('loadedmetadata', this._onMetadata.bind(this), false)
    this._mediaElement.removeEventListener('pause', this._onPause.bind(this), false)
    this._sourceElement.removeEventListener('error', this._onSourceError.bind(this), false)
    this._sourceElement.parentNode.removeChild(this._sourceElement)
    this._unloadMediaSrc()
    this._mediaElement.parentNode.removeChild(this._mediaElement)
    delete this._mediaElement
    delete this._sourceElement
  }
}
HTMLPlayer.prototype._unloadMediaSrc = function _unloadMediaSrc () {
  // Reset source as advised by HTML5 video spec, section 4.8.10.15:
  // http://www.w3.org/TR/2011/WD-html5-20110405/video.html#best-practices-for-authors-using-media-elements
  this._mediaElement.removeAttribute('src')
  this._mediaElement.load()
}
HTMLPlayer.prototype._generateSourceElement = function _generateSourceElement (url, mimeType) {
  var sourceElement = utils.createElement('source')
  sourceElement.src = url
  sourceElement.type = mimeType
  return sourceElement
}
HTMLPlayer.prototype._reportError = function _reportError (errorMessage) {
  this._emitEvent(this.EVENT.ERROR, {'errorMessage': errorMessage})
}
HTMLPlayer.prototype._toStopped = function _toStopped () {
  this._state = this.STATE.STOPPED
  this._emitEvent(this.EVENT.STOPPED)
  this._setSentinels([])
}
HTMLPlayer.prototype._toBuffering = function _toBuffering () {
  this._state = this.STATE.BUFFERING
  this._emitEvent(this.EVENT.BUFFERING)
  this._setSentinels([ this._exitBufferingSentinel ])
}
HTMLPlayer.prototype._toPlaying = function _toPlaying () {
  this._state = this.STATE.PLAYING
  this._emitEvent(this.EVENT.PLAYING)
  this._setSentinels([ this._endOfMediaSentinel, this._shouldBeSeekedSentinel, this._enterBufferingSentinel ])
}
HTMLPlayer.prototype._toPaused = function _toPaused () {
  this._state = this.STATE.PAUSED
  this._emitEvent(this.EVENT.PAUSED)
  this._setSentinels([ this._shouldBeSeekedSentinel, this._shouldBePausedSentinel ])
}
HTMLPlayer.prototype._toComplete = function _toComplete () {
  this._state = this.STATE.COMPLETE
  this._emitEvent(this.EVENT.COMPLETE)
  this._setSentinels([])
}
HTMLPlayer.prototype._toEmpty = function _toEmpty () {
  this._wipe()
  this._state = this.STATE.EMPTY
}
HTMLPlayer.prototype._enterBufferingSentinel = function _enterBufferingSentinel () {
  var sentinelShouldFire = !this._hasSentinelTimeChangedWithinTolerance && !this._nearEndOfMedia
  if (this.getCurrentTime() === 0) {
    sentinelShouldFire = this._trustZeroes && sentinelShouldFire
  }

  if (this._enterBufferingSentinelAttemptCount === undefined) {
    this._enterBufferingSentinelAttemptCount = 0
  }

  if (sentinelShouldFire) {
    this._enterBufferingSentinelAttemptCount++
  } else {
    this._enterBufferingSentinelAttemptCount = 0
  }

  if (this._enterBufferingSentinelAttemptCount === 1) {
    sentinelShouldFire = false
  }

  if (sentinelShouldFire) {
    this._emitEvent(this.EVENT.SENTINEL_ENTER_BUFFERING)
    this._toBuffering()
    /* Resetting the sentinel attempt count to zero means that the sentinel will only fire once
      even if multiple iterations result in the same conditions.
      This should not be needed as the second iteration, when the enter buffering sentinel is fired
      will cause the media player to go into the buffering state. The enter buffering sentinel is not fired
      when in bufferking state
      */
    this._enterBufferingSentinelAttemptCount = 0
    return true
  }

  return false
}
HTMLPlayer.prototype._exitBufferingSentinel = function _exitBufferingSentinel () {
  function fireExitBufferingSentinel (self) {
    self._emitEvent(this.EVENT.SENTINEL_EXIT_BUFFERING)
    self._exitBuffering()
    return true
  }

  if (this._readyToPlayFrom && this._mediaElement.paused) {
    return fireExitBufferingSentinel(this)
  }

  if (this._hasSentinelTimeChangedWithinTolerance) {
    return fireExitBufferingSentinel(this)
  }
  return false
}
HTMLPlayer.prototype._shouldBeSeekedSentinel = function _shouldBeSeekedSentinel () {
  if (this._sentinelSeekTime === undefined) return false
  var currentTime = this.getCurrentTime()
  var sentinelActionTaken = false

  if (Math.abs(currentTime - this._sentinelSeekTime) > this._seekSentinelTolerance) {
    var self = this
    sentinelActionTaken = this._nextSentinelAttempt(this._sentinelLimits.seek, function () {
      self._mediaElement.currentTime = self._sentinelSeekTime
    })
  } else if (this._sentinelIntervalNumber < 3) {
    this._sentinelSeekTime = currentTime
  } else {
    this._sentinelSeekTime = undefined
  }

  return sentinelActionTaken
}
HTMLPlayer.prototype._shouldBePausedSentinel = function _shouldBePausedSentinel () {
  return this._hasSentinelTimeChangedWithinTolerance
    ? this._nextSentinelAttempt(this._sentinelLimits.pause, this._pauseMediaElement.bind(this))
    : false
}
HTMLPlayer.prototype._nextSentinelAttempt = function _nextSentinelAttempt (sentinelInfo, attemptFn) {
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
HTMLPlayer.prototype._endOfMediaSentinel = function _endOfMediaSentinel () {
  if (!this._hasSentinelTimeChangedWithinTolerance && this._nearEndOfMedia) {
    this._emitEvent(this.EVENT.SENTINEL_COMPLETE)
    this._onEndOfMedia()
    return true
  }
  return false
}
HTMLPlayer.prototype._clearSentinels = function _clearSentinels () {
  clearInterval(this._sentinelInterval)
}
HTMLPlayer.prototype._setSentinels = function _setSentinels (sentinels) {
  var self = this
  this._clearSentinels()
  this._sentinelIntervalNumber = 0
  this._lastSentinelTime = this.getCurrentTime()
  this._sentinelInterval = setInterval(function () {
    self._sentinelIntervalNumber += 1
    var newTime = self.getCurrentTime()

    self._hasSentinelTimeChangedWithinTolerance = (Math.abs(newTime - self._lastSentinelTime) > 0.2)
    self._nearEndOfMedia = (self.getDuration() - (newTime || self._lastSentinelTime)) <= 1
    self._lastSentinelTime = newTime

    for (var i = 0; i < sentinels.length; i++) {
      var sentinelActivated = sentinels[i].call(self)

      if (self.getCurrentTime() > 0) {
        self._trustZeroes = false
      }

      if (sentinelActivated) {
        break
      }
    }
  }, 1100)
}
HTMLPlayer.prototype._isReadyToPlayFrom = function _isReadyToPlayFrom () {
  if (this._readyToPlayFrom !== undefined) {
    return this._readyToPlayFrom
  }
  return false
}
HTMLPlayer.prototype._setSeekSentinelTolerance = function _setSeekSentinelTolerance () {
  var ON_DEMAND_SEEK_SENTINEL_TOLERANCE = 15
  var LIVE_SEEK_SENTINEL_TOLERANCE = 30

  this._seekSentinelTolerance = ON_DEMAND_SEEK_SENTINEL_TOLERANCE
  if (this._isLiveMedia()) {
    this._seekSentinelTolerance = LIVE_SEEK_SENTINEL_TOLERANCE
  }
}

module.exports = HTMLPlayer
