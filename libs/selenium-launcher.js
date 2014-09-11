"use strict";
var spawn = require('child_process').exec
	, config = {
		server_path:''
		, port: 4444
		, host: '127.0.0.1'
		, cli_args: {
			"webdriver.chrome.driver": "/home/malko/git/whiteWalkerTests/bin/chromedriver"
		}
	}
	, running = null
;

function seleniumConfigure(cfg){
	config = cfg;
	return this;
}

function seleniumStart(){
	if( running ){
		return this;
	}
	console.log("starting selenium standalone server");
	var args = [
		config.server_path
		, '-port', config.port
		, '-host', config.host
	];

	if( config.cli_args ){
		Object.keys(config.cli_args).forEach(function(k){
			args.push('-D' + k + '=' + config.cli_args[k]);
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
