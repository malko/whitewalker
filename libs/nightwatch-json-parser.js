"use strict";
var fs = require('fs')
	, minTTL = 100
;

function getTime(){ return (new Date()).getTime(); }

function NightwatchParser(jsonPath, watch) {
	if (!(this instanceof NightwatchParser)){
		return new NightwatchParser(jsonPath, watch);
	}
	this.loadtime = 0;
	this.path = jsonPath;
	this.parse();

	this.watcher = null;
	watch && this.watch();
}

NightwatchParser.prototype.parse = function nightwatchparser_parse(){
	var self = this;
	fs.readFile(self.path, 'utf8', function(err, data){
		if( err) {
			console.log(err);
			return;
		}
		try{
			data = JSON.parse(data);
		} catch(e){
			console.log(e);
			return;
		}
		self.loadtime = getTime();
		self.config = data;
	});
	return self;
};
NightwatchParser.prototype.watch = function nightwatchparser_watch() {
	var self = this;
	if (self.watcher) {
		return;
	}
	self.watcher = fs.watch(this.path);
	self.watcher.on('change', function(){
		console.log('reloading %s', self.path);
		(getTime() > (self.loadtime + minTTL)) && self.parse();
	});
	return self;
};
NightwatchParser.prototype.stopWatching = function nightwatchparser_stopwatching() {
	this.watcher && this.watcher.stop && this.watcher.stop();
	this.watcher = null;
	return this;
};
NightwatchParser.prototype.getEnvs = function nightwatchparser_getenvs(){
	return Object.keys(this.config.test_settings);
};

module.exports = {
	parse: function(jsonPath) {
		return NightwatchParser(jsonPath).parse();
	}
};
