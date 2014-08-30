"use strict";

var http = require('http'),
    qs = require('querystring'),
    config = require('./config')(),
    db = require('nano')(config.couchDbBaseUrl + '/' + config.usersDb),
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
    }
  });

  server.listen(port, host, callback);
}

function handlePost(req, resp) {
  var EMAIL_REGEX = /.+@.+\..+/,
      body = '';

  req.on('data', function(data) {
    body += data;
  });

  req.on('end', function() {
    var query = qs.parse(req.url),
        mailOptions,
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
      var docId = 'org.couchdb.user:' + email,
          doc;

      if (err && err.error === 'not_found') {
        doc = {
          _id: docId,
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

      setPassword(doc, crypto.randomBytes(32).toString('hex'));
      doc.timestamp = new Date().getTime();

      db.insert(doc, docId, function(err, d) {
        if (err) {
          resp.statusCode = 500;
          resp.end('{"error":"could not save login credentials"}');
          return;
        }

        mailOptions = {
          from: config.email.from, // sender address
          to: email, // list of receivers
          subject: '', // Subject line
          // plaintext body
          text: render({
            sign_in_link: 'http://' + req.headers.host + req.url,
            username: doc.username
          })
        };

        transporter.sendMail(mailOptions, function(error, responseObj) {
          if (error) {
            resp.statusCode = 500;
            resp.end('{"error":"could not save login credentials"}');
          } else {
            resp.end('{"ok":true}');
          }
        });
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
