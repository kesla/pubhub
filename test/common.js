var common = module.exports
  , http = require('http')
  , pubhub = require('../pubhub')
  , server
  , MemDOWN = require('memdown')
  , levelup = require('levelup')
  , factory = function (location) { return new MemDOWN(location) }
  , db = levelup('/does/not/matter', { db: factory })
  , request = require('request')

common.setup = function(t) {
  var hub = pubhub(db)

  server = http.createServer(hub.dispatch.bind(hub))

  server.once('listening', function() {
    port = this.address().port
    hubUrl = 'http://localhost:' + port
    common.hubRequest = request.defaults({
        jar: false,
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        url: hubUrl,
        method: 'POST'
      })


    // TODO: These should be real urls, pointing to places that actually mean something
    common.topicUrl = 'http://topic.com'
    common.callbackUrl = 'http://callback.com'

    t.end()
  })

  server.listen(0)
}

common.teardown = function(t) {
  if (server) {
    server.unref()
    server.close()
  }
  t.end()
}
