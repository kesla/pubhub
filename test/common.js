var fs = require('fs')
  , http = require('http')
  , https = require('https')
  , path = require('path')
  , qs = require('querystring')

  , MemDOWN = require('memdown')
  , levelup = require('levelup')
  , request = require('request')

  , pubhub = require('../pubhub')

  , common = module.exports
  , dbFactory = function (location) { return new MemDOWN(location) }

common.setup = function(t, opts) {
  t.plan(3)

  if (!opts)
    opts = {}

  if (!opts.db)
    opts.db = levelup('/does/not/matter', { db : dbFactory} )

  common.server = http.createServer().listen(0)

  common.server.once('listening', function() {
    var port = this.address().port
      , hubUrl = 'http://localhost:' + port

    opts.hubUrl = hubUrl
    common.hub = pubhub(opts)

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

    t.ok(true, 'server started')
  })

  common.callbackServers = {
      http: http.createServer().listen(0)
    , https: https.createServer({
            key: fs.readFileSync(path.join(__dirname, 'fixtures/server.key'))
          , cert: fs.readFileSync(path.join(__dirname, 'fixtures/server.crt'))
        }).listen(0)
  }

  common.callbackUrls = {
      http: ''
    , https: ''
  }

  common.callbackServers.http.once('listening', function() {
    common.callbackUrls.http = 'http://localhost:' + this.address().port + '/callback'

    t.ok(true, 'callback http-server started')
  })

  common.callbackServers.https.once('listening', function() {
    common.callbackUrls.https = 'https://localhost:' + this.address().port + '/callback'

    t.ok(true, 'callback https-server started')
  })

}

common.teardown = function(t) {
  if (common.server) {
    common.server.unref()
    common.server.close()
  }

  if (common.callbackServers.http) {
    common.callbackServers.http.unref()
    common.callbackServers.http.close()
  }

  if (common.callbackServers.https) {
    common.callbackServers.https.unref()
    common.callbackServers.https.close()
  }


  t.end()
}
