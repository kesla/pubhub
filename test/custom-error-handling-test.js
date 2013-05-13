var test = require('tap').test

  , common = require('./common')

test('setup', common.setup.bind(common))

test('custom error handling', function(t) {
  common.server.once('request', function(req, res) {
    common.hub.dispatch(req, res, function(err) {
      t.equal(res.statusCode, 200)

      res.writeHead(418)
      res.end('A custom error message')
    })
  })

  common.hubRequest(
      {}
    , function(err, res, data) {
        t.equal(res.statusCode, 418)
        t.equal(data, 'A custom error message')
        t.end()
      }
  )
})

test('teardown', common.teardown.bind(common))