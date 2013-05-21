var qs = require('querystring')
  , test = require('tap').test

  , common = require('./common')

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

test('verify subscribe intent', function(t) {
  var callbackUrl = common.callbackUrls.http + '?hello=world'
    , challenge

  common.callbackServers.http.once('request', function(req, res) {
    var query = qs.parse(req.url.split('?')[1])

    challenge = query['hub.challenge']

    t.equal(query['hub.mode'], 'subscribe', 'hub.mode is "subscribe"')
    t.equal(query['hub.topic'], common.topicUrl, 'hub.topic is original topic')
    t.type(challenge, 'string', 'hub.challenge is set')
    t.equal(query['hello'], 'world', 'custom queries are preserved')
    t.equal(query['hub.lease_seconds'], '12345', 'hub.lease_seconds is set')

    res.end(challenge)

    t.end()
  })

  // TODO: Add test to assure that stuff doesn't get added if callbackServer doesn't answer with the challenge
  // TODO: Test that stuff do get added if we answer correctly
  // TODO: Make this work

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

test('verify unsubscribe intent', function(t) {
  var callbackUrl = common.callbackUrls.http + '?hello=world'
    , challenge

  common.callbackServers.http.once('request', function(req, res) {
    var query = qs.parse(req.url.split('?')[1])

    challenge = query['hub.challenge']

    t.equal(query['hub.mode'], 'unsubscribe', 'hub.mode is "unsubscribe"')
    t.equal(query['hub.topic'], common.topicUrl, 'hub.topic is original topic')
    t.type(challenge, 'string', 'hub challenge is set')
    t.equal(query['hello'], 'world', 'custom queries are preserved')

    res.end(challenge)

    t.end()
  })

  common.hubRequest(
      {
          'hub.mode': 'unsubscribe'
        , 'hub.callback': callbackUrl
        , 'hub.topic': common.topicUrl
      }
    , function(err, res) {
      t.equal(res.statusCode, 202, 'Correct status code')
    }
  )
})

test('teardown', common.teardown.bind(common))