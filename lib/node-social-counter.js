(function() {
  var VERSION, config, configPath, emptyHeaders, endHeaders, endParams, endpoint, flush, fs, http, log, pixel, nscHeaders, querystring, record, serialize, server, store, url;
  var __hasProp = Object.prototype.hasOwnProperty;
  fs = require('fs');
  url = require('url');
  http = require('http');
  request = require('request');
  querystring = require('querystring');
  Syslog = require('node-syslog');
    
  VERSION = '0.1.0';
  tmp_store = {};
  store = {};  
  requestQueue = {};
  requestsInProgress = {};
  visits_counter = {};
  record = function(params) {



    var target_url;
    if (!(target_url = params.query == null ? undefined : params.query.url)) {
      return null;
    }

    var pieces = target_url.split('_');
    var nid = pieces.slice(-1).pop();
    var nid = Number(nid);
   
    if(isNaN(nid)){
      log('No nid found for url: "'+ target_url +'"');   
      return;
    }

    var key = 'node_'+nid;   

    // add to queue
    requestQueue[key] = {};

    // Visits (outsite of expiration checking, visits must count everytime)
    getVisitsCount(key, target_url);

    if(typeof requestsInProgress[key] === 'undefined'){

      requestsInProgress[key] = Math.round(new Date().getTime() / 1000);

      // Facebook
      getFacebookCount(key, target_url);      
      // Twitter
      getTwitterCount(key, target_url);      
      // Google+
      getGoogleCount(key, target_url);
    }   

  };

  getFacebookCount = function(key, target_url){
    var req = request.get(
      {
      uri:'http://api.facebook.com/method/fql.query?query=select%20total_count,%20share_count,%20like_count,%20comment_count%20from%20link_stat%20where%20url%20="'+target_url+'"',
      timeout: 30000,
      }, function(err,res,body){
        if (err) {
          log('FB_ERROR: '+ err.code);
        }
        var parseString = require('xml2js').parseString;
        parseString(body, function(err, result) {
          var fb_count = result.fql_query_response.link_stat[0].total_count[0];
          requestQueue[key].fb_count = parseInt(fb_count);
        });
      }).setMaxListeners(0);
  };

  getTwitterCount = function(key, target_url){
    var req = request.get(
      {
      uri:'http://cdn.api.twitter.com/1/urls/count.json?url='+target_url,
      timeout: 30000,
      }, function(err,res,body){
        if (err) {
          log('TW_ERROR: '+ err.code);
        }
        var json = JSON.parse(body);
        if(json.count){
          requestQueue[key].tw_count = parseInt(json.count);
        }

      }).setMaxListeners(0);
  }; 

  getGoogleCount = function(key, target_url){
    request.post({
      uri:"https://clients6.google.com/rpc?key=AIzaSyCKSbrvQasunBoV16zDH9R33D88CeLr9gQ",
      headers:{'content-type': 'application/json'},
      timeout: 30000,
      body:'[{"method":"pos.plusones.get","id":"p","params":{"nolog":true,"id":"'+target_url+'","source":"widget","userId":"@viewer","groupId":"@self"},"jsonrpc":"2.0","key":"p","apiVersion":"v1"}]'
      }, function(err,res,body){
        if (err) {
          log('G_ERROR: '+ err.code);
        }
        
        body = JSON.parse(body);

        if(typeof body[0].result.metadata.globalCounts.count !== 'undefined' ){
          requestQueue[key].g_count = parseInt(body[0].result.metadata.globalCounts.count);
        } else {          
          log('G_ERROR: '+ err.code);
        }

      }
    ).setMaxListeners(0);
  };

  getVisitsCount = function(key, target_url){    
    visits_counter[key] || (visits_counter[key] = 0);
    visits_counter[key] += 1;

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

          //console.log('request finished: '+key);
                      
          delete requestQueue[key]; // remove from queue
        }
      }
    };

    // clear expired keys
    for (var key in requestsInProgress){
      if (requestsInProgress.hasOwnProperty(key)) {   
        nowTimestamp = Math.round(new Date().getTime() / 1000);  
        expired = nowTimestamp - requestsInProgress[key] > config.recalc_after;   
        if(expired){
          //console.log('request expired: '+key);
          delete requestsInProgress[key]; // remove from queue
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
      log(data.json);
      querystr = querystring.stringify(data);
      return querystr;
    } else {
      return null;
    }
  };

  flush = function() {
    var data, request;
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

  log = function(message) {
    if(config.logging){      
      console.log(message);
      Syslog.init("NSC server", Syslog.LOG_PID | Syslog.LOG_ODELAY, Syslog.LOG_LOCAL0);
      Syslog.log(Syslog.LOG_INFO, "NSC server: "+message);
      Syslog.close();
    }
    return message;
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
  server.setMaxListeners(0);
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
