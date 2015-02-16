"use strict";
var fs = require('fs-promised')
	, path = require('path')
;
module.exports = {
	// how the configFileName should be named
	configFileName: 'protractor.conf.js'
	// command line to launch with placeholders for selenium environment name, configPath and the testPath to execute
	, cmdTemplate: '{{runnerPath || protractor}} --browser {{environment}} --specs {{testPath}} {{configPath}}'
	// read config file and return formatted data for the
	, configLoader: function(cfgPath){
		var data = require(cfgPath).config
			, res = {
				selenium: {
					path: data.seleniumServerJar || null
					, host: data.seleniumAddress || '127.0.0.1'
					, port: data.seleniumPort || 4444
				}
				, environments: {}
				, adapter: data.whitewalker || {}
				, rawConfig : data
			}
		;

		//- @todo parse protractor seleniumArgs to key=>values
		res.selenium.driversPath = {
			'webdriver.chrome.driver': data.chromedriver || null
		};
		// add capabilities
		function addCapability(capability){ res.environments[capability.browserName] = {desiredCapabilities: capability}; }
		if( data.multiCapabilities ){
			data.multiCapabilities.forEach(addCapability);
		} else if ( data.capabilities ){
			addCapability(data.capabilities);
		}
		return res;
	}
	/**
	* @param {string} testName name of the test case to run (file must have the same name)
	* @param {string} testPath path to the test directory
	* @param {string} tmpPath  path to the temporary directory
	* @param {string} [environment]  test environment name
	* @returns {promise<string>} temporary test file name promise
	*/
	, testPreparator: function(testName, testPath, tmpPath, environment){
		var testFilename = path.normalize(testPath + '/' + testName + '.js')
			, tmpFilename = path.normalize(tmpPath + '/' + testName + (environment ? '-' + environment : '') + '.js')
		;

		return fs.copyPromise(testFilename, tmpFilename).then(function(){ return tmpFilename;}).rethrow();
	}


};
