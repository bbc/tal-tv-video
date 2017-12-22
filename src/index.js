var playerMap = {
  'antie/devices/mediaplayer/html5': require('./html-player'),
  'antie/devices/mediaplayer/html5memoryleakunfix': require('./html-memory-leak-unfix-player'),
  'antie/devices/mediaplayer/html5untyped': require('./html-untyped-player'),
  'antie/devices/mediaplayer/cehtml': require('./ce-html-player'),
  'antie/devices/mediaplayer/samsung_maple': require('./maple-player'),
  'antie/devices/mediaplayer/samsung_streaming': require('./samsung-streaming-player'),
  'antie/devices/mediaplayer/samsung_streaming_2015': require('./samsung-streaming-2015-player')
}

module.exports = function (rootId, config) {
  // TODO: find the bits of config that are actually needed - get rid of the rest
  var playerPath = config.modules.modifiers.filter(function (modifierPath) {
    return modifierPath.match(/mediaplayer/)
  })[0]
  var Player = playerMap[playerPath]
  return new Player(rootId, config)
}
