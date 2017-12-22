var playerMap = {
  'html5': require('./html-player'),
  'html5memoryleakunfix': require('./html-memory-leak-unfix-player'),
  'html5untyped': require('./html-untyped-player'),
  'cehtml': require('./ce-html-player'),
  'samsung_maple': require('./maple-player'),
  'samsung_streaming': require('./samsung-streaming-player'),
  'samsung_streaming_2015': require('./samsung-streaming-2015-player')
}

module.exports = function (rootId, config) {
  var Player = playerMap[config.playerType]
  return new Player(rootId, config)
}
