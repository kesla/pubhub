var test = require('tape')

  , common = require('./common')

test('setup', common.setup.bind(common))

test('subscription request', function(t) {
  t.plan(8)

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
})

test('teardown', common.teardown.bind(common))