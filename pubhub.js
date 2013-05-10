function PubHub(db) {
  if (!(this instanceof PubHub))
    return new PubHub(db)

  this.db = db
}

PubHub.prototype.dispatch = function(req, res) {
  res.writeHead(400)
  res.end()
}

module.exports = PubHub