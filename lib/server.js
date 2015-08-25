"use strict";

var Hapi = require('hapi'),
    Boom = require('boom'),
    Joi = require('joi'),
    config = require('./config')(),
    nano = require('nano')(config.couchDbBaseUrl),
    db = nano.use(config.usersDb),
    assert = require('assert'),
    buffer = require('buffer'),
    crypto = require('crypto'),
    nodemailer = require('nodemailer'),
    transporter = nodemailer.createTransport(config.smtp),
    render = require('../lib/template'),
    server = new Hapi.Server();

server.connection({host: config.host, address: config.host, port: config.port});

exports.run = function(cb) {
  var callback = cb !== undefined ? function() { cb(server); } : function() {};

  server.start(callback);
};

server.route({
  path: '/{serverpath*}',
  method: 'POST',
  config: {
    validate: {
      payload: {
        email: Joi.string().email().required(),
        username: Joi.string().optional()
      }
    }
  },
  handler: function(request, reply) {
    var json = request.payload,
        email = json.email,
        username = json.username,
        mailOptions;

    db.get('org.couchdb.user:' + email, function(err, data) {
      var doc,
          password,
          secret,
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
        reply(Boom.badImplementation('database connection error'));
        return;
      } else {
        doc = data;
      }

      if (typeof doc.couch_email_auth_password !== 'string'
          || doc.couch_email_auth_password.length !== config.tokenSize * 2) {
        password = crypto.randomBytes(config.tokenSize);
        doc.couch_email_auth_password = password.toString('hex');
        setPassword(doc, doc.couch_email_auth_password);
      } else {
        password = new Buffer(doc.couch_email_auth_password, 'hex');
      }

      secret = crypto.randomBytes(config.tokenSize);
      doc.couch_email_auth_secret = secret.toString('hex');
      doc.couch_email_auth_timestamp = new Date().getTime();
      authToken = xor(password, secret).toString('hex');

      if (username) {
        doc.username = username;
      }

      db.insert(doc, function(err) {
        var serverpath = '',
            signInLink;

        if (request.params.serverpath) {
          serverpath = '/' + request.params.serverpath;
        }

        if (err) {
          reply(Boom.badImplementation('database connection error'));
          return;
        }

        signInLink = config.scheme + '://' + request.headers.host + serverpath +
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

        transporter.sendMail(mailOptions, function(error) {
          if (error) {
            reply(Boom.badImplementation('could not send login credentials'));
            return;
          }
          reply({ok: "true"});
        });
      });
    });
  }
});

server.route({
  path: '/{serverpath*}',
  method: 'GET',
  config: {
    validate: {
      query: {
        email: Joi.string().email().required(),
        token: Joi.string().length(config.tokenSize * 2).required()
      }
    }
  },
  handler: function(request, reply) {
    db.get('org.couchdb.user:' + request.query.email, function(err, doc) {
      var now = new Date().getTime(),
          token,
          secret,
          password;

      function createUnauthorizedError() {
        return Boom.unauthorized('unauthorized');
      }

      if (err || !doc.couch_email_auth_timestamp) {
        reply(createUnauthorizedError());
        return;
      }

      if (doc.couch_email_auth_timestamp + config.tokenExpiryTime * 1000 < now) {
        reply(createUnauthorizedError());
        return;
      }

      token = new Buffer(request.query.token, 'hex');
      secret = new Buffer(doc.couch_email_auth_secret, 'hex');
      password = xor(token, secret).toString('hex');

      nano.auth(request.query.email, password, function(err, body, headers) {
        if (err || !headers['set-cookie']) {
          reply(createUnauthorizedError());
          return;
        }

        // now let's make sure that the token cannot be used again
        doc.couch_email_auth_timestamp = 0;

        db.insert(doc, function(err) {
          if (err) {
            reply(Boom.badImplementation('database connection error'));
            return;
          }

          reply(body)
            .header('Set-Cookie', headers['set-cookie'])
            .redirect(config.redirectLocation);
        });
      });
    });
  }
});


function setPassword(doc, password) {
  delete doc.password_scheme;
  delete doc.iterations;
  delete doc.derived_key;
  delete doc.salt;

  doc.password = password;

  return doc;
}

/* xor two buffers of equal length */
function xor(a, b) {
  assert.equal(a.length, b.length);

  var length = a.length,
      result = new Buffer(length);

  for (var i = 0; i < length; i++) {
    result[i] = a[i] ^ b[i];
  }

  return result;
}
