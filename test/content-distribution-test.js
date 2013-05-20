var qs = require('querystring')

  , endpoint = require('endpoint')
  , test = require('tap').test

  , common = require('./common')

test('setup', function(t) {
  common.setup(t, {
      acceptor: function(params, callback) {
        // accept any subscription requests
        callback(null, true)
      }
  })
  common.server.on('request', common.hub.dispatch.bind(common.hub))
})

test('content distribution', function(t) {
  t.test('setup subscription', function(t) {
    t.plan(2)
    common.hubRequest(
        {
            'hub.mode': 'subscribe'
          , 'hub.topic': common.topicUrl
          , 'hub.callback': common.callbackUrls.http
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

    t.plan(4)

    common.callbackServers.http.once('request', function(req, res) {
      t.equal(req.method, 'POST', 'should be a POST-method')
      t.equal(
          req.headers['content-type']
        , contentType
        , 'should have correct content-type header'
      )

      req.pipe(
        endpoint(function(err, actualData) {
          t.equal(actualData.toString(), content, 'should have correct data')
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

test('secure content distribution', function(t){ t.end() })

test('teardown', common.teardown)