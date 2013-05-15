var crypto = require('crypto')
  , qs = require('querystring')
  , url = require('url')
  , util = require('util')

  , endpoint = require('endpoint')
  , request = require('request')

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
  this.acceptor = opts.acceptor || this._defaultAcceptor
  this.leaseSeconds = opts.leaseSeconds || 12345;

  // REQUIRED_PARAMS are without the "hub."-prefix
  this.REQUIRED_PARAMS = ['callback', 'mode', 'topic']
  this.VALID_SCHEMES = ['http:', 'https:']
  this.VALID_MODES = ['subscribe', 'unsubscribe']
}

// the default acceptor that accepts all subscriptions as the default action
PubHub.prototype._defaultAcceptor = function(params, callback) {
  callback(null, true)
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
  var err = null
    , callbackScheme
    , topicScheme

  // Check that all required params are present
  this.REQUIRED_PARAMS.forEach(function(requiredParam) {
    if (!err && !params[requiredParam])
      err = new ValidationError(
        'hub.' + requiredParam + ' is a required parameter'
      )
  })

  // check that the mode is correct
  if (!err && this.VALID_MODES.indexOf(params.mode) === -1)
    err = new ValidationError(
      'hub.mode must be "subscribe" or "unsubscribe"'
    )

  // check that the callback & topic-urls have correct scheme/protocol
  if (!err) {
    callbackScheme = url.parse(params.callback).protocol
    if (this.VALID_SCHEMES.indexOf(callbackScheme) === -1)
      err = new ValidationError(
        'hub.callback: "' + callbackScheme + '" is not a valid scheme'
      )
  }

  if (!err) {
    topicScheme = url.parse(params.topic).protocol
    if (this.VALID_SCHEMES.indexOf(topicScheme) === -1)
      err = new ValidationError(
        'hub.topic: "' + topicScheme + '" is not a valid scheme'
      )
  }

  return err
}

PubHub.prototype._denySubscription = function(params, reason) {
  var callbackUrlParts = params.callback.split('?')
    , callbackQuery = qs.parse(callbackUrlParts[1])
    , callbackBaseUrl = callbackUrlParts[0]
    , callbackUrl

  callbackQuery['hub.mode'] = 'denied'
  callbackQuery['hub.topic'] = params.topic

  callbackUrl = callbackBaseUrl + '?' + qs.stringify(callbackQuery)

  // notify the subscriber of the failure
  request.get(callbackUrl, function(err) {})
}

PubHub.prototype._randomString = function() {
  return crypto.randomBytes(16).toString('hex');
}

PubHub.prototype._verifyIntent = function(params) {
  var callbackUrlParts = params.callback.split('?')
    , callbackQuery = qs.parse(callbackUrlParts[1])
    , callbackBaseUrl = callbackUrlParts[0]

  callbackQuery['hub.mode'] = params.mode
  callbackQuery['hub.topic'] = params.topic

  callbackQuery['hub.challenge'] = this._randomString()
  callbackQuery['hub.lease_seconds'] = this.leaseSeconds

  request.get(callbackBaseUrl +   '?' + qs.stringify(callbackQuery)).once('error', function(err) {
    // TODO: Don't just ignore this error - perhaps retry a little bit later
  })
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

          self.acceptor(params, function(err, accepts) {
            if (err)
              errorHandler(err)
            else if (accepts)
              self._verifyIntent(params)
            else
              self._denySubscription(params)
          })
        }
      })
  )
}

module.exports = PubHub