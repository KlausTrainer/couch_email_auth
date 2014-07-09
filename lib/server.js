"use strict";

var http = require('http'),
    qs = require('querystring'),
    config = require('./config'),
    db = require('nano')(config.couchDbBaseUrl + '/' + config.usersDb),
    crypto = require('crypto');

exports.run = function(options, cb) {
  options = options !== undefined ? options : {};
  var port = options.port !== undefined ? options.port : (process.env['COUCH_EMAIL_AUTH_PORT'] || 1337),
      host = options.host !== undefined ? options.host : '127.0.0.1',
      callback = cb !== undefined ? function() { cb(server); } : function() {};

  var server = http.createServer(function(req, resp) {
    var EMAIL_REGEX = /.+@.+\..+/;

    if (req.method == 'POST') {
      var body = '';

      req.on('data', function(data) {
        body += data;
      });

      req.on('end', function() {
        var query = qs.parse(req.url),
            email;

        try {
          email = JSON.parse(body).email;
        } catch(e) {
          resp.statusCode = 400;
          resp.end('{"error":"invalid request JSON"}');
          return;
        }

        if (typeof email !== 'string' || email.match(EMAIL_REGEX) === null) {
          resp.statusCode = 400;
          resp.end('{"error":"invalid email"}');
          return;
        }

        db.get('org.couchdb.user:' + email, function(err, body) {
          var docId = 'org.couchdb.user:' + email,
              doc;

          if (err && err.error === 'not_found') {
            doc = {
              _id: docId,
              type: 'user',
              name: email,
              roles: []
            };
          } else if (err) {
            resp.statusCode = 500;
            resp.end('{"error":"database connection error"}');
            return;
          } else {
            doc = body;
          }

          setPassword(doc, crypto.randomBytes(32).toString('hex'));
          doc.timestamp = new Date().getTime();

          db.insert(doc, docId, function(err, body) {
            if (err) {
              resp.statusCode = 500;
              resp.end('{"error":"could not save login credentials"}');
            } else {
              resp.end('{"ok":true}');
            }
          });
        });
      });
    }
  });

  server.listen(port, host, callback);

  return server;
}

function setPassword(doc, password) {
  delete doc.password_scheme;
  delete doc.iterations;
  delete doc.derived_key;
  delete doc.salt;

  doc.password = password;

  return doc;
}
