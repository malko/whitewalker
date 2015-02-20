"use strict";
var fs = require('fs-promised')
	, path = require('path')
	, whitewalkerAdapters = require('whitewalker-adapters')
	, minTTL = 100
;

function applyDefaults(config, defaults) {
	Object.keys(defaults).forEach(function(k) {
		if( typeof defaults[k] === 'object' && config[k] ){
			return applyDefaults(config[k], defaults[k]);
		}
		(k in config) || (config[k] = defaults[k]);
	});
	return config;
}
function getTime(){ return (new Date()).getTime(); }

function FrameworkAdapter (configPath, adapterName) {
	this.adapter = whitewalkerAdapters.getInstance(adapterName);
	this.loadtime = 0;
	this.path = path.normalize(configPath + '/' + this.adapter.configFileName);
	this.watcher = null;
	this.config = {
		selenium: {}
		, environments: {}
		, adapter: {}
	};
}

FrameworkAdapter.prototype.parse = function frameworkAdapter_parse(){
	var self = this, data, envDefaults;
	try {
		data = this.adapter.configLoader(self.path);
	} catch (err) {
		console.warn('Can\'t read %s config file\n', self.path, err);
		return;
	}

	self.config = data || {};
	console.log(self.config);

	//-- default selenium config
	self.config.selenium = self.config.selenium || {};
	applyDefaults(self.config.selenium, {
		path: ''
		, host: '127.0.0.1'
		, port: 4444
		, log_path: false
		, args: {
			timeout: 15
			, browserTimeout: 30
		}
		, driversPath : {
			'webdriver.chrome.driver': ''
			, 'webdriver.ie.driver': ''
			, 'phantomjs.binary.path': ''
		}
	});

	//-- default environments config
	envDefaults = applyDefaults(self.config.environments.defaults || {}, {
		silent: true
		, screenshots: {
			enabled: false
			, path: 'screenshots'
		}
		, capabilities: {
			"javascriptEnabled": true
			, "acceptSslCerts": true
		}
	});
	Object.keys(self.config.environments).forEach( function(envName){
		applyDefaults(self.config.environments[envName], envDefaults);
	});

	self.loadtime = getTime();
	return self;
};

FrameworkAdapter.prototype.watch = function frameworkAdapter_watch(callback) {
	var self = this;
	if (self.watcher) {
		return;
	}
	self.watcher = fs.watch(this.path);
	self.watcher.on('change', function(eventName, fileName) {
		if (!(eventName === 'change' && fileName)) {
			return;
		}
		console.log('reloading %s', self.path, arguments);
		if (getTime() > (self.loadtime + minTTL)) {
			self.parse();
			callback && callback();
		}
	});
	return self;
};

FrameworkAdapter.prototype.stopWatching = function frameworkAdapter_stopwatching() {
	this.watcher && this.watcher.stop && this.watcher.stop();
	this.watcher = null;
	return this;
};

FrameworkAdapter.prototype.getEnvs = function frameworkAdapter_getenvs(nameOnly) {
	var settings = this.config.environments, envs = Object.keys(this.config.environments).filter(function (a) {
		return !!settings[a].desiredCapabilities;
	});
	return nameOnly ? envs : envs.map(function(envname){
		var envSettings = settings[envname]
			, env = {name: envname}
		;
		if( (envSettings.screenshots && envSettings.screenshots.enabled) ||
			(settings.screenshots && settings.screenshots.enabled) ){
			env.screenshotsPath = (envSettings.screenshots && envSettings.screenshots.path) || settings.screenshots.path;
		}
		return env;
	});
};

FrameworkAdapter.prototype.getCmd = function (environmentName, testPath) {
	var args = {
		configPath: this.path
		, runnerPath: this.config.adapter.runnerPath || null
		, environment: environmentName
		, testPath: testPath
	};
	return this.adapter.cmdTemplate.replace(/\{\{\s*(.*?)(?:\s*\|\|\s*(.*?))?\s*\}\}/g, function(m, key, deflt){
		return args[key] || deflt || m;
	});
};

FrameworkAdapter.prototype.prepareTest = function(testName, testPath, tmpPath, environment) {
	return this.adapter.testPreparator(testName, testPath, tmpPath, environment);
};


module.exports = function (cfgPath, adapterName) {
	return new FrameworkAdapter(cfgPath, adapterName || 'nightwatch');
};
