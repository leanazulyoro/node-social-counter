

var target_url = 'http://tn.com.ar/sociedad/tucuman-con-nieve_501077';
var pieces = target_url.split('_');
var nid = pieces.slice(-1).pop();
var nid = parseInt(nid);


console.log(nid);
if(isNaN(nid)){
  console.log('No nid found');
  return;
}


//var key = 'node_'+nid;
