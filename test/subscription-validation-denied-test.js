var qs = require('querystring')
  , test = require('tap').test

  , common = require('./common')

test('setup', function(t) {
  common.setup(t, {
      acceptor: function(params, callback) {
        // don't accept any subscription requests
        callback(null, false)
      }
  })
  common.server.on('request', common.hub.dispatch.bind(common.hub))
})

test('subscription denial', function(t) {
  var callbackUrl = common.callbackUrl + '?hello=world'
  common.callbackServer.once('request', function(req, res) {
    res.end()

    var query = qs.parse(req.url.split('?')[1])
    t.equal(query['hub.mode'], 'denied', 'hub.mode is "denied"')
    t.equal(query['hub.topic'], common.topicUrl, 'hub.topic is original topic')
    t.equal(query['hello'], 'world', 'custom queries are preserved')
    t.end()
  })

  common.hubRequest(
      {
          'hub.mode': 'subscribe'
        , 'hub.callback': callbackUrl
        , 'hub.topic': common.topicUrl
      }
    , function(err, res) {
      t.equal(res.statusCode, 202, 'Correct status code')
    }
  )
})

test('teardown', common.teardown.bind(common))