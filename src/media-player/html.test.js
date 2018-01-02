/* eslint-env jest */
const Player = require('./html')

describe('HTML Player', () => {
  let player

  beforeEach(() => {
    document.body.innerHTML = `<div id='video-here'></div>`
    player = new Player('video-here')
    window.HTMLMediaElement.prototype.load = jest.fn()
    window.HTMLMediaElement.prototype.play = jest.fn()
  })

  test('HTML player starts in EMPTY state', () => {
    expect(player.getState()).toBe(player.STATE.EMPTY)
  })

  test('Calling reset in EMPTY state goes to EMPTY', () => {
    player.reset()
    expect(player.getState()).toBe(player.STATE.EMPTY)
  })

  test('Setting source in EMPTY state goes to STOPPED', () => {
    player.setSource(player.TYPE.VIDEO, 'http://some.video.mp4', 'video/xml-yaml+')
    expect(player.getState()).toBe(player.STATE.STOPPED)
  })

  describe('When in STOPPED', () => {
    beforeEach(() => {
      player.setSource(player.TYPE.VIDEO, 'http://some.video.mp4', 'video/xml-yaml+')
      expect(player.getState()).toBe(player.STATE.STOPPED)
    })

    test('getSource', () => {
      expect(player.getSource()).toBe('http://some.video.mp4')
    })

    test('getMimeType', () => {
      expect(player.getMimeType()).toBe('video/xml-yaml+')
    })

    test('calling setSource is an error', () => {
      expect(() => {
        player.setSource(player.TYPE.VIDEO, 'http://some.video.mp4', 'video/xml-yaml+')
      }).toThrow('ApiError: Cannot set source unless in the \'EMPTY\' state')
    })

    test('calling play is an error', () => {
      expect(() => {
        player.playFrom()
      }).toThrow('ApiError: Cannot playFrom while in the \'STOPPED\' state')
    })

    test('calling pause is an error', () => {
      expect(() => {
        player.pause()
      }).toThrow('ApiError: Cannot pause while in the \'STOPPED\' state')
    })

    test('calling resume is an error', () => {
      expect(() => {
        player.resume()
      }).toThrow('ApiError: Cannot resume while in the \'STOPPED\' state')
    })

    test('calling stop stays in STOPPED', () => {
      player.stop()
      expect(player.getState()).toBe(player.STATE.STOPPED)
    })

    test('calling beginPlayback goes to BUFFERING', () => {
      player.beginPlayback()
      expect(player.getState()).toBe(player.STATE.BUFFERING)
    })

    test('time passing does not cause StatusEvent to be sent', () => {
      jest.useFakeTimers()
      const eventListener = jest.fn()
      player.addEventCallback(eventListener)
      jest.advanceTimersByTime(5000)
      expect(eventListener).not.toHaveBeenCalled()
    })

    test('calling reset when in STOPPED goes to EMPTY', () => {
      player.reset()
      expect(player.getState()).toBe(player.STATE.EMPTY)
    })

    test('calling beginPlayback goes to BUFFERING', () => {
      player.beginPlayback()
      expect(player.getState()).toBe(player.STATE.BUFFERING)
    })

    test('calling beginPlaybackFrom goes to BUFFERING', () => {
      player.beginPlaybackFrom(0)
      expect(player.getState()).toBe(player.STATE.BUFFERING)
    })
  })

  describe('When in BUFFERING', () => {
    beforeEach(() => {
      player.setSource(player.TYPE.VIDEO, 'http://some.video.mp4', 'video/xml-yaml+')
      player._mediaElement = Object.defineProperty(player._mediaElement, 'duration', {value: 100})
      player.beginPlaybackFrom(10)
      expect(player.getState()).toBe(player.STATE.BUFFERING)
    })

    test('calling setSource is an error', () => {
      expect(() => {
        player.setSource(player.TYPE.VIDEO, 'http://some.video.mp4', 'video/xml-yaml+')
      }).toThrow('ApiError: Cannot set source unless in the \'EMPTY\' state')
    })

    test('calling beginPlayback is an Error', () => {
      expect(() => {
        player.beginPlayback()
      }).toThrow('ApiError: Cannot beginPlayback while in the \'BUFFERING\' state')
    })

    test('calling beginPlaybackFrom is an Error', () => {
      expect(() => {
        player.beginPlaybackFrom(0)
      }).toThrow('ApiError: Cannot beginPlaybackFrom while in the \'BUFFERING\' state')
    })

    test('finishing buffering goes to PLAYING', () => {
      const callback = { apply: jest.fn() }
      player.addEventCallback({}, callback)
      player._mediaElement.dispatchEvent(new window.Event('canplay', {}))

      expect(player.getState()).toBe(player.STATE.PLAYING)
      expect(callback.apply).toHaveBeenCalledWith({}, [{
        state: player.STATE.PLAYING,
        currentTime: 10,
        seekableRange: { start: 0, end: 100 },
        duration: 100,
        url: 'http://some.video.mp4',
        mimeType: 'video/xml-yaml+',
        type: player.EVENT.PLAYING
      }])
    })

    test('pause goes to PAUSED when buffering finishes', () => {
      const callback = { apply: jest.fn() }
      player.addEventCallback({}, callback)
      player.pause()
      player._mediaElement.dispatchEvent(new window.Event('canplay', {}))

      expect(player.getState()).toBe(player.STATE.PAUSED)
      expect(callback.apply).toHaveBeenCalledWith({}, [{
        state: player.STATE.PAUSED,
        currentTime: 10,
        seekableRange: { start: 0, end: 100 },
        duration: 100,
        url: 'http://some.video.mp4',
        mimeType: 'video/xml-yaml+',
        type: player.EVENT.PAUSED
      }])
    })

    test('pause then resume goes to PLAYING when buffering finishes', () => {
      const callback = { apply: jest.fn() }
      player.addEventCallback({}, callback)
      player.pause()
      player.resume()
      player._mediaElement.dispatchEvent(new window.Event('canplay', {}))

      expect(player.getState()).toBe(player.STATE.PLAYING)
      expect(callback.apply).toHaveBeenCalledWith({}, [{
        state: player.STATE.PLAYING,
        currentTime: 10,
        seekableRange: { start: 0, end: 100 },
        duration: 100,
        url: 'http://some.video.mp4',
        mimeType: 'video/xml-yaml+',
        type: player.EVENT.PLAYING
      }])
    })

    test('stop goes to STOPPED', () => {
      const callback = { apply: jest.fn() }
      player.addEventCallback({}, callback)
      player.stop()

      expect(player.getState()).toBe(player.STATE.STOPPED)
      expect(callback.apply).toHaveBeenCalledWith({}, [{
        state: player.STATE.STOPPED,
        currentTime: undefined,
        seekableRange: undefined,
        duration: undefined,
        url: 'http://some.video.mp4',
        mimeType: 'video/xml-yaml+',
        type: player.EVENT.STOPPED
      }])
    })
  })
})
