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

function PubHub(db) {
  if (!(this instanceof PubHub))
    return new PubHub(db)

  this.db = db
}

PubHub.prototype._parseParameters = function(buffer) {
  var str = buffer.toString()
    , rawParams = qs.parse(str)
    , parameters = {}

  Object.keys(rawParams).forEach(function(key) {
    if (key.slice(0, 'hub.'.length) === 'hub.')
      parameters[key.slice('hub.'.length)] = rawParams[key]
  })
  return parameters
}

PubHub.prototype._validateParameters = function(parameters) {
  // requiredParameters are without the "hub."-prefix since that's removed
  // when the parameters are parsed
  var requiredParameters = ['callback', 'mode', 'topic']
    , validModes = ['subscribe', 'unsubscribe']
    , validSchemes = ['http:', 'https:']
    , param
    , i
    , callbackUrlObj
    , topicUrlObj

  // Check that all required parameters are present
  for(i = 0; i < requiredParameters.length; ++i) {
    param = requiredParameters[i]

    if (!parameters[param])
      return new ValidationError(
        'hub.' + param + ' is a required parameter'
      )
  }

  // check that the mode is correct
  for(i = 0; i < validModes.length; ++i) {
    if (validModes.indexOf(parameters.mode) === -1)
      return new ValidationError(
        'hub.mode must be "subscribe" or "unsubscribe"'
      )
  }

  // check that the callback & topic-urls have correct scheme/protocol
  callbackUrlObj = url.parse(parameters.callback)
  if (validSchemes.indexOf(callbackUrlObj.protocol) === -1)
    return new ValidationError(
      'hub.callback: "' + callbackUrlObj.protocol + '" is not a valid scheme'
    )

  topicUrlObj = url.parse(parameters.topic)
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

        var parameters
        if (!err) {
          parameters = self._parseParameters(buffer)
          err = self._validateParameters(parameters)
        }

        if (err)
          errorHandler(err)
        else
          res.end()
      })
  )
}

module.exports = PubHub