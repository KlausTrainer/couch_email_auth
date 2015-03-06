# couch_email_auth [![Build Status](https://travis-ci.org/KlausTrainer/couch_email_auth.svg?branch=master)](https://travis-ci.org/KlausTrainer/couch_email_auth)

couch_email_auth provides passwordless authentication by sending the authenticating user a sign-in link via email. The sign-in link contains an authentication token, which gets exchanged for a CouchDB authentication cookie the first time a user follows the sign-in link.

Every authentication token can only be used once, and as soon as a new token is used, any existing CouchDB authentication cookie is invalidated. Both the authentication token and the CouchDB authentication cookie have an expiration time, which can be configured independently for each.

You can run couch_email_auth as a server behind CouchDB, using CouchDB's proxy feature, which is described in detail in the CouchDB documentation [here](http://docs.couchdb.org/en/latest/config/proxying.html). Let's start with a brief walk-through:

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
  http://localhost:5984/_couch_email_auth --data-binary '{"email": "andy@example.com","username": "Andy"}'
```

### Request parameters

```
email       (required)    The email address the sign-in link is sent to
username    (optional)    A username
```

### Templates

We are currently providing two template variables:

```
username        The username
sign_in_link    The sign-in link
```
