var qs = require('querystring')
  , url = require('url')
  , util = require('util')

  , endpoint = require('endpoint')

function ValidationError(message) {
  Error.call(this)

  this.message = message
  this.name = 'ValidationError'
  this.statusCode = 400
}
util.inherits(ValidationError, Error)

function PubHub(opts) {
  if (!(this instanceof PubHub))
    return new PubHub(opts)

  this.db = opts.db
}

PubHub.prototype._parseParams = function(buffer) {
  var str = buffer.toString()
    , rawParams = qs.parse(str)
    , params = {}

  Object.keys(rawParams).forEach(function(key) {
    if (key.slice(0, 'hub.'.length) === 'hub.')
      params[key.slice('hub.'.length)] = rawParams[key]
  })
  return params
}

PubHub.prototype._validateParams = function(params) {
  // requiredParams are without the "hub."-prefix since that's removed
  // when the params are parsed
  var requiredParams = ['callback', 'mode', 'topic']
    , validModes = ['subscribe', 'unsubscribe']
    , validSchemes = ['http:', 'https:']
    , param
    , i
    , callbackUrlObj
    , topicUrlObj

  // Check that all required params are present
  for(i = 0; i < requiredParams.length; ++i) {
    param = requiredParams[i]

    if (!params[param])
      return new ValidationError(
        'hub.' + param + ' is a required parameter'
      )
  }

  // check that the mode is correct
  for(i = 0; i < validModes.length; ++i) {
    if (validModes.indexOf(params.mode) === -1)
      return new ValidationError(
        'hub.mode must be "subscribe" or "unsubscribe"'
      )
  }

  // check that the callback & topic-urls have correct scheme/protocol
  callbackUrlObj = url.parse(params.callback)
  if (validSchemes.indexOf(callbackUrlObj.protocol) === -1)
    return new ValidationError(
      'hub.callback: "' + callbackUrlObj.protocol + '" is not a valid scheme'
    )

  topicUrlObj = url.parse(params.topic)
  if (validSchemes.indexOf(topicUrlObj.protocol) === -1)
    return new ValidationError(
      'hub.topic: "' + topicUrlObj.protocol + '" is not a valid scheme'
    )

}

PubHub.prototype.dispatch = function(req, res, errorHandler) {
  var self = this

  if (typeof(errorHandler) !== 'function')
    errorHandler = function(err) {
      res.writeHead(err.statusCode || 500)
      res.end(err.message)
    }

  req.pipe(
      endpoint(function(err, buffer) {

        var params
        if (!err) {
          params = self._parseParams(buffer)
          err = self._validateParams(params)
        }

        if (err)
          errorHandler(err)
        else {
          res.writeHead(202)
          res.end()
        }
      })
  )
}

module.exports = PubHub