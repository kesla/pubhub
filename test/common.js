var http = require('http')
  , qs = require('querystring')

  , MemDOWN = require('memdown')
  , levelup = require('levelup')
  , request = require('request')

  , pubhub = require('../pubhub')

  , common = module.exports
  , dbFactory = function (location) { return new MemDOWN(location) }

common.setup = function(t, opts) {
  if (!opts)
    opts = {}

  if (!opts.db)
    opts.db = levelup('/does/not/matter', { db : dbFactory} )

  common.hub = pubhub(opts)

  common.server = http.createServer().listen(0)

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
}

common.teardown = function(t) {
  if (common.server) {
    common.server.unref()
    common.server.close()
  }
  t.end()
}
