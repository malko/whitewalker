/*jshint node:true, strict:false, laxcomma:true, laxbreak:true */
var connect = require('connect')
	, http = require('http')
	, path = require('path')
	, childProcess = require('child_process')
	, fs = require('../libs/fs-promised.js')
	, app = require('../libs/app-extends.js').extend(connect())
	, stpl = require('../public/stpl.min.js').stpl
	, D = require('d.js')
	, server = http.createServer(app)
	, socketio = require('socket.io')(server)
	, execPromise = D.nodeCapsule(childProcess, childProcess.exec)
	, templatesDir = path.normalize(__dirname + '/../templates/')
	, extExp = /\.([^.]+)$/
	, cleanExp = /[^a-z_0-9-]/ig
	, nightwatchConfig = null
	, runningTests = {}
	, runningTestsPromise = {}
	, settings = {
		port: 3000
		, rootdir: path.normalize(process.cwd() + '/')
		, paths:{}
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
	}
});

// set working dir
process.chdir(settings.rootdir);

// normalize paths
settings.paths.tests = path.normalize(settings.rootdir + '/tests/');
settings.paths.steps = path.normalize(settings.rootdir + '/steps/');
settings.paths.tmp = path.normalize(settings.rootdir + '/tmp/');
settings.paths.logs = path.normalize(settings.rootdir + '/logs/');
settings.paths.nightwatch = path.normalize(__dirname + '/../node_modules/.bin/nightwatch');
// ensure tmp dir
fs.existsSync(settings.paths.tmp) || fs.mkdirSync(settings.paths.tmp);
fs.existsSync(settings.paths.logs) || fs.mkdirSync(settings.paths.logs);
// preload previous running states
fs.readJsonPromise(settings.rootdir + '.whitewalker.json')
	.success(function(data){ runningTests = data;})
;

// load and watch the nightwatch config
nightwatchConfig =  require('../libs/nightwatch-json-parser.js')
	.parse(settings.rootdir + 'nightwatch.json')
	.watch(function(){ // tell connected clients about the new env
		socketio.emit('setEnvs', nightwatchConfig.getEnvs());
	})
;

// utils
function noCache(res){
	res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
	res.setHeader('Expires', '-1');
	res.setHeader('Pragma', 'no-cache');
	return res;
}
function removeExt(fname){
	return fname.replace(extExp,'');
}
function cleanName(name){
	return name.replace(cleanExp,'');
}
function prepareTmpTest(testName){
	var testFilename = path.normalize(settings.paths.tests + testName + '.js')
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
		.success(function(test){ // replace named steps with requires
			required.forEach(function(patterns){
				test = test.replace(new RegExp('(["\'])?' + patterns[0] + '\\1\\s*:\\s*(["\'])' + patterns[1] + '\\2', 'g'), function(){
					return '"' + patterns[0] + '": require("../steps/' + patterns[1] + '.js")';
				});
			});
			return fs.writeFilePromise(settings.paths.tmp + testName + '.js', test, 'utf8');
		})
	;
}

// load templates in sync mode before going further
fs.readdirSync(templatesDir).forEach(function(tpl){
	stpl.registerString(removeExt(tpl), fs.readFileSync(templatesDir + tpl).toString());
});

// get the list of all tests files, prepare it as a template and return a promise
function renderTestList(){
	return fs.readdirPromise('tests')
		.success(function(tests){
			var data = {
				tests: tests.sort().map(function(item){
					var itemName = removeExt(item);
					if( runningTests[itemName] ){
						return runningTests[itemName];
					}
					return {
						name: itemName
						, file: item
						, startTime: ''
						, endTime: ''
						, duration: 0
						, out:'never run'
						, status:'unknown'
					};
				})
			};
			return data;
		})
	;
}

// return the index file with list of available tests
app
	.on('/', function(req, res, next){
		// renderTestList()
		// 	.success(function(body){
				res.end(stpl('index', {body:''}));
				next();
			// })
			// .ensure(next)
		;
	})
	.on('/tests/?', function(req, res, next, testName){
		noCache(res);
		res.end(JSON.stringify(runningTests));
		next();
	})
	.on('/tests/([a-zA-Z0-9_-]+])/', function(req, res, next, testName){
		console.log('TEST', testName)
		noCache(res);
		if (testName in runningTests) {
			res.end(JSON.stringify(runningTests[testName]));
		} else {
			res.writeHead(404);
			res.end();
		}
		next();
	})
	.on('/run/([a-zA-Z0-9_-]+)', function(req, res, next, testName){
		testName = cleanName(testName);
		var testSucceed = function(result){
				var test = runningTests[testName];
				test.endTime = new Date();
				test.duration = (test.endTime.getTime() - test.startTime.getTime())/1000 + 's';
				test.status = 'ok';
				test.out = result.join('\n').replace(/\[[0-9;]+m/g,'');
				res.end(JSON.stringify(test));
			}
			, testFailed = function(err){
				var test = runningTests[testName];
				test.endTime = new Date();
				test.duration = (test.endTime.getTime() - test.startTime.getTime())/1000 + 's';
				test.status = 'failed';
				test.out = err.toString();
				res.end(JSON.stringify(test));
			}
			, end = function(){
				fs.writeJsonPromise(settings.rootdir + '.whitewalker.json', runningTests);
				delete runningTestsPromise[testName];
				next();
			}
		;
		if( testName in runningTestsPromise){
			return runningTestsPromise[testName]
				.success(testSucceed)
				.error(testFailed)
				.ensure(end)
			;
		}
		runningTests[testName] = {
			name: testName
			, file: testName + '.js'
			, startTime: new Date()
			, endTime: ''
			, duration: 0
			, out:''
			, status:'running'
		};
		runningTestsPromise[testName] = prepareTmpTest(testName)
			.success(function(){
				return execPromise(settings.paths.nightwatch + ' -e chrome -c ./nightwatch.json -t ./tmp/' + testName + '.js');
			})
			.success(testSucceed)
			.error(testFailed)
			.ensure(end)
			.rethrow()
		;
	})
	.use(connect.static(__dirname + '/../public/'))
	.use(connect.static(templatesDir))
	.use(connect.static(__dirname + '/../node_modules/d.js/lib/'))
;

socketio.on('connection', function(socket){
	console.log('a user connected to socketio');
	socket.emit('setEnvs', nightwatchConfig.getEnvs());
	socket.emit('setTests', runningTests);

});
server.listen(settings.port, function(){
	console.log("Walking at http://127.0.0.1:%s", settings.port);

});
