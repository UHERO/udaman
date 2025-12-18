var casper = require('casper').create({verbose: true, logLevel: 'debug'});

casper.start("http://udaman.uhero.hawaii.edu/investigate_visual", function(){
	this.captureSelector('investigate_visual.png', 'body');
});

casper.run();

