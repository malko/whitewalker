"use strict";
var path = require('path')
	, settings =  {
		port: 3000
		, rootdir: path.normalize(process.cwd() + '/')
		, paths:{}
		, livereload:false
	}
;
// arguments parsing
process.argv.forEach(function(arg, id){
	var argValue = process.argv[id+1];
	switch(arg){
		case "-h":
		case "--help":
			console.log([
				'WhiteWalker is a nightwatch web frontend launch it from your test directory.'
				, 'Tests must be placed in "tests" directory, re-usable steps may be name of scripts located in "steps" directory'
				, 'Exemples usage:'
				, '	launch whitewalker on default port 3000 in the current directory'
				, '		$ whitewalker'
				, '	launch whitewalker on custom port 8000 in "myTests" directory with short and long options'
				, '		$ whitewalker -p 8000 -t /mytests'
				, '		$ whitewalker --port 8000 --testdir /mytests'
			].join('\n'));
			process.exit(0);
			break;
		case "-p":
		case "--port":
			settings.port = argValue;
			break;
		case "-t":
		case "--testdir":
			settings.rootdir = argValue.match(/^\//) ? argValue : path.normalize(process.cwd() + '/' + argValue + '/');
			break;
		case "--livereload":
			settings.livereload = true;
			break;
	}
});

// normalize paths
settings.paths.tests = path.normalize(settings.rootdir + '/tests/');
settings.paths.steps = path.normalize(settings.rootdir + '/steps/');
settings.paths.tmp = path.normalize(settings.rootdir + '/tmp/');
settings.paths.logs = path.normalize(settings.rootdir + '/logs/');
settings.paths.nightwatch = path.normalize(__dirname + '/../node_modules/.bin/nightwatch');
module.exports = settings;
