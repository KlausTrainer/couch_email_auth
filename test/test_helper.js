"use strict";

var request = require('request');

exports.testRequest = function(context, testDescription, requestMethod, requestBody, expectedStatusCode, expectedBody) {
  var t = context.t;

  t.test(testDescription, function(t)  {
    request({
      method: requestMethod,
      uri: context.uri,
      body: requestBody
    }, function(err, response, body) {
      t.equal(response.statusCode, expectedStatusCode);
      t.equal(body, expectedBody);
      t.end();
    });
  });
};
