"use strict";

process.env.NODE_ENV = 'test';

// custom testconfig
process.argv = [
  'node', // will get stripped by rc
  '/Users/robert/couch_email_auth/test/config.js', // will get stripped by rc
  '--config',
  'test/fixtures/testcustomrc'
];

var test = require('tape'),
    config = require('../lib/config');

test('simple', function(t) {
  var conf = config();
  t.equal(conf.email.template, 'test/fixtures/mail_template')
  t.end();
});
