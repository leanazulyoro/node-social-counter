Node Social Counter
===================
A node-js server to provide social sharing, and visits statistics. It outsources the heavy work of performing the several request to each social network and responses with the collected data to a url of your choosing where you can for example save it to a database.

===================
Prerequisites: 
===================
For Node Social Counter to work, you need node.js (nodejs.org) and npm (comes with node.js) installed in the server

===================
Installation & set up
===================
1) Download node-social-counter from https://github.com/leanazulyoro/node-social-counter You can download the zipball, or use git to clone: $ git clone https://github.com/leanazulyoro/node-social-counter.git

2) Install dependencies: 
$ cd /path/to/realtime-node-js 
$ npm install

The "node_modules" directory is created with the following modules in it:
- node-syslog
- request
- xml2js

3) create a configuration json file (see config.example.json) with the following data:
{
  "port":     "9187",
  "host":     "127.0.0.1",
  "interval": 5,
  "recalc_after": 20,
  "logging": true,
  "endpoint": "http://www.example.com/nsc/save_counts"
}

Host & port: the ip address or domain for the host the server is installed in.
Interval: this value sets the interval (in seconds) in which collected data is sent to the procesing server
Recalc_after: this value specifies the amount of time (in seconds) that a given url is ignored before it is recalculated
Logging: enables logging to syslog when requests fail
Endpoint: this is the url where collected data will be sent to (via POST).

4) Start the service, specifing the path to the configuration file:
$ node /path/to/node-social-counter/bin/nsc /path/to/config.json

