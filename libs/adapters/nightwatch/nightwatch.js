//jscs:disable
"use strict";
var fs = require('fs-promised')
	, path = require('path')
;

module.exports = {
	// how the configFileName should be named
	configFileName: 'nightwatch.json'
	// command line to launch with placeholders for selenium environment name, configPath and the testPath to execute
	, cmdTemplate: '{{runnerPath || nightwatch}} -e {{environment}} -c {{configPath}} -t {{testPath}}'
	, getDefaultConfig: function(){
		return this.configLoader(__dirname + '/' + this.configFileName);
	}
	// read config file and return formatted data for the
	, configLoader: function(cfgPath){
		var data = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
			, res = {
				selenium: {
					path: data.selenium.server_path || ''
					, host: data.selenium.host || '127.0.0.1'
					, port: data.selenium.port || 4444
				}
				, environments: data.test_settings || {}
				, adapter: data.whitewalker || {}
				, rawConfig: data
			}
		;

		if( data.selenium && data.selenium.cli_args){
			res.selenium.driversPath = data.selenium.cli_args;
		}
		return res;
	}
	, configTranslator: function(cfg){
		/*jshint forin:false*/
		// create a dirty copy to avoid modifiyng the config passed as argument
		cfg = JSON.parse(JSON.stringify(cfg));

		var outConfig = cfg.rawConfig || this.getDefaultConfig()
		, seleniumConfig
		, i
		;
		// rewrite config to the adapter format
		seleniumConfig = cfg.selenium || {};

		outConfig.selenium = {
			start_process: outConfig.selenium.start_process || false
			, log_path: 'log_path' in outConfig.selenium ? outConfig.selenium.log_path : false
			, server_path: seleniumConfig.path || outConfig.selenium.server_path || ''
			, host: seleniumConfig.host || outConfig.selenium.host || '127.0.0.1'
			, port: seleniumConfig.port || outConfig.selenium.port || 4444
			, cli_args: outConfig.selenium.cli_args || {}
		};

		if( seleniumConfig.driversPath ){
			for( i in seleniumConfig.driversPath ){
				outConfig.selenium.cli_args[i] = seleniumConfig.driversPath[i];
			}
		}

		outConfig.test_settings || (outConfig.test_settings = {});
		if( cfg.environments ){
			for( i in cfg.environments ){
				if( null === cfg.environments[i]) {
					delete outConfig.test_settings[i];
				} else {
					outConfig.test_settings[i] = cfg.environments[i];
				}
			}
		}

		outConfig.whitewalker = cfg.adapter || outConfig.whitewalker || {};
		return outConfig;
	}

	, configWriter: function(cfgPath, cfg){
		var writed = fs.writeFileSync(cfgPath , JSON.stringify(this.configTranslator(cfg), null, "\t"));
		return writed ? cfgPath : false;
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
			, required = []
			, test
		;
		test = require(testFilename);
		// prepare replace strings
		Object.keys(test).forEach(function(key){
			if( typeof test[key] === 'string' ){
				required.push([key, test[key]]);
			}
		});

		return fs.readFilePromise(testFilename, 'utf8')
			// replace named steps with requires
			.success(function(test){
				required.forEach(function(patterns){
					test = test.replace(new RegExp('(["\'])?' + patterns[0] + '\\1\\s*:\\s*(["\'])' + patterns[1] + '\\2', 'g'), function(){
						return '"' + patterns[0] + '": require("../steps/' + patterns[1] + '.js")';
					});
				});
				return fs.writeFilePromise(tmpFilename, test, 'utf8').rethrow();
			})
			.success(function(){
				return tmpFilename;
			})
			.rethrow()
		;
	}
};
