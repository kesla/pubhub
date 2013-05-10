var http = require('http')
  , qs = require('querystring')
  , test = require('tap').test
  , common = require('./common')
  , request = require('request')

test('pubhub', function(t) {
  t.test('setup', common.setup.bind(common))

  t.test('subscription request', function(t) {
    t.plan(4)

    common.hubRequest(
        {
            body: qs.stringify(
                {
                    'hub.mode': 'subscribe'
                  , 'hub.topic': common.topicUrl
                }
            )
        }
      , function(err, res, data) {
          t.notEqual(res.statusCode, 200, 'hub.callback is required')
        }
    )

    common.hubRequest(
        {
            body: qs.stringify(
                {
                    'hub.callback': common.callbackUrl
                  , 'hub.topic': common.topicUrl
                }
            )
        }
      , function(err, res, data) {
          t.notEqual(res.statusCode, 200, 'hub.mode is required')
        }
    )

    common.hubRequest(
        {
            body: qs.stringify(
                {
                    'hub.mode': 'subscribe'
                  , 'hub.callback': common.callbackUrl
                }
            )
        }
      , function(err, res, data) {
          t.notEqual(res.statusCode, 200, 'hub.topic is required')
        }
    )

    common.hubRequest(
        {
            body: qs.stringify(
                {
                    'hub.mode': 'wrong'
                  , 'hub.callback': common.callbackUrl
                  , 'hub.topic': common.topicUrl
                }
            )
        }
      , function(err, res, data) {
          t.notEqual(res.statusCode, 200, 'hub.mode should be subscribe or unsubscribe')
        }
    )
  })

  t.test('teardown', common.teardown.bind(common))

  t.end()
})