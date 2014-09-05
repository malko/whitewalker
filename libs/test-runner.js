"use strict";
var D = require('d.js')
	, childProcess = require('child_process')
	, runningTestsPromise = {}
	, cleanExp = /[^a-z_0-9-]/ig
;

function cleanName(name){
	return name.replace(cleanExp,'');
}
function execTestPromise(nightwatchbin, testList, testFilename, testName, env){
	testName = cleanName(testName);
	env === 'all' && (env = null);
	env && (env = cleanName(env));
	var environments = env ? [env] : testList.getEnvs()
		, execEnvs = []
		, execEnvDefered = {}
		, execEnvPromises = []
	;

	// separate running test env from thoose to launch
	environments.forEach(function(env){
		if( runningTestsPromise[testName + '/' + env] ){
			execEnvPromises.push(runningTestsPromise[testName + '/' + env]);
		} else {
			execEnvs.push(env);
		}
	});

	// all env tests are already running return a promise of running end
	if( ! execEnvs.length){
		return D.all(execEnvPromises);
	}

	// init test envs of remaining tests
	execEnvs.forEach(function(env){
		testList.setTestResult(testName, env);
		execEnvDefered[env] = D();
		runningTestsPromise[testName + '/' + env] = execEnvDefered[env].promise;
		execEnvPromises.push(runningTestsPromise[testName + '/' + env]);
	});

	childProcess.exec(
		nightwatchbin + ' -e ' + execEnvs.join(',') + ' -c ./nightwatch.json -t ' + testFilename
		, function(err, stdout, stderr){
			var status = err ? 'failed' : 'ok', now = new Date();
			stdout = (stdout || stderr).toString('utf8').replace(/\[[0-9;]+m/g,'');
			execEnvs.forEach(function(env){
				try{
					var test = testList.cache[testName].tests[env];
					test.status = status;
					test.endTime = now;
					test.duration = (test.endTime.getTime() - test.startTime.getTime())/1000 + 's';
					stdout.replace(new RegExp("^ " + env + " \\t[\\s\\S]+?(( \\1 )\\t[^\\n]*\\n)+(.+\\n?)+", "mg"), function(m){
						test.out = m.replace(new RegExp('^ ' + env + '[ \t]+','gm'), '');
					});
					test.out || (test.out = stdout);
					testList.setTestResult(testName, env, test);
					delete runningTestsPromise[testName + '/' + env];
					execEnvDefered[env].resolve(test.out);
				}catch(e){
					execEnvDefered[env].reject(e);
				}
				execEnvDefered[env].promise
			.rethrow();
			});
		}
	);

	return D.all(execEnvPromises);
}

module.exports = function(settings, testList, testPreparator){
	return function(req, res, next, testName, environment){
		console.log('running %s / %s ', testName, environment)
		testPreparator.prepare(testName, settings.paths.tests, settings.paths.tmp, environment)
			.success(function(testFilename){
				return execTestPromise(settings.paths.nightwatch, testList, testFilename, testName, environment);
			})
			.ensure(function(){
				res.end(environment);
				next();
			})
			.rethrow()
		;
	};
};
