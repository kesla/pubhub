var crypto = require('crypto')
  , qs = require('querystring')
  , url = require('url')
  , util = require('util')

  , endpoint = require('endpoint')
  , request = require('request')
  , sublevel = require('level-sublevel')
  , stringifyLink = require('http-link').stringify

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
  sublevel(this.db)
  this.acceptor = opts.acceptor || this._defaultAcceptor
  this.leaseSeconds = opts.leaseSeconds || 12345;
  this.hubUrl = opts.hubUrl

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

PubHub.prototype._verifyIntent = function(params, callback) {
  var callbackUrlParts = params.callback.split('?')
    , callbackQuery = qs.parse(callbackUrlParts[1])
    , callbackBaseUrl = callbackUrlParts[0]
    , challenge = this._randomString()

  callbackQuery['hub.mode'] = params.mode
  callbackQuery['hub.topic'] = params.topic

  callbackQuery['hub.challenge'] = challenge
  callbackQuery['hub.lease_seconds'] = this.leaseSeconds

  request.get(
        callbackBaseUrl +   '?' + qs.stringify(callbackQuery)
      , function(err, res, data) {
          if (!err && data !== challenge)
            err = new Error('Wrong challenge from callback')

          callback(err)
        }
    )
    .once('error', callback)
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
          self.acceptor(params, function(err, accepts) {
            if (err)
              errorHandler(err)
            else {
              res.writeHead(202)
              res.end()

              if (accepts)
                self._verifyIntent(params, function(err) {
                  // TODO: report if there's an error here somehow
                  if (!err) {
                    if (params.mode === 'subscribe')
                      self._addCallbackUrl(
                          params.topic
                        , params.callback
                        , params.secret
                        , function(err) {
                          if (err) {
                            self._callbackUrls(params.topic, function(err, callbackUrls) {
                              console.log(callbackUrls)
                            })
                            // TODO: Do something if there's an error
                          }
                        }
                      )
                  }
                })
              else
                self._denySubscription(params)
            }
          })
        }
      })
  )
}

PubHub.prototype._addCallbackUrl = function(topicUrl, callbackUrl, secret, callback) {
  var self = this

  // TODO: use something like level-update to update metadata regarding a
  //    subscription - at least add createdAt
  // TODO: care about least_seconds, most probably by using level-ttl

  this.db.sublevel(topicUrl)
    .put(
        callbackUrl
      , JSON.stringify({
            updatedAt: (new Date).toJSON().slice(0, 19)
          , secret: secret
        })
      , callback
  )
}

PubHub.prototype._callbackData = function(topicUrl, callback) {
  var callbackUrls = []

  this.db.sublevel(topicUrl).createReadStream()
    .on('data', function(obj) {
        obj.value = JSON.parse(obj.value)
        callbackUrls.push({
            href: obj.key
          , data: obj.value
        })
      })
    .once('end', function() {
        callback(null, callbackUrls)
      })
    .once('error', function(err) {
      callback(err)
    })
}

PubHub.prototype.distribute = function(topicUrl, contentType, content, callback) {
  var self = this
  this._callbackData(topicUrl, function(err, callbackData) {
    var finished = false
      , finish = function(err) {
        console.log('calling finish')
        if (!finished) {
          if (err) {
            finished = true
            callback(err)
          } else {
            active = active - 1
            if (active < 1) {
              callback(null)
            }
          }
        }
      }
      , active

    if (err)
      callback(err)
    else {
      active = callbackData.length
      callbackData.forEach(function(obj) {
        var headers = {
                'content-type': contentType
              , 'link': stringifyLink([
                  {
                      rel: 'hub'
                    , href: self.hubUrl
                  }
                , {
                      rel: 'self'
                    , href: topicUrl
                  }
                ])
            }
          , secret = obj.data.secret

        if (secret)
          headers['X-Hub-Signature'] = 'sha1=' + crypto.createHmac('sha1', secret).update(content).digest('hex')

        request.post(
            obj.href
          , {
              headers: headers
            , body: content
            }
          , finish
        )
      })
    }
  })
}

module.exports = PubHub