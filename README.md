# couch_email_auth [![Build Status](https://travis-ci.org/KlausTrainer/couch_email_auth.svg?branch=master)](https://travis-ci.org/KlausTrainer/couch_email_auth)

couch_email_auth provides passwordless authentication using tokens that are sent using email. After using the token the user gets a cookie that is valid for a predefined time. If the token got used once to get access it is invalidated.

You can run couch_email_auth as a server behind a CouchDB using the proxy-feature. It is described in detail in the [CouchDB Docs](http://docs.couchdb.org/en/latest/config/proxying.html) but let us provide a short walkthrough:

After cloning the repo, install the dependencies and create a configuration, start the server:

```
npm install
cp .couch_email_authrc-dist .couch_email_authrc
node index.js
```

Change the configuration saved in `couch_email_authrc` to your needs, in this expample we are using port 3000 for the service.

Start your couchdb:

```
(sudo) couchdb

```

Given your admin username is `admin`, your password `secret` and the port of your Couch `5984` run:

```
COUCH=http://admin:secret@localhost:5984
curl -X PUT $COUCH/_config/httpd_global_handlers/_couch_email_auth \
  -d '"{couch_httpd_proxy, handle_proxy_req, <<\"http://localhost:3000\">>}"'
```

**restart CouchDB**

couch_email_auth is now available for your CouchApps and other applications at `http://localhost:5984/_couch_email_auth` - the same domain the CouchDB uses which is important as we are using cookies with timeouts for authentication after you received your email.


## Usage

Send a `POST` request containing JSON to the endpoint:

```
curl -H Content-Type:application/json -X POST \
http://localhost:3000 --data-binary '{"email": "andy@example.com","username": "Andy"}'
```

### Request parameters

```
email       (required)    The email address the token is getting mailed
username    (optional)    The username of the user
```

### Templates

We are currently providing two template variables:

```
username        The name of the user that tries to authenticate
sign_in_link    The link that is used to authenticate
```
