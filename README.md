# couch_email_auth [![Build Status](https://travis-ci.org/KlausTrainer/couch_email_auth.svg?branch=master)](https://travis-ci.org/KlausTrainer/couch_email_auth)

couch_email_auth provides passwordless authentication by sending the authenticating user a sign-in link via email. The sign-in link contains an authentication token, which gets exchanged for a CouchDB authentication cookie the first time a user follows the sign-in link. Every authentication token can only be used once. Both the authentication token and the CouchDB authentication cookie have an expiration time, which can be configured independently for each.

You can run couch_email_auth behind CouchDB by using CouchDB's proxy feature. That means that CouchDB will forward HTTP requests that are sent to a particular endpoint (which is configurable), and couch_email_auth doesn't need to bind to a network interface that is reachable from outside. CouchDB's proxy feature is described in detail in the CouchDB documentation [here](http://docs.couchdb.org/en/latest/config/proxying.html).


## Installation

Clone the repo, install the dependencies, create a configuration, and start the server:

```sh
npm install
cp .couch_email_authrc-dist .couch_email_authrc
node index.js
```

Change the configuration in `.couch_email_authrc` according to your needs; in this example we are using port 3000 for the couch_email_auth service.

Assuming that your CouchDB instance is running on `localhost` port `5984`, your admin username is `admin`, and your password is `secret`, run the following commands:

```sh
COUCH=http://admin:secret@localhost:5984
curl -X PUT $COUCH/_config/httpd_global_handlers/_couch_email_auth \
  --data-binary '"{couch_httpd_proxy, handle_proxy_req, <<\"http://localhost:3000\">>}"'
```

couch_email_auth should now be available via your CouchDB instance at `http://localhost:5984/_couch_email_auth`.


## Usage

Send the following `POST`-request to the couch_email_auth endpoint:

```sh
curl -H Content-Type:application/json -X POST \
  http://localhost:5984/_couch_email_auth --data-binary '{"redirectUrl": "http://example.com/app", "email": "andy@example.com", "username": "Andy"}'
```

### Request parameters

| Name          | Description                                   | Required |
| ------------- | --------------------------------------------- | -------- |
| `redirectUrl` | redirect to this URL after authentication     | yes      |
| `email`       | the email address the sign-in link is sent to | yes      |
| `username`    | a username                                    | no       |

### Email Template

For configuring the template file to be used for sign-in emails, see the `template` configuration in the configuration file's `email` section.

The following variables are available in the template:

| Name           | Description      |
| -------------- | ---------------- |
| `username`     | the username     |
| `sign_in_link` | the sign-in link |
