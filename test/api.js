"use strict";

process.env.NODE_ENV = 'test';
// custom testconfig
process.argv = [
  'node', // will get stripped by rc
  '/Users/robert/couch_email_auth/test/config.js', // will get stripped by rc
  '--config',
  'test/fixtures/integrationtestrc'
];

var test = require('tape'),
    s = require('../lib/server'),
    crypto = require('crypto'),
    request = require('request'),
    testRequest = require('./test_helper').testRequest,
    config = require('../lib/config')(),
    couchDbBaseUrl = config.couchDbBaseUrl,
    couchDbSessionUrl = couchDbBaseUrl + '/_session',
    db = require('nano')(couchDbBaseUrl + '/' + config.usersDb),
    simplesmtp = require('simplesmtp');

var uri, server, smtp;

test('setup', function(t) {
  s.run(function(instance) {
    server = instance;
    uri = server.info.uri;

    // setup CouchDB with test config
    request({
      method: 'PUT',
      uri: couchDbBaseUrl + '/_config/couch_httpd_auth/authentication_db',
      body: '"' + config.usersDb + '"'
    }, function(err, response, body) {
      t.notOk(err, 'set CouchDB test configuration');
      smtp = simplesmtp.createServer({disableDNSValidation: true});
      smtp.listen(config.smtp.port, function(error) {
        t.notOk(error, 'start smtp server');
        t.end();
      });
    });
  });
});

test('POST /', function(t) {
  var emailBody,
      expectedToEmail,
      expectedFromEmail = 'couch_email_auth@example.com',
      expectedSubject = 'Sign In',
      actualFromEmail,
      actualToEmail,
      actualSubject,
      context = {uri: uri, t: t};

  t.test('setup', function(t) {
    smtp.on("startData", function(connection) {
      emailBody = '';
      actualFromEmail = connection.from;
      actualToEmail = connection.to[0];
      actualSubject = connection.subject;
    });

    smtp.on("data", function(connection, chunk) {
      emailBody += chunk.toString();
    });

    smtp.on("dataReady", function(connection, callback) {
      callback(null, "ABC1" + Math.abs(Math.random() * 1000000)); // ABC1 is the queue id to be advertised to the client
    });

    t.end();
  });

  testRequest(
    context, 'POST to / fails with empty body',
    'POST', null, 400);

  testRequest(
    context, 'POST to / fails with empty JSON object',
    'POST', '{}', 400);

  testRequest(
    context, 'POST to / fails with no email property',
    'POST', '{"foo":42}', 400);

  testRequest(
    context, 'POST to / fails with wrong email address',
    'POST', '{"email":42}', 400);

  testRequest(
    context, 'POST to / fails with wrong email address',
    'POST', '{"email":"test"}', 400);

  [uri, uri + '/foo/bar/baz'].forEach(function(uri) {
    t.test('POST to ' + uri + ' works with valid email address and an email is sent', function(t) {
      expectedToEmail = 'foobator42@localhost',

      request({
        method: 'POST',
        uri: uri,
        json: true,
        body: {
          email: expectedToEmail,
          username: "Local Foo Bator"
        }
      }, function(err, response, body) {
        t.equal(response.statusCode, 200);
        t.ok(body.ok);
        t.equal(actualFromEmail, expectedFromEmail);
        t.equal(actualToEmail, expectedToEmail);
        t.ok(emailBody.indexOf('Hi Local Foo Bator') !== -1, 'mailbody');
        t.ok(emailBody.indexOf(uri) !== -1, 'mailbody');
        t.ok(emailBody.indexOf('http:\/\/') !== -1, 'http scheme is used');
        t.ok(emailBody.indexOf('?email') !== -1, 'url is ok');
        t.end();
      });
    });
  });

  t.test('saves login credentials to CouchDB', function(t) {
    request({
      method: 'POST',
      uri: uri,
      body: '{"email":"foobator@example.com"}'
    }, function(err, response, body) {
      db.get('org.couchdb.user:foobator@example.com', function(err, doc) {
        t.notOk(err, 'document missing');
        t.equal(doc.name, 'foobator@example.com');
        t.equal(typeof doc.couch_email_auth_secret, 'string');
        t.equal(typeof doc.couch_email_auth_password, 'string');
        t.equal(typeof doc.couch_email_auth_timestamp, 'number');
        t.end();
      });
    });
  });

  t.test('using names is possible', function(t) {
    request({
      method: 'POST',
      uri: uri,
      json: true,
      body: {
        email: "rockoartischocko@example.com",
        username: "Rocko Artischocko"
      }
    }, function(err, response, body) {
      db.get('org.couchdb.user:rockoartischocko@example.com', function(err, doc) {
        t.notOk(err, 'document missing');
        t.equal(doc.username, 'Rocko Artischocko');
        t.equal(doc.name, 'rockoartischocko@example.com');
        t.equal(typeof doc.couch_email_auth_secret, 'string');
        t.equal(typeof doc.couch_email_auth_password, 'string');
        t.equal(typeof doc.couch_email_auth_timestamp, 'number');
        t.end();
      });
    });
  });

  t.end();
});

test('GET /', function(t) {
  var email = 'foobator@example.com',
      token = crypto.randomBytes(config.tokenSize).toString('hex'),
      emailBody,
      requestUri = uri;

  t.test('setup', function(t) {
    smtp.on("startData", function(connection) {
      emailBody = '';
    });

    smtp.on("data", function(connection, chunk) {
      emailBody += chunk.toString();
    });

    smtp.on("dataReady", function(connection, callback) {
      callback(null, "ABC1" + Math.abs(Math.random() * 1000000)); // ABC1 is the queue id to be advertised to the client
    });

    t.end();
  });

  t.test('GET to / fails with no email param', function(t) {
    request({
      method: 'GET',
      uri: requestUri + '?token=1234',
      json: true
    }, function(err, response, body) {
      t.equal(response.statusCode, 400);
      t.ok(body.message.match(/"email" is required/));
      t.end();
    });
  });

  t.test('GET to / fails with no token param', function(t) {
    request({
      method: 'GET',
      uri: requestUri + '?email=' + email,
      json: true
    }, function(err, response, body) {
      t.equal(response.statusCode, 400);
      t.ok(body.message.match(/"token" is required/));
      t.end();
    });
  });

  t.test('GET to / fails if email param is invalid', function(t) {
    request({
      method: 'GET',
      uri: requestUri + '?email=test&token=' + token,
      json: true
    }, function(err, response, body) {
      t.equal(response.statusCode, 400);
      t.ok(body.message.match(/"email" must be a valid email/));
      t.end();
    });
  });

  t.test('GET to / fails if token param is invalid', function(t) {
    request({
      method: 'GET',
      uri: requestUri + '?email=' + email + '&token=1234',
      json: true
    }, function(err, response, body) {
      t.equal(response.statusCode, 400);
      t.ok(body.message.match(/"token" length must be 32 characters long/));
      t.end();
    });
  });

  t.test('GET to / fails if email does not exist', function(t) {
    request({
      method: 'GET',
      uri: requestUri + '?email=lalala@example.com&token=' + token,
      json: true
    }, function(err, response, body) {
      t.equal(response.statusCode, 401);
      t.equal(body.error, 'Unauthorized');
      t.equal(body.message, 'unauthorized');
      t.end();
    });
  });

  [requestUri, requestUri + '/foo/bar/baz'].forEach(function(uri) {
    t.test('GET to ' + uri + ' works if email and token are valid', function(t) {
      request({
        method: 'POST',
        uri: uri,
        json: true,
        body: {
          email: email
        }
      }, function(err, response, body) {
        var link;

        t.equal(response.statusCode, 200);
        t.ok(body.ok);

        link = emailBody.match(/([^ ]+)$/)[1];

        request({
          method: 'GET',
          uri: link,
          json: true,
          followRedirect: false
        }, function(err, response, body) {
          var cookie = response.headers['set-cookie'][0].split(';')[0];

          t.equal(response.statusCode, 302);
          t.ok(body.ok);
          t.ok(body.name, email);
          t.equal(response.headers['location'], config.redirectLocation);

          request({
            method: 'GET',
            uri: couchDbSessionUrl,
            json: true,
            headers: {
              cookie: cookie
            }
          }, function(err, response, body) {
            t.equal(response.statusCode, 200);
            t.ok(body.ok);
            t.equal(body.userCtx.name, email);
            t.end();
          });
        });
      });
    });
  });

  t.test('GET to / fails if token has already been used', function(t) {
    request({
      method: 'POST',
      uri: requestUri,
      json: true,
      body: {
        email: email
      }
    }, function(err, response, body) {
      var link;

      t.equal(response.statusCode, 200);
      t.ok(body.ok);

      link = emailBody.match(/([^ ]+)$/)[1];

      request({
        method: 'GET',
        uri: link,
        json: true,
        followRedirect: false
      }, function(err, response, body) {
        t.equal(response.statusCode, 302);
        t.ok(body.ok);

        request({
          method: 'GET',
          uri: link,
          json: true
        }, function(err, response, body) {
          t.equal(response.statusCode, 401);
          t.equal(body.error, 'Unauthorized');
          t.equal(body.message, 'unauthorized');
          t.end();
        });
      });
    });
  });

  t.test('GET to / fails if token is expired', function(t) {
    request({
      method: 'POST',
      uri: requestUri,
      json: true,
      body: {
        email: email
      }
    }, function(err, response, body) {
      var link;

      t.equal(response.statusCode, 200);
      t.ok(body.ok);

      link = emailBody.match(/([^\s]+)$/)[1];

      setTimeout(function() {
        request({
          method: 'GET',
          uri: link,
          json: true
        }, function(err, response, body) {
          t.equal(response.statusCode, 401);
          t.equal(body.error, 'Unauthorized');
          t.equal(body.message, 'unauthorized');
          t.end();
        });
      }, 1000);
    });
  });

  t.test('getting new tokens for the same user does not invalidate existing sessions', function(t) {
    var postRequestOptions = {
      method: 'POST',
      uri: uri,
      json: true,
      body: {
        email: email
      }
    };

    request(postRequestOptions, function(err, response, body) {
      var link;

      t.equal(response.statusCode, 200);
      t.ok(body.ok);

      link = emailBody.match(/([^ ]+)$/)[1];

      request({
        method: 'GET',
        uri: link,
        json: true,
        followRedirect: false
      }, function(err, response, body) {
        var cookie = response.headers['set-cookie'][0].split(';')[0];

        var sessionRequestOptions = {
          method: 'GET',
          uri: couchDbSessionUrl,
          json: true,
          headers: {
            cookie: cookie
          }
        };

        request(sessionRequestOptions, function(err, response, body) {
          t.equal(response.statusCode, 200);
          t.ok(body.ok);
          t.equal(body.userCtx.name, email);

          request(postRequestOptions, function(err, response, body) {
            t.equal(response.statusCode, 200);
            t.ok(body.ok);

            request(sessionRequestOptions, function(err, response, body) {
              t.equal(response.statusCode, 200);
              t.ok(body.ok);
              t.equal(body.userCtx.name, email);
              t.end();
            });
          });
        });
      });
    });
  });

  t.end();
});

test('teardown', function(t) {
  server.stop();

  // reset CouchDB config
  request({
    method: 'PUT',
    uri: couchDbBaseUrl + '/_config/couch_httpd_auth/authentication_db',
    body: '"_users"'
  }, function(err, response, body) {
    t.notOk(err, 'reset CouchDB test configuration');
    smtp.end(function() {
      t.end();
    });
  });
});
