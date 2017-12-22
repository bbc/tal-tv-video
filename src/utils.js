module.exports = {
  createElement: function createElement (tagName, id, classNames) {
    var el = document.createElement(tagName)
    el.id = id
    if (classNames && (classNames.length > 0)) {
      el.className = classNames.join(' ')
    }
    return el
  },
  prependChildElement: function prependChildElement (id, child) {
    var el = document.getElementById(id)
    if (el.childNodes.length > 0) {
      el.insertBefore(child, el.childNodes[0])
    } else {
      el.appendChild(child)
    }
  },
  getScreenSize: function getScreenSize () {
    var w, h
    if (typeof (window.innerWidth) === 'number') {
      w = window.innerWidth
      h = window.innerHeight
    } else {
      var d = document.documentElement || document.body
      h = d.clientHeight || d.offsetHeight
      w = d.clientWidth || d.offsetWidth
    }
    return {
      width: w,
      height: h
    }
  },
  inherit: function inherit (From, Construct) {
    function DefaultClazz () {
      From.apply(this, arguments)
    }

    var Clazz = Construct || DefaultClazz

    var F = function () {}
    F.prototype = From.prototype
    Clazz.prototype = new F()
    Clazz.prototype.constructor = Clazz

    return Clazz
  }
}
