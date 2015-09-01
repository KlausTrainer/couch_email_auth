'use strict';

process.env.NODE_ENV = 'test';
// custom testconfig
process.argv = [
  'node', // will get stripped by rc
  '/Users/robert/couch_email_auth/test/config.js', // will get stripped by rc
  '--config',
  'test/fixtures/add_auth_session_to_redirect_url_rc'
];


// delete the cache in order to make sure that a new config is getting loaded
delete require.cache[require.resolve('../lib/server')];

var test = require('tape'),
    url = require('url'),
    s = require('../lib/server'),
    request = require('request'),
    cookie = require('cookie'),
    config = require('../lib/config')(),
    couchDbBaseUrl = config.couchDbBaseUrl,
    redirectUrl = couchDbBaseUrl + '/?foo=true',
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
  var emailBody;

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


  t.test('redirect URL contains the `AuthSession` cookie value', function(t) {
    request({
      method: 'POST',
      uri: uri,
      json: true,
      body: {
        redirectUrl: redirectUrl,
        email: 'rockoartischocko@example.com'
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
        var cookieObject = cookie.parse(response.headers['set-cookie'][0]),
            queryParams = url.parse(response.headers['location'], true).query;

        t.equal(response.statusCode, 302);
        t.equal(queryParams.AuthSession, cookieObject.AuthSession);

        t.end();
      });
    });
  });
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
