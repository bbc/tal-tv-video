/* eslint-env jest */
const utils = require('./utils')

test('createElement, creates a dom node with the specified id and classes', () => {
  const el = utils.createElement('div', 'someId', ['some', 'class', 'names'])
  expect(el.tagName).toBe('DIV')
  expect(el.id).toBe('someId')
  expect(el.className).toBe('some class names')
})

test('prependChildElement prepends a node to a given parent', () => {
  const el1 = utils.createElement('div', 'someId', [])
  const el2 = utils.createElement('aside', 'someId2', [])
  const el3 = utils.createElement('header', 'someId2', [])

  utils.prependChildElement(el1, el2)
  utils.prependChildElement(el1, el3)

  expect(el1.childElementCount).toBe(2)
  expect(el1.childNodes[0]).toBe(el3)
})

test('getScreenSize returns the current size of the screen', () => {
  expect(utils.getScreenSize()).toEqual({ height: 768, width: 1024 })
})

test('inherit creates a new function with the prototype of a given function', () => {
  function PM () { this.says = 'yum' }
  PM.prototype.eatChocolate = function () {
    return this.says
  }

  const Kiran = utils.inherit(PM)
  Kiran.prototype.drinkCoffee = function () {
    return 'just half a cup'
  }

  const pm = new PM()
  const kiran = new Kiran()

  expect(pm.drinkCoffee).toBe(undefined)
  expect(kiran.eatChocolate()).toBe('yum')
  expect(kiran.drinkCoffee()).toBe('just half a cup')
})

test('inherit can be given a constructor', () => {
  function PM () { this.says = 'yum' }
  PM.prototype.eatChocolate = function () {
    return this.says
  }

  const Kiran = utils.inherit(PM, function () {
    this.says = 'scrumptious'
  })
  const pm = new PM()
  const kiran = new Kiran()

  expect(pm.eatChocolate()).toBe('yum')
  expect(kiran.eatChocolate()).toBe('scrumptious')
})
