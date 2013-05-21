var crypto = require('crypto')
  , qs = require('querystring')

  , endpoint = require('endpoint')
  , test = require('tap').test
  , parseLink = require('http-link').parse

  , common = require('./common')

  , SECRET = 'beep boop'

test('setup', function(t) {
  common.setup(t, {
      acceptor: function(params, callback) {
        // accept any subscription requests
        callback(null, true)
      }
  })

  common.server.on('request', function(req, res) {
    common.hub.dispatch(req, res)
  })
})

test('content distribution', function(t) {
  t.test('setup subscription', function(t) {
    t.plan(2)
    common.hubRequest(
        {
            'hub.mode': 'subscribe'
          , 'hub.topic': common.topicUrl
          , 'hub.callback': common.callbackUrls.http
          , 'hub.secret': SECRET
        }
      , function(req, res, data) {
          t.equal(res.statusCode, 202)
        }
    )

    common.callbackServers.http.once('request', function(req, res, data) {
      var query = qs.parse(req.url.split('?')[1])
      res.end(query['hub.challenge'])
      t.ok(true, 'send request to callback-server')
    })
  })

  t.test('distribute', function(t) {
    var contentType = 'application/json'
      , content = JSON.stringify({
            title: 'Blog post'
          , content: 'A mockup blog post in a JSON-format'
        })

    t.plan(8)

    common.callbackServers.http.once('request', function(req, res) {
      var links = parseLink(req.headers['link'])
        , hubLink = links.filter(
            function(link) {
              return link.rel.toLowerCase() === 'hub'
            }
          )[0]
        , selfLink = links.filter(
            function(link) {
              return link.rel.toLowerCase() === 'self'
            }
          )[0]

      t.equal(req.method, 'POST', 'should be a POST-method')

      t.equal(
          req.headers['content-type']
        , contentType
        , 'should have correct content-type header'
      )

      t.equal(
          hubLink.href
        , common.hub.hubUrl
        , 'should have correct rel=hub link-header'
      )

      t.equal(
          selfLink.href
        , common.topicUrl
        , 'should have correct rel=self link-header'
      )

      t.ok(
          req.headers['x-hub-signature']
        , 'should have x-hub-signature header set'
      )

      req.pipe(
        endpoint(function(err, actualData) {
          t.equal(actualData.toString(), content, 'should have correct data')
          t.equal(
              req.headers['x-hub-signature']
            , 'sha1=' + crypto.createHmac('sha1', SECRET).update(actualData).digest('hex')
            , 'should have correct x-hub-signature header'
          )
          res.end()
        })
      )
    })

    // TODO: Remove this? It's kind of ugly
    setTimeout(function() {
      common.hub.distribute(common.topicUrl, contentType, content, function(err) {
        t.notOk(err, 'distribute() should not error')
        t.end()
      })
    }, 100)

  })

  t.end()
})

test('teardown', common.teardown)