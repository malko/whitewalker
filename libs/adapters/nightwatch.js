"use strict";
var fs = require('../fs-promised.js');
module.exports = {
	// how the configFileName should be named
	configFileName: 'nightwatch.json'
	// command line to launch with placeholders for selenium environment name, configPath and the testPath to execute
	, cmdTemplate: '{{runnerPath || nightwatch}} -e {{environment}} -c {{configPath}} -t {{testPath}}'
	// read config file and return formatted data for the
	, configLoader: function(cfgPath){
		var data = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
			, res = {
				selenium: data.selenium || {}
				, environments: data.test_settings || {}
				, adapter: data.whitewalker || {}
			}
		;

		if( data.selenium ){
			res.selenium = data.selenium || {};
			data.selenium.server_path && (res.selenium.path = data.selenium.server_path);
			data.selenium.cli_args && (res.selenium.driversPath = data.selenium.cli_args);
		}
		return res;
	}
};
