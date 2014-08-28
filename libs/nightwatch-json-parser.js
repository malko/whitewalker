"use strict";
var fs = require('./fs-promised.js')
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
	var self = this, data;
	try{
		data = fs.readJsonSync(self.path);
	} catch(err) {
		console.warn("Can't read %s config file\n", self.path, err);
		return;
	}
	self.loadtime = getTime();
	self.config = data;
	return self;
};
NightwatchParser.prototype.watch = function nightwatchparser_watch(callback) {
	var self = this;
	if (self.watcher) {
		return;
	}
	self.watcher = fs.watch(this.path);
	self.watcher.on('change', function(eventName, fileName){
		if(! (eventName === 'change' && fileName)){
			return;
		}
		console.log('reloading %s', self.path, arguments);
		if( getTime() > (self.loadtime + minTTL)){
			self.parse();
			callback && callback();
		}
	});
	return self;
};
NightwatchParser.prototype.stopWatching = function nightwatchparser_stopwatching() {
	this.watcher && this.watcher.stop && this.watcher.stop();
	this.watcher = null;
	return this;
};
NightwatchParser.prototype.getEnvs = function nightwatchparser_getenvs(){
	return Object.keys(this.config.test_settings).map(function(envname){
		return {ename:envname};
	});
};

module.exports = {
	parse: function(jsonPath) {
		return NightwatchParser(jsonPath);
	}
};
