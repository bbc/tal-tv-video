/* eslint-env jest */
const CallbackManager = require('./callback-manager')
let callbackManager
beforeEach(() => {
  callbackManager = new CallbackManager()
})

test('callAll arg passed to added callback', () => {
  const callback = jest.fn()
  callbackManager.addCallback({}, callback)

  callbackManager.callAll(99)
  expect(callback).toHaveBeenCalledWith(99)
})

test('multiple callAll args passed to added callback', () => {
  const callback = jest.fn()
  callbackManager.addCallback({}, callback)

  callbackManager.callAll(1, 2, 3, 4, 5)
  expect(callback).toHaveBeenCalledWith(1, 2, 3, 4, 5)
})

test('callAll uses this arg with added callback', () => {
  const callback = { apply: jest.fn() }
  const callback2 = { apply: jest.fn() }
  const that = { one: 1 }
  const that2 = { two: 2 }
  callbackManager.addCallback(that, callback)
  callbackManager.addCallback(that2, callback2)

  callbackManager.callAll(1, 2, 3, 4, 5)
  expect(callback.apply).toHaveBeenCalledWith(that, [1, 2, 3, 4, 5])
  expect(callback2.apply).toHaveBeenCalledWith(that2, [1, 2, 3, 4, 5])
})

test('multiple additions of one callback only adds once', () => {
  const callback = jest.fn()
  const that = { one: 1 }
  callbackManager.addCallback(that, callback)
  callbackManager.addCallback(that, callback)

  callbackManager.callAll(1, 2, 3, 4, 5)
  expect(callback.mock.calls.length).toBe(1)
})

test('remove all callbacks removes them all', () => {
  const callback = jest.fn()
  const that = { one: 1 }
  callbackManager.addCallback(that, callback)
  callbackManager.addCallback(that, callback)
  callbackManager.removeAllCallbacks()

  callbackManager.callAll(1, 2, 3, 4, 5)
  expect(callback).not.toHaveBeenCalled()
})

test('remove callback removes a specific callback thisArg pair', () => {
  const callback = { apply: jest.fn() }
  const callback2 = { apply: jest.fn() }
  const that = { one: 1 }
  const that2 = { two: 2 }
  callbackManager.addCallback(that, callback)
  callbackManager.addCallback(that, callback2)
  callbackManager.addCallback(that2, callback2)
  callbackManager.removeCallback(that, callback2)

  callbackManager.callAll(1, 2, 3, 4, 5)
  expect(callback2.apply).not.toHaveBeenCalledWith(that, [1, 2, 3, 4, 5])
  expect(callback2.apply).toHaveBeenCalledWith(that2, [1, 2, 3, 4, 5])
})
