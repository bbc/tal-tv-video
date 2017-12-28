/* eslint-env jest */
const utils = require('./utils')

test('createElement', () => {
  const el = utils.createElement('div', 'someId', ['some', 'class', 'names'])
  expect(el.tagName).toBe('DIV')
  expect(el.id).toBe('someId')
  expect(el.className).toBe('some class names')
})

// do more...
test('prependChildElement')
test('getScreenSize')
test('inherit')
