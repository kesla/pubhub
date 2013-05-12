var test = require('tape')

  , common = require('./common')

test('setup', common.setup.bind(common))

test('subscription request', function(t) {
  t.plan(13)

  common.server.on('request', common.hub.dispatch.bind(common.hub))

  common.hubRequest(
      {
          'hub.mode': 'subscribe'
        , 'hub.topic': common.topicUrl
      }
    , function(err, res, data) {
        t.equal(res.statusCode, 400, 'hub.callback is required')
        t.equal(data, 'hub.callback is a required parameter', 'correct error message')
      }
  )

  common.hubRequest(
      {
          'hub.callback': common.callbackUrl
        , 'hub.topic': common.topicUrl
      }
    , function(err, res, data) {
        t.equal(res.statusCode, 400, 'hub.mode is required')
        t.equal(data, 'hub.mode is a required parameter', 'correct error message')
      }
  )

  common.hubRequest(
      {
          'hub.mode': 'subscribe'
        , 'hub.callback': common.callbackUrl
      }
    , function(err, res, data) {
        t.equal(res.statusCode, 400, 'hub.topic is required')
        t.equal(data, 'hub.topic is a required parameter', 'correct error message')
      }
  )

  common.hubRequest(
      {
          'hub.mode': 'wrong'
        , 'hub.callback': common.callbackUrl
        , 'hub.topic': common.topicUrl
      }
    , function(err, res, data) {
        t.equal(res.statusCode, 400, 'hub.mode should be subscribe or unsubscribe')
        t.equal(data, 'hub.mode must be "subscribe" or "unsubscribe"', 'correct error message')
      }
  )

  common.hubRequest(
      {
          'hub.mode': 'subscribe'
        , 'hub.callback': 'https://callback.com'
        , 'hub.topic': 'https://topic.com'
      }
    , function(err, res, data) {
        t.notEqual(res.statusCode, 400, 'hub.callback & hub.topic can have a https-scheme')
      }
  )

  common.hubRequest(
      {
          'hub.mode': 'subscribe'
        , 'hub.callback': 'htp://callback.com'
        , 'hub.topic': common.topicUrl
      }
    , function(err, res, data) {
        t.equal(res.statusCode, 400, 'hub.callback must have http or https-scheme')
        t.equal(data, 'hub.callback: "htp:" is not a valid scheme')
      }
  )

  common.hubRequest(
      {
          'hub.mode': 'subscribe'
        , 'hub.callback': common.callbackUrl
        , 'hub.topic': 'htp://topic.com'
      }
    , function(err, res, data) {
        t.equal(res.statusCode, 400, 'hub.callback must have http or https-scheme')
        t.equal(data, 'hub.topic: "htp:" is not a valid scheme')
      }
  )
})

test('teardown', common.teardown.bind(common))