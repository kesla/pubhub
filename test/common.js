var http = require('http')
  , qs = require('querystring')

  , MemDOWN = require('memdown')
  , levelup = require('levelup')
  , request = require('request')

  , pubhub = require('../pubhub')

  , common = module.exports
  , factory = function (location) { return new MemDOWN(location) }
  , db = levelup('/does/not/matter', { db: factory })
  , server


common.setup = function(t) {
  var hub = pubhub(db)

  server = http.createServer(hub.dispatch.bind(hub))

  common.server.once('listening', function() {
    var port = this.address().port
      , hubUrl = 'http://localhost:' + port

    common.hubRequest = function(parameters, callback) {
      request(
          {
              url: hubUrl
            , method: 'POST'
            , headers: {
                'content-type': 'application/x-www-form-urlencoded'
              }
            , body: qs.stringify(parameters)
            , jar: false
          }
        , callback
      )
    }

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
