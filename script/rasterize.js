var casper = require('casper').create({verbose: true, logLevel: 'debug'});

casper.start("http://localhost:3000/investigate_visual", function(){
	this.captureSelector('investigate_visual.png', 'body');
});

casper.run();

