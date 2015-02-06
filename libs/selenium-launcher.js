"use strict";
var spawn = require('child_process').exec
	, config = {
		path:''
		, port: 4444
		, host: '127.0.0.1'
	}
	, running = null
;

function seleniumConfigure(cfg){
	/*jshint validthis:true*/
	config = cfg;
	return this;
}

function seleniumStart(){
	/*jshint validthis:true*/
	if( running ){
		return this;
	}
	console.log("starting selenium standalone server");
	var args = [
		config.path
		, '-port', config.port
		, '-host', config.host
		, '-timeout=' + (config.timeout || 15)
		, '-browserTimeout=' + (config.browserTimeout || 30)
	];
	if( config.args ){
		Object.keys(config.args).forEach(function(k){
			args.push('-' + k + '=' + config.args[k]);
		});
	}

	if( config.driversPath ){
		Object.keys(config.driversPath).forEach(function(k){
			config.driversPath[k] && args.push('-D' + k + '=' + config.driversPath[k]);
		});
	}
	running = spawn("java -jar " + args.join(' '));
	// running.stdout.on('data', function(data) {
	// 	console.log(data.toString('utf8'));
	// });
	// running.stderr.on('data', function(data) {
	// 	console.error(data.toString('utf8'));
	// });
	running.on('close', function (code) {
		console.log('selenium process exited with code ' + code);
	});
	return this;
}

function seleniumStop(){
	/*jshint validthis:true*/
	if(! running ){
		return this;
	}
	running.kill();
	running = null;
	return this;
}

module.exports = {
	configure: seleniumConfigure
	, start: seleniumStart
	, stop: seleniumStop
};
