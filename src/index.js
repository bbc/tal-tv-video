var playerMap = {
  'html5': require('./media-player/html'),
  'html5memoryleakunfix': require('./media-player/html-memory-leak-unfix'),
  'html5untyped': require('./media-player/html-untyped'),
  'cehtml': require('./media-player/ce-html'),
  'samsung_maple': require('./media-player/maple'),
  'samsung_streaming': require('./media-player/samsung-streaming'),
  'samsung_streaming_2015': require('./media-player/samsung-streaming-2015')
}

module.exports = function (rootId, config) {
  var Player = playerMap[config.playerType]
  return new Player(rootId, config)
}
