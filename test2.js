var i;
var j = 10;
for (i = 0; i < j; i++) {
    (function(cntr) {
        // here the value of i was passed into as the argument cntr
        // and will be captured in this function closure so each
        // iteration of the loop can have it's own value
        asycronouseProcess(function() {
            console.log(cntr);
        });
    })(i);
}