(function() {
  var VERSION, config, configPath, emptyHeaders, endHeaders, endParams, endpoint, flush, fs, http, log, pixel, nscHeaders, querystring, record, serialize, server, store, url;
  var __hasProp = Object.prototype.hasOwnProperty;
  fs = require('fs');
  url = require('url');
  http = require('http');
  request = require('request');
  querystring = require('querystring');
  VERSION = '0.1.0';
  tmp_store = {};
  store = {};  
  requestQueue = {};
  visits_counter = {};
  record = function(params) {

    var target_url;
    if (!(target_url = params.query == null ? undefined : params.query.url)) {
      return null;
    }

    var pieces = target_url.split('_');
    var nid = pieces.slice(-1).pop();
    var nid = parseInt(nid);
    console.log(nid);
    if(isNaN(nid)){
      console.log('No nid found');
      return;
    }

    var key = 'node_'+nid;   

    // add to queue
    requestQueue[key] = {};

    //if(expired){

      // Visits
      getVisitsCount(key, target_url);

      // Facebook
      getFacebookCount(key, target_url);
      
      // Twitter
      getTwitterCount(key, target_url);
      
      // Google+
      getGoogleCount(key, target_url);
    //}


  };

  getFacebookCount = function(key, target_url){
    var options = {
      host: 'api.facebook.com',
      path: '/method/fql.query?query=select%20total_count,%20share_count,%20like_count,%20comment_count%20from%20link_stat%20where%20url%20="'+target_url+'"',
    };
    var req = http.request(options, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        var parseString = require('xml2js').parseString;
        parseString(chunk, function(err, result) {
          var fb_count = result.fql_query_response.link_stat[0].total_count[0];
          requestQueue[key].fb_count = parseInt(fb_count);
        });
      });
    });
    req.on('error', function(e) {
      console.log('ERROR: ' + e.message);
    });
    req.end();
  };


  getTwitterCount = function(key, target_url){
    http.get('http://cdn.api.twitter.com/1/urls/count.json?url='+target_url, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        var json = JSON.parse(chunk);
          requestQueue[key].tw_count = parseInt(json.count);
      });
    }).on('error', function(e) {
      console.log("Got error: " + e.message);
    });
  };

  getGoogleCount = function(key, target_url){
    request.post({
      uri:"https://clients6.google.com/rpc?key=AIzaSyCKSbrvQasunBoV16zDH9R33D88CeLr9gQ",
      headers:{'content-type': 'application/json'},
      body:'[{"method":"pos.plusones.get","id":"p","params":{"nolog":true,"id":"'+target_url+'","source":"widget","userId":"@viewer","groupId":"@self"},"jsonrpc":"2.0","key":"p","apiVersion":"v1"}]'
      }, function(err,res,body){
        body = JSON.parse(body);
        requestQueue[key].g_count = parseInt(body[0].result.metadata.globalCounts.count);
      }
    );
  };

  getVisitsCount = function(key, target_url){    
    visits_counter[key] || (visits_counter[key] = 0);
    visits_counter[key] += 1;
    //console.log(visits_counter);

  };

  getCompletedKeys = function(){

    for (var key in requestQueue){
      if (requestQueue.hasOwnProperty(key)) {
        tmp_store[key] = {};
      
        if(typeof requestQueue[key].fb_count === 'number'){
          tmp_store[key].fb_count = requestQueue[key]['fb_count'];
        }        
        if(typeof requestQueue[key].tw_count === 'number'){
          tmp_store[key].tw_count = requestQueue[key]['tw_count'];
        }
        if(typeof requestQueue[key].g_count === 'number'){
          tmp_store[key].g_count = requestQueue[key]['g_count'];
        }

        if(typeof tmp_store[key].fb_count === 'number' && 
           typeof tmp_store[key].tw_count === 'number' && 
           typeof tmp_store[key].g_count === 'number' ){
          
          tmp_store[key].visits = visits_counter[key];
          delete visits_counter[key];

          store[key] = tmp_store[key];
          delete requestQueue[key]; // remove from queue
        }
      }
    };

    return store;
  };

  serialize = function() {
    var data;
    getCompletedKeys(); 
    if(JSON.stringify(store) != '{}'){
      data = {
        json: JSON.stringify(store)
      };
      store = {};
      if (config.secret) {
        data.secret = config.secret;
      }
      console.log(data);
      querystr = querystring.stringify(data);
      return querystr;
    } else {
      return null;
    }
  };

  flush = function() {
    var data, request;
    log(store);
    if (!(config.endpoint)) {
      return null;
    }
    data = serialize();
    if(data != null){
        endHeaders['Content-Length'] = data.length;
        request = endpoint.request('POST', endParams.pathname, endHeaders);
        request.write(data);
        request.end();
      return request.on('response', function(response) {
        return console.info('--- flushed ---');
      });
    } else {
      return console.info('--- flushed ---');
    }
  };
  log = function(hash) {
    var _a, _b, hits, key;
    _a = []; _b = hash;
    for (key in _b) {
      if (!__hasProp.call(_b, key)) continue;
      hits = _b[key];
      _a.push(console.info("" + (hits) + ":\t" + (key)));
    }
    return _a;
  };
  server = http.createServer(function(req, res) {
    var params;
    params = url.parse(req.url, true);
    if (params.pathname === '/pixel.gif') {
      res.writeHead(200, nscHeaders);
      res.end(pixel);
      record(params);
    } else {
      res.writeHead(404, emptyHeaders);
      res.end('');
    }
    return null;
  });
  configPath = process.argv[2];
  if (('-v' === configPath || '-version' === configPath || '--version' === configPath)) {
    console.log("Node Social Counter version " + (VERSION));
    process.exit(0);
  }
  if (!configPath || (('-h' === configPath || '-help' === configPath || '--help' === configPath))) {
    console.error("Usage: nsc path/to/config.json");
    process.exit(0);
  }
  config = JSON.parse(fs.readFileSync(configPath).toString());
  pixel = fs.readFileSync(__dirname + '/pixel.gif');
  nscHeaders = {
    'Cache-Control': 'private, no-cache, proxy-revalidate',
    'Content-Type': 'image/gif',
    'Content-Disposition': 'inline',
    'Content-Length': pixel.length
  };
  emptyHeaders = {
    'Content-Type': 'text/html',
    'Content-Length': '0'
  };
  if (config.endpoint) {
    console.info("Flushing hits to " + (config.endpoint));
    endParams = url.parse(config.endpoint);
    endpoint = http.createClient(endParams.port || 80, endParams.hostname);
    endHeaders = {
      'host': endParams.host,
      'Content-Type': 'application/x-www-form-urlencoded'
    };
  } else {
    console.warn("No endpoint set. Hits won't be flushed, add \"endpoint\" to " + (configPath) + ".");
  }
  process.on('SIGUSR1', function() {
    console.log('Got SIGUSR1. Forcing a flush:');
    return flush();
  });
  process.on('uncaughtException', function(err) {
    return console.error("Uncaught Exception: " + (err));
  });
  server.listen(config.port, config.host);
  setInterval(flush, config.interval * 1000);
})();
