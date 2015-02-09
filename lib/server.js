"use strict";

var Hapi = require('hapi'),
    Boom = require('boom'),
    Joi = require('joi'),
    config = require('./config')(),
    nano = require('nano')(config.couchDbBaseUrl),
    db = nano.use(config.usersDb),
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
      },
      failAction: function(request, reply, source, err) {
        var error = Boom.badRequest();
        error.output.payload = '{"error":"invalid email"}';
        reply(error);
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
          authToken,
          error;

      if (err && err.error === 'not_found') {
        doc = {
          _id: 'org.couchdb.user:' + email,
          type: 'user',
          name: email,
          username: username,
          roles: []
        };
      } else if (err) {
        error = Boom.badImplementation();
        error.output.payload = '{"error":"database connection error"}';
        reply(error);
        return;
      } else {
        doc = data;
      }

      authToken = crypto.randomBytes(32).toString('hex');
      doc.couch_email_auth_secret = crypto.randomBytes(32).toString('hex');
      setPassword(doc, authToken + doc.couch_email_auth_secret);

      doc.couch_email_auth_timestamp = new Date().getTime();

      if (username) {
        doc.username = username;
      }

      db.insert(doc, function(err, d) {
        var serverpath = '',
            signInLink;

        if (request.params.serverpath) {
          serverpath = '/' + request.params.serverpath;
        }

        if (err) {
          error = Boom.badImplementation();
          error.output.payload = '{"error":"database connection error"}';
          reply(error);
          return;
        }

        signInLink = 'http://' + request.headers.host + serverpath +
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
            error = Boom.badImplementation();
            error.output.payload = '{"error":"could not send login credentials"}';
            reply(error);
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
        token: Joi.string().required()
      },
      failAction: function(request, reply, source, err) {
        var error;

        if (/email.*required/.test(err.message)) {
          error = Boom.badRequest();
          error.output.payload = '{"error":"missing \'email\' query parameter"}';
        }
        if (/token.*required/.test(err.message)) {
          error = Boom.badRequest();
          error.output.payload = '{"error":"missing \'token\' query parameter"}';
        }
        if (/valid.*email/.test(err.message)) {
          error = Boom.badRequest();
          error.output.payload = '{"error":"invalid email"}';
        }
        if (/token.*email/.test(err.message)) {
          error = Boom.badRequest();
          error.output.payload = '{"error":"invalid email"}';
        }

        reply(error);
      }
    }
  },
  handler: function (request, reply) {
    db.get('org.couchdb.user:' + request.query.email, function(err, doc) {
      var now = new Date().getTime(),
          password,
          error;

      function createUnauthorizedError() {
        var error = Boom.unauthorized();

        error.output.payload = '{"error":"unauthorized"}';
        return error;
      }

      if (err || !doc.couch_email_auth_timestamp) {
        reply(createUnauthorizedError());
        return;
      }

      if (doc.couch_email_auth_timestamp + config.sessionTimeout * 1000 < now) {
        reply(createUnauthorizedError());
        return;
      }

      password = request.query.token + doc.couch_email_auth_secret;

      nano.auth(request.query.email, password, function (err, body, headers) {
        if (err || !headers['set-cookie']) {
          reply(createUnauthorizedError());
          return;
        }

        // now let's make sure that the token cannot be used again
        doc.couch_email_auth_timestamp = 0;

        db.insert(doc, function(err, d) {
          if (err) {
            reply({error: true});
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
