/*jshint node:true, strict:false, laxcomma:true, laxbreak:true */
var connect = require('connect')
	, http = require('http')
	, fs = require('../libs/fs-promised.js')
	, path = require('path')
	, app = require('../libs/app-extends.js').extend(connect())
	, D = require('d.js')
	, childProcess = require('child_process')
	, execPromise = D.nodeCapsule(childProcess, childProcess.exec)
	, server = http.createServer(app)
	, socketio = require('socket.io')(server)
	// , cleanExp = /[^a-z_0-9-]/ig
	, nightwatchConfig = null
	, settings = require('../libs/opt-parsing.js')
	, testPreparator = require('../libs/test-prepare.js')
	, testList = require('../libs/test-list.js')
	, testRunner = require('../libs/test-runner.js')(settings, testList, testPreparator)
	// , runningTestsPromise = {}
	, updatePromise = null
	, selenium = require('../libs/selenium-launcher.js')
	, platform = ''
;

// utils
function ensureDir(path){
	console.log('Ensuring %s exists', path);
	fs.existsSync(path) || fs.mkdirSync(path);
}
function noCache(res){
	res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
	res.setHeader('Expires', '-1');
	res.setHeader('Pragma', 'no-cache');
	return res;
}
function setEnvs(){
	// tell connected clients about the new env
	//socketio.emit('setEnvs', nightwatchConfig.getEnvs());
	testList.setEnvs(nightwatchConfig.getEnvs(true));
	nightwatchConfig.getEnvs().forEach(function(env){
		env.screenshotsPath && ensureDir(path.normalize(settings.rootdir + env.screenshotsPath));
	});
}
function getPlatform(){
	if( platform ){
		return platform;
	}
	var os = require('os');
	platform = os.hostname() + ':' + os.type() + ' ' + os.release();
	return platform;
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
	.watch(function(){
		setEnvs();
	})
;
setEnvs();

// load test data
testList.setCachePath('.whitewalker/').load();
testList.registerObserver(socketio);

// check for selenium autostart
if(settings.startSelenium && nightwatchConfig.config.selenium){
	settings.startSelenium && selenium.configure(nightwatchConfig.config.selenium).start();
} else {
	console.log("won't manage selenium server");
}


// return the index file with list of available tests
app
	// .use(connect.cookieParser())
	// .use(connect.cookieSession({ secret: 'whitewalker'}))
	.on('/tests/?', function(req, res, next){
		noCache(res);
		res.setHeader('Content-type', 'application/json; charset=utf8');
		res.end(JSON.stringify({
			tests:testList.cache
			, envs:testList.getEnvs()
			, platform: getPlatform()
			, testCount: Object.keys(testList.cache).length
			, versionning: fs.existsSync('.git')
		}));
		next();
	})
	/*.on('/tests/([a-zA-Z0-9_-]+])/', function(req, res, next, testName){
		console.log('TEST', testName);
		noCache(res);
		if (testName in testList.cache) {
			res.end(JSON.stringify(testList.cache[testName]));
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
	.on('/run/([a-zA-Z0-9_-]+)(?:/([a-zA-Z0-9_-]+))?', testRunner)
	.use(connect.static(__dirname + '/../public/'))
	.use(connect.static(__dirname + '/../templates/'))
	.use(connect.static(__dirname + '/../node_modules/d.js/lib/'))
;
//-- stylus live reload in dev mode
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
				});
			});
		});
	});
}

//-- starting the server
server.listen(settings.port, function(){
	console.log("Walking at http://127.0.0.1:%s", settings.port);

});
