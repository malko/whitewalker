/*jshint node:true, strict:false, laxcomma:true, laxbreak:true */
var connect = require('connect')
	, http = require('http')
	, fs = require('../libs/fs-promised.js')
	, app = require('../libs/app-extends.js').extend(connect())
	, D = require('d.js')
	, childProcess = require('child_process')
	, execPromise = D.nodeCapsule(childProcess, childProcess.exec)
	, server = http.createServer(app)
	, socketio = require('socket.io')(server)
	, cleanExp = /[^a-z_0-9-]/ig
	, nightwatchConfig = null
	, settings = require('../libs/opt-parsing.js')
	, testPreparator = require('../libs/test-prepare.js')
	, testList = require('../libs/test-list.js')
	, testStatesCache = testList.cache
	, runningTestsPromise = {}
	, updatePromise = null
;

// utils
function ensureDir(path){
	fs.existsSync(path) || fs.mkdirSync(path);
}
function noCache(res){
	res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
	res.setHeader('Expires', '-1');
	res.setHeader('Pragma', 'no-cache');
	return res;
}
function cleanName(name){
	return name.replace(cleanExp,'');
}
function setEnvs(){
	// tell connected clients about the new env
	//socketio.emit('setEnvs', nightwatchConfig.getEnvs());
	testList.setEnvs(nightwatchConfig.getEnvs(true));
}


// set working dir
process.chdir(settings.rootdir);

// ensure  directory exists
ensureDir(settings.paths.tmp);
ensureDir(settings.paths.logs);
ensureDir(settings.rootdir + 'screenshots');

// load and watch the nightwatch config
nightwatchConfig =  require('../libs/nightwatch-json-parser.js')
	.parse(settings.rootdir + 'nightwatch.json')
	.watch(function(){ setEnvs(); })
;
setEnvs();

// load test data
testList.setCachePath('.whitewalker/').load();

// return the index file with list of available tests
app
	// .use(connect.cookieParser())
	// .use(connect.cookieSession({ secret: 'whitewalker'}))
	.on('/tests/?', function(req, res, next){
		noCache(res);
		res.setHeader('Content-type', 'application/json; charset=utf8');
		res.end(JSON.stringify(testStatesCache));
		next();
	})
	/*.on('/tests/([a-zA-Z0-9_-]+])/', function(req, res, next, testName){
		console.log('TEST', testName);
		noCache(res);
		if (testName in testStatesCache) {
			res.end(JSON.stringify(testStatesCache[testName]));
		} else {
			res.writeHead(404);
			res.end();
		}
		next();
	})*/
	.on('/update',function(req, res, next){
		if(! updatePromise ){
			updatePromise = execPromise('git remote update --prune && git pull');
			updatePromise.ensure(function(){
				testList.reset().ensure(function(){
					socketio.emit('updated');
				});
				updatePromise = null;
			});
		}
		res.end();
		next();
	})
	.on('/run/([a-zA-Z0-9_-]+)(?:/([a-zA-Z0-9_-]+))?', function(req, res, next, testName, environment){
		testName = cleanName(testName);
		environment = environment ? cleanName(environment) : 'all';
		var test = testList.initEnvTest(environment, true)
			, testSucceed = function(result){
				test.status = 'ok';
				test.out = result;
				res.end(JSON.stringify(test));
			}
			, testFailed = function(err){
				test.status = 'failed';
				test.out = err.toString();
			}
			, end = function(){
				test.endTime = new Date();
				test.duration = (test.endTime.getTime() - test.startTime.getTime())/1000 + 's';
				testList.setTestResult(testName, environment, test);
				delete runningTestsPromise[testName + '/' + environment];
				res.end(JSON.stringify({name:testName, environment:environment, result:test}));
				socketio.emit('setTest', testName, environment, test);
				next();
			}
		;
		if( (testName + '/' + environment) in runningTestsPromise){
			return runningTestsPromise[testName + '/' + environment]
				.success(testSucceed)
				.error(testFailed)
				.ensure(end)
				.rethrow()
			;
		}
		console.log('running',  testName + '/' + environment)
		testStatesCache[testName].tests[environment] = test;
		socketio.emit('setTest', testName, environment, test);
		runningTestsPromise[testName + '/' + environment] = testPreparator.prepare(testName, settings.paths.tests, settings.paths.tmp, environment)
			.success(function(testFilename){
				var d = D();
				childProcess.exec(
					settings.paths.nightwatch + ' -e ' + environment + ' -c ./nightwatch.json -t ' + testFilename
					, function(err, stdout, stderr){
						if( err ){
							d.reject( ((stderr ? stderr : stdout) || err ).toString('utf8').replace(/\[[0-9;]+m/g,''));
							return;
						}
						d.resolve(stdout.toString('utf8').replace(/\[[0-9;]+m/g,''));
					}
				);
				return d.promise;
			})
			.success(testSucceed)
			.error(testFailed)
			.ensure(end)
			.rethrow()
		;
	})
	.use(connect.static(__dirname + '/../public/'))
	.use(connect.static(__dirname + '/../templates/'))
	.use(connect.static(__dirname + '/../node_modules/d.js/lib/'))
;
/*if(settings.livereload){
	console.log('reloade', __dirname + '/../public',require('stylus').middleware({
		src: __dirname + '/../public',
		dest: __dirname + '/../public'
	}))
	app.use(require('stylus').middleware({
		src: __dirname + '/../public',
		dest: __dirname + '/../public'
	}));
}
/*socketio.on('connection', function(socket){
	console.log('a user connected to socketio');
	//socket.emit('setEnvs', nightwatchConfig.getEnvs());
	socket.emit('setTests', testStatesCache);

});*/
if( settings.livereload ){
	var path = require('path')
		, stylFile = path.normalize(__dirname + '/../public/styles.styl')
		, cssFile = path.normalize(__dirname + '/../public/styles.css')
		, stylus = require('stylus')
	;
	fs.watchDeduped(path.normalize(__dirname + '/../public/styles.styl'), function(event, filename){
		if( event !== 'change' || ! filename){
			return;
		}
		fs.readFilePromise(stylFile,'utf8').success(function(styl){
			stylus.render(styl, { filename: stylFile }, function(err, css){
				if (err) {
					throw err;
				}
				fs.writeFilePromise(cssFile, css, 'utf8').success(function(){
					socketio.emit('livereload');
				})
			});
		});
	});
}

server.listen(settings.port, function(){
	console.log("Walking at http://127.0.0.1:%s", settings.port);

});
