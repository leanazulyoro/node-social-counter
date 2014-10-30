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
  facebookQueue = {};
  record = function(params) {

    // get the url parameter
    var target_url;
    if (!(target_url = params.query == null ? undefined : params.query.url)) {
      log('No url parameter', 'ERROR');
      return null;
    }
    // get the key parameter
    var key;
    if (!(key = params.query == null ? undefined : params.query.key)) {
      log('No key parameter', 'ERROR');
      return null;
    }
    // get the priority parameter
    var priority;
    priority = params.query == null ? undefined : params.query.priority;


    // allow hits from known hosts only
    var parcedUrl = url.parse(target_url);
    target_url = parcedUrl.protocol+'//'+parcedUrl.hostname+parcedUrl.pathname;
    if(typeof config.safe_hosts !== 'undefined') {
      if(!inArray(parcedUrl.hostname, config.safe_hosts)){
        log('Host not allowed: '+parcedUrl.hostname, 'ERROR');
        return;
      }
    }
    
    // set the key as "In Progress"
    if(typeof requestsInProgress[key] === 'undefined') {
      requestsInProgress[key] = {};
      requestsInProgress[key].hits = 0;
    }

    if(typeof requestQueue[key] === 'undefined') {
    // add to queue
      requestQueue[key] = {};
    }
    if(typeof requestQueue[key] !== 'undefined') {
      // Visits
      getVisitsCount(key, target_url);
      // Facebook
      facebookAddToQueue(key, target_url, priority);      
      // Twitter
      getTwitterCount(key, target_url);      
      // Google+
      getGoogleCount(key, target_url);
    }
  };
  facebookAddToQueue = function(key, target_url, priority){

  if(typeof requestsInProgress[key].facebook === 'undefined' && requestsInProgress[key].hits >= config.facebook.hits_required){
        
      requestsInProgress[key].facebook = Math.round(new Date().getTime() / 1000);

      // add to facebook queue
      if(typeof facebookQueue[priority] !== 'object') {
        facebookQueue[priority] = {};
      } 
      facebookQueue[priority][key] = target_url;
    } else {
      //console.log(key+': facebook count in progress..');
      requestsInProgress[key].hits++;
      if (requestsInProgress[key].hits < config.facebook.hits_required && requestsInProgress[key].hits % 10 == 0){
          log('key ' + key + ' hits = ' + requestsInProgress[key].hits, 'DEBUG');
      } 
    }

  };

  facebookRemoveFromQueue = function(key){
    for (var priority in facebookQueue){
      if (facebookQueue.hasOwnProperty(priority)) {

        for(var key in facebookQueue[priority]){
          if (facebookQueue[priority].hasOwnProperty(key)) {            
            delete facebookQueue[priority][key]; 
            if(!Object.keys(facebookQueue[priority]).length){
              delete facebookQueue[priority];
            }          
          }
        }
      }
    }

  };

  getFacebookCount = function(key, url){
    //do the magic here
    var req = request.get(
    {
    uri:'http://graph.facebook.com/?id='+url,
    timeout: config.facebook.timeout*1000,
    }, function(err,res,body){
        body = JSON.parse(body);
      if (err) { // request error handling
        log('key: ' + key + ' - FACEBOOK_REQUEST_ERROR - '+ err.code, 'ERROR');
      } else {
        if(typeof body.shares !== 'undefined'){
          requestQueue[key].fb_count = parseInt(body.shares);
          facebookRemoveFromQueue(key);
        } else if(typeof body.shares === 'undefined') {
          requestQueue[key].fb_count = 0;
          facebookRemoveFromQueue(key);
        } else if (typeof body.error !== 'undefined'){ // facebook's error handling
          log('key: ' + key + ' FACEBOOK_ERROR - code: '+ body.error.code + ' msg: "' + body.error.message + '"', 'ERROR');
        }
      }
      
    }).setMaxListeners(0);
  }




  getTwitterCount = function(key, target_url){

    if(typeof requestsInProgress[key].twitter === 'undefined'){

      requestsInProgress[key].twitter = Math.round(new Date().getTime() / 1000);

      log('getTwitterCount - key:' + key + ' url: '+ target_url, 'DEBUG');

      var req = request.get(
        {
        uri:'http://cdn.api.twitter.com/1/urls/count.json?url='+target_url,
        timeout: config.twitter.timeout*1000,
        }, function(err,res,body){
          if (err) { // request error handling
            log('key: ' + key + ' - TWITTER_REQUEST_ERROR - '+ err.code, 'ERROR');
          } else {
            var json = JSON.parse(body);
            if(typeof json.count === 'number'){
              requestQueue[key].tw_count = parseInt(json.count);
            }
          }
        }).setMaxListeners(0);
    } else {
      //console.log(key+': twitter count in progress..');
    }

  }; 

  getGoogleCount = function(key, target_url){
    if(typeof requestsInProgress[key].google === 'undefined'){

      requestsInProgress[key].google = Math.round(new Date().getTime() / 1000);

      log( 'getGoogleCount - key:' + key + ' url: '+ target_url, 'DEBUG');

      request.post({
        uri:"https://clients6.google.com/rpc?key=AIzaSyCKSbrvQasunBoV16zDH9R33D88CeLr9gQ",
        headers:{'content-type': 'application/json'},
        timeout: config.google.timeout*1000,
        body:'[{"method":"pos.plusones.get","id":"p","params":{"nolog":true,"id":"'+target_url+'","source":"widget","userId":"@viewer","groupId":"@self"},"jsonrpc":"2.0","key":"p","apiVersion":"v1"}]'
        }, function(err,res,body){
          if (err) { // request error handling
            log('key: ' + key + ' - GOOGLE_REQUEST_ERROR - '+ err.code, 'ERROR');
            // @todo: if error try again
          } else {
            body = JSON.parse(body);
            if(typeof body[0].result.metadata.globalCounts.count !== 'undefined' ){
              requestQueue[key].g_count = parseInt(body[0].result.metadata.globalCounts.count);
            }
          }
        }
      ).setMaxListeners(0);
    } else {
      //console.log(key+': google count in progress..');
    }

  };

  getVisitsCount = function(key, target_url){    
    visits_counter[key] || (visits_counter[key] = 0);
    visits_counter[key] += 1;
  };

  getCompletedKeys = function(){

    for (var key in requestQueue){
      if (requestQueue.hasOwnProperty(key)) {
        store[key] = {};       
      
        if(typeof requestQueue[key].fb_count === 'number'){
          store[key].fb_count = requestQueue[key].fb_count;
          requestQueue[key].fb_count = 'done';          
        }

        if(typeof requestQueue[key].tw_count === 'number'){
          store[key].tw_count = requestQueue[key].tw_count;
          requestQueue[key].tw_count = 'done';;
          
        }

        if(typeof requestQueue[key].g_count === 'number'){
          store[key].g_count = requestQueue[key].g_count;
          requestQueue[key].g_count = 'done';
        }

        store[key].visits = visits_counter[key];
        delete visits_counter[key];

        console.log('__________');
        console.log(requestQueue);
        console.log('__________');

        if(requestQueue[key].fb_count == 'done' && 
          requestQueue[key].tw_count == 'done' && 
          requestQueue[key].g_count == 'done' ){
          delete requestQueue[key]; // remove from queue only when each count is removed
        }        

      }

    };

    return store;
  };



  
  facebookQueueProcess = function(){  

    for (var priority in facebookQueue){
      if (facebookQueue.hasOwnProperty(priority)) {

        for(var key in facebookQueue[priority]){
          if (facebookQueue[priority].hasOwnProperty(key)) {
            target_url = facebookQueue[priority][key];
            getFacebookCount(key, target_url);
          }
        }
      }
    }

  }

  clearExpiredKeys = function(){
    nowTimestamp = Math.round(new Date().getTime() / 1000);  
    for (var key in requestsInProgress){
      if (requestsInProgress.hasOwnProperty(key)) {

        if(typeof requestsInProgress[key].facebook === 'number'){    
          expired = nowTimestamp - requestsInProgress[key].facebook > config.recalc_after;   
          if(expired){
            requestsInProgress[key].hits = 0; 
            delete requestsInProgress[key].facebook; // remove from queue
          }
        }

        if(typeof requestsInProgress[key].twitter === 'number'){    
          expired = nowTimestamp - requestsInProgress[key].twitter > config.recalc_after;   
          if(expired){
            delete requestsInProgress[key].twitter; // remove from queue
          }
        }
        if(typeof requestsInProgress[key].google === 'number'){   
          expired = nowTimestamp - requestsInProgress[key].google > config.recalc_after;   
          if(expired){
            delete requestsInProgress[key].google; // remove from queue
          }
        }

        if(typeof requestsInProgress[key].facebook === 'undefined' && 
          typeof requestsInProgress[key].twitter === 'undefined' && 
          typeof requestsInProgress[key].google === 'undefined' && 
          typeof requestsInProgress[key].hits === 'undefined' ){
          delete requestsInProgress[key]; // remove from queue only when each count is removed
        }

      }
    }
  };

  serialize = function() {
    var data;
    facebookQueueProcess();
    getCompletedKeys(); 
    clearExpiredKeys(); 
    if(JSON.stringify(store) != '{}'){
      data = {
        json: JSON.stringify(store)
      };
      store = {};
      if (config.secret) {
        data.secret = config.secret;
      }
      //querystr = querystring.stringify(data);
      return data;
    } else {
      return null;
    }
  };

  flush = function() {

    log("Request Queue size: " + ObjectLength(requestQueue), 'DEBUG');
    log("Request in Progress size: " + ObjectLength(requestQueue), 'DEBUG');
    log("Facebook Queue size: " + ObjectLength(facebookQueue), 'DEBUG');
    console.log(facebookQueue);

    var data;
    if (!(config.endpoint)) {
      return null;
    }
    data = serialize();
    if(data != null){

      request.post({
        uri: config.endpoint,
        timeout: config.flushtimeout*1000,
        form: data
        }, function(err,res,body){
          if (err) { 
            log('FLUSH_ERROR - '+ err.code, 'ERROR');
          } else {
            log('FLUSHED - ' + JSON.stringify(data) , 'DEBUG');
          }
        }
      ).setMaxListeners(0);

    } else {
      return log('FLUSHED - no data', 'INFO');
    }
    
  };

  /**
   * Generate a log message
   * 
   * @param message
   *    The message to log
   *
   * @param type
   *    The type of message, may be "INFO", "DEBUG", "ERROR". Defaults to "INFO"
   */
  log = function(message, type) {

    if(typeof type === 'undefined'){
      type = 'INFO';
    }

    config.logLevel.forEach(function(value) {
          
     if(type == value){
        var d = new Date();
        var day = ("0"+d.getDate()).slice(-2);
        var month = ("0"+d.getMonth()).slice(-2);
        var year = d.getFullYear();
        var hour = ("0"+d.getHours()).slice(-2);
        var minutes = ("0"+d.getMinutes()).slice(-2);
        var seconds = ("0"+d.getSeconds()).slice(-2);

        var logString = day+'/'+month+'/'+year+' '+hour+':'+minutes+':'+seconds+' - '+type+' - '+message;
        console.log(logString);

        // to syslog:
        /*if(config.syslog){
          Syslog.init("NSC server", Syslog.LOG_PID | Syslog.LOG_ODELAY, Syslog.LOG_LOCAL0);
          Syslog.log(Syslog.LOG_INFO, logString);
          Syslog.close(); 
        }*/
        return message;

      }   
    });
      
  };

  inArray = function(needle, haystack) {
    var length = haystack.length;
    for(var i = 0; i < length; i++) {
        if(haystack[i] == needle) return true;
    }
    return false;
  };

  ObjectLength = function(object) {
    var length = 0;
    for( var key in object ) {
        if( object.hasOwnProperty(key) ) {
            ++length;
        }
    }
    return length;
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
    return console.error("Uncaught Exception: " + (err.stack));
  });
  server.listen(config.port, config.host);
  setInterval(flush, config.interval * 1000);
})();
