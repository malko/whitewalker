//jscs:disable
"use strict";
var fs = require('fs-promised');

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
};
