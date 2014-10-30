Node Social Counter
===================
A node-js server to provide social sharing, and visits statistics. It outsources the heavy work of performing the several request to each social network and responses with the collected data to a url of your choosing where you can for example save it to a database.

Prerequisites: 
===================
For Node Social Counter to work, you need node.js (nodejs.org) and npm (comes with node.js) installed in the server

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
  "interval": 5, // cada cuanto flushea
  "recalc_after": 20, // cada cuanto vuelve a consultar a las APIS de las redes una misma url
  "logLevel": ["INFO", "ERROR", "DEBUG"],
  "endpoint": "http://local.stable.tn.com.ar/nsc/save_counts", // a donde hace el POST (flush)
  "flushtimeout": 10, // timeout del POST (flush)
  "safe_hosts": ["tn.com.ar", "prepro.tn.com.ar", "local.next.tn.com.ar", "local.stable.tn.com.ar", "pre.tn.com.ar"],
  "facebook": { // Facebook settings
    "timeout": 5,
    "hits_required": 3 // hits required to add to facebook's queue
  },
  "twitter": { // Twitter settings
    "timeout": 5,
  },
  "google": { // Google settings
    "timeout": 5,
  }
}

4) Start the service, specifing the path to the configuration file:
$ /path/to/node-social-counter/bin/nsc /path/to/config.json

