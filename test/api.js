"use strict";

var test = require('tape'),
    s = require('../lib/server'),
    testRequest = require('./test_helper').testRequest;

var address, port, server;

test('setup', function(t) {
  s.run(function(instance) {
    server = instance;
    address = server.address().address;
    port = server.address().port;
    t.end();
  }, 0, '127.0.0.1');
});

test('POST /', function(t) {
  var context = {address: address, port: port, t: t};

  testRequest(
    context, 'POST to / fails with empty body',
    'POST', null,
    400, '{"error":"invalid request JSON"}');

  testRequest(
    context, 'POST to / fails with no email property',
    'POST', '{"foo":42}',
    400, '{"error":"invalid email"}');

  testRequest(
    context, 'POST to / fails with wrong email address',
    'POST', '{"email":42}',
    400, '{"error":"invalid email"}');

  testRequest(
    context, 'POST to / fails with wrong email address',
    'POST', '{"email":"foo@bar"}',
    400, '{"error":"invalid email"}');

  testRequest(
    context, 'POST to / works with valid email address',
    'POST', '{"email":"foobator@example.com"}',
    200, '{"ok":true}');

  t.end();
});

test('teardown', function(t) {
  server.close();
  t.end();
});
