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
    render = require('../lib/template');

test('simple', function(t) {
  var mail = render({link: 'http://example.com'});
  t.equal(mail, 'Testtemplatetext - http://example.com\n');
  t.end();
});
