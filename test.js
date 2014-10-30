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



facebookQueue = {};

facebookQueue[0] = {};
facebookQueue[0][123987] = 'http://google.com';
facebookQueue[0][456643] = 'http://tn.com.ar/politica/piden-la-indagatoria-de-boudou-por-vuelos-privados_539710';

facebookQueue[1] = {};
facebookQueue[1][789131] = 'http://www.ciudad.com';

facebookQueue[2] = {};
facebookQueue[2][768934] = 'http://www.eltrecetv.com';




facebookGetCount = function(url, key){
  debugger;
  requestQueue[key] = {};

  //do the magic here
  var req = request.get(
  {
  uri:'http://graph.facebook.com/?id='+url,
  //uri:'http://api.facebook.com/method/fql.query?query=select%20total_count,%20share_count,%20like_count,%20comment_count%20from%20link_stat%20where%20url%20="'+target_url+'"',
  timeout: 5*1000,
  }, function(err,res,body){
      debugger;
      body = JSON.parse(body);
    if (err) { // request error handling
      console.log('key: ' + key + ' - FACEBOOK_REQUEST_ERROR - '+ err.code);
    } else {
      debugger;
      console.log(url + ': '+  body.shares);
      if(typeof body.shares !== 'undefined'){
        requestQueue[key].url =  url;
        requestQueue[key].fb_count = parseInt(body.shares);

      } else if (body.error !== 'undefined'){ // facebook's error handling
        console.log(body.error);
      }
    }
    
  }).setMaxListeners(0);
}

//facebookQueueProcessed = [];

facebookQueueProcess = function(){  

  for (var priority in facebookQueue){
    if (facebookQueue.hasOwnProperty(priority)) {

      for(var key in facebookQueue[priority]){
        if (facebookQueue[priority].hasOwnProperty(key)) {
          target_url = facebookQueue[priority][key];

          facebookGetCount(target_url, key);

        }
      }
    }
  }
}
facebookQueueProcess();


setTimeout(function(){
  console.log(requestQueue)}
  console.log();

  , 20000);




