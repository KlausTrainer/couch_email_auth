"use strict";

process.env.NODE_ENV = 'test';

var test = require('tape'),
    config = require('../lib/config');

var address, port, server, smtp;

test('simple', function(t) {
  config('./fixtures/testrc', function(err, conf) {
    t.notOk(err);
    t.Ok(conf);
    t.end();
  });
});
