"use strict";
var fs = require('fs-promised');
module.exports = {
	// how the configFileName should be named
	configFileName: 'protractor.conf.js'
	// command line to launch with placeholders for selenium environment name, configPath and the testPath to execute
	, cmdTemplate: '{{runnerPath || protractor}} --browser {{environment}} --specs {{testPath}} {{configPath}}'
	// read config file and return formatted data for the
	, configLoader: function(cfgPath){
		var data = require(cfgPath)
			, res = {
				selenium: {
					path: data.seleniumSeverJar || null
					, host: data.seleniumAddress || '127.0.0.1'
					, port: data.seleniumPort || 4444
				}
				, environments: {}
				, adapter: data.whitewalker || {}
				, rawConfig = data
			}
		;

		//- @todo parse protractor seleniumArgs to key=>values
		res.selenium.driversPath = {
			'webdriver.chrome.driver': data.chromedriver || null
		};
		// add capabilities
		function addCapability(capability){ res.environments[capability.browserName] = capability; }
		if( data.multiCapabilities ){
			data.multiCapabilities.forEach(addCapability);
		} else if ( data.capabilities ){
			addCapability(data.capabilities);
		}
		return res;
	}

};
