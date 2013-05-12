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

PubHub.prototype._validateParameters = function(parameters) {
  var requiredParameters = ['hub.callback', 'hub.mode', 'hub.topic']
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
        param + ' is a required parameter'
      )
  }

  // check that the mode is correct
  for(i = 0; i < validModes.length; ++i) {
    if (validModes.indexOf(parameters['hub.mode']) === -1)
      return new ValidationError(
        'hub.mode must be "subscribe" or "unsubscribe"'
      )
  }

  // check that the callback & topic-urls have correct scheme/protocol
  callbackUrlObj = url.parse(parameters['hub.callback'])
  if (validSchemes.indexOf(callbackUrlObj.protocol) === -1)
    return new ValidationError(
      'hub.callback: "' + callbackUrlObj.protocol + '" is not a valid scheme'
    )

  topicUrlObj = url.parse(parameters['hub.topic'])
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
          parameters = qs.parse(buffer.toString())
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