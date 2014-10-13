"use strict";

var EMAIL_REGEX = /.+@.+/,
    http = require('http'),
    qs = require('querystring'),
    config = require('./config')(),
    nano = require('nano')(config.couchDbBaseUrl),
    db = nano.use(config.usersDb),
    crypto = require('crypto'),
    nodemailer = require('nodemailer'),
    transporter = nodemailer.createTransport(config.smtp),
    render = require('../lib/template');

exports.run = function(cb) {
  var host = config.host,
      port = config.port,
      server,
      callback = cb !== undefined ? function() { cb(server); } : function() {};

  server = http.createServer(function(req, resp) {
    if (req.method == 'POST') {
      handlePost(req, resp);
    } else if (req.method == 'GET') {
      handleGet(req, resp);
    } else {
      resp.setHeader('Allow', 'GET,POST');
      resp.statusCode = 405;
      resp.end();
    }
  });

  server.listen(port, host, callback);
}

function handlePost(req, resp) {
  var body = '';

  req.on('data', function(data) {
    body += data;
  });

  req.on('end', function() {
    var mailOptions,
        email,
        username,
        json;

    try {
      json = JSON.parse(body);
      email = json.email;
      username = json.username;
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

    db.get('org.couchdb.user:' + email, function(err, data) {
      var doc,
          authToken;

      if (err && err.error === 'not_found') {
        doc = {
          _id: 'org.couchdb.user:' + email,
          type: 'user',
          name: email,
          username: username,
          roles: []
        };
      } else if (err) {
        resp.statusCode = 500;
        resp.end('{"error":"database connection error"}');
        return;
      } else {
        doc = data;
      }

      authToken = crypto.randomBytes(32).toString('hex');
      setPassword(doc, authToken);
      doc.timestamp = new Date().getTime();
      if (username) {
        doc.username = username;
      }

      db.insert(doc, function(err, d) {
        var signInLink;

        if (err) {
          resp.statusCode = 500;
          resp.end('{"error":"could not save login credentials"}');
          return;
        }

        signInLink = 'http://' + req.headers.host + req.url +
                     '?email=' + email + '&token=' + authToken;

        mailOptions = {
          from: config.email.from, // sender address
          to: email, // list of receivers
          subject: '', // Subject line
          // plaintext body
          text: render({
            sign_in_link: signInLink,
            username: doc.username
          })
        };

        transporter.sendMail(mailOptions, function(error, responseObj) {
          if (error) {
            resp.statusCode = 500;
            resp.end('{"error":"could not send login credentials"}');
          } else {
            resp.end('{"ok":true}');
          }
        });
      });
    });
  });
}

function handleGet(req, resp) {
  var query = qs.parse(req.url.split('?')[1]);

  if (!query.email) {
    resp.statusCode = 400;
    resp.end("{\"error\":\"missing 'email' query parameter\"}");
    return;
  }

  if (!query.token) {
    resp.statusCode = 400;
    resp.end("{\"error\":\"missing 'token' query parameter\"}");
    return;
  }

  if (query.email.match(EMAIL_REGEX) === null) {
    resp.statusCode = 400;
    resp.end('{"error":"invalid email"}');
    return;
  }

  db.get('org.couchdb.user:' + query.email, function(err, doc) {
    var now = new Date().getTime();

    if (err || !doc.timestamp) {
      resp.statusCode = 401;
      resp.end('{"error":"unauthorized"}');
      return;
    }

    if (doc.timestamp + config.sessionTimeout * 1000 < now) {
      resp.statusCode = 401;
      resp.end('{"error":"unauthorized"}');
      return;
    }

    nano.auth(query.email, query.token, function (err, body, headers) {
      if (err || !headers['set-cookie']) {
        resp.statusCode = 401;
        resp.end('{"error":"unauthorized"}');
        return;
      }

      // now let's make sure that the token cannot be used again

      setPassword(doc, crypto.randomBytes(32).toString('hex'));
      doc.timestamp = 0;

      db.insert(doc, function(err, d) {
        if (err) {
          resp.statusCode = 500;
          resp.end();
          return;
        }

        resp.setHeader('Set-Cookie', headers['set-cookie']);
        resp.statusCode = 200;
        resp.end(JSON.stringify(body));
      });
    });
  });
}

function setPassword(doc, password) {
  delete doc.password_scheme;
  delete doc.iterations;
  delete doc.derived_key;
  delete doc.salt;

  doc.password = password;

  return doc;
}
