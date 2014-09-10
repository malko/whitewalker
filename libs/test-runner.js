"use strict";
var D = require('d.js')
	, fs = require('fs')
	, childProcess = require('child_process')
	, runningEndPromise = null
	, runningTestsDefered = {}
	// , runningTestsPromise = {}
	, cleanExp = /[^a-z_0-9-]/ig
;

function cleanName(name){
	return name.replace(cleanExp,'');
}
/*function execTestPromise(nightwatchbin, testList, testFilename, testName, env){
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
}*/

module.exports = function(settings, testList, testPreparator){

	var prepareAndExecTest = function prepareAndExecTest(testName, environment){
			var testId;
			if( !testName || testName === 'all' ){
				testList.getList().forEach(function(testName){
					prepareAndExecTest(testName, environment);
				});
				return;
			}
			if( !environment || environment === 'all' ){
				testList.getEnvs().forEach(function(environment){
					prepareAndExecTest(testName, environment);
				});
				return;
			}
			testName = cleanName(testName);
			environment = cleanName(environment);
			testId = testName + '/' + environment;
			// if test execution is already planed just return the promise of result
			if( runningTestsDefered[testId] ){
				return runningTestsDefered[testId].promise;
			}

			runningTestsDefered[testId] = D();
			testPreparator.prepare(testName, settings.paths.tests, settings.paths.tmp, environment)
				.success(function(testFilename){
					runningTestsDefered[testId].resolve(
						execTestPromise(testFilename, testName, environment)
					);
					runningTestsDefered[testId].promise.ensure(function(){
						console.log('ENSURING CLEANING',testId,  runningTestsDefered)
						// if runningEndPromise didn't change we can remove pointer to it
						if( runningEndPromise === runningTestsDefered[testId].promise ){
							runningEndPromise = null;
						}
						console.log('DELETING %s' ,testFilename, arguments)
						delete runningTestsDefered[testId];
						// remove prepared test file from tmp dir
						fs.unlink(testFilename, function(err){ console.error(err); });
					}).rethrow();
					runningEndPromise = runningTestsDefered[testId].promise;
					return runningEndPromise;
				})
				.rethrow()
			;
		}
		// execTestPromise(settings.paths.nightwatch, testList, testFilename, testName, environment);
		, execTestPromise = function execTestPromise(testFilename, testName, environment){
			var execDefer = D();
			// init test result
			testList.setTestResult(testName, environment);
			console.log("executing %s in %s", settings.paths.nightwatch + ' -e ' + environment + ' -c ./nightwatch.json -t ' + testFilename, process.cwd())
			return D.resolveAll(runningEndPromise)
				.success(function(){
					childProcess.exec(
						settings.paths.nightwatch + ' -e ' + environment + ' -c ./nightwatch.json -t ' + testFilename
						, function(err, stdout, stderr){
							try{
								var status = err ? 'failed' : 'ok'
									, now = new Date()
									, test = testList.cache[testName].tests[environment]
								;
								test.out = (stdout || stderr).toString('utf8').replace(/\[[0-9;]+m/g,'');
								test.status = status;
								test.endTime = now;
								test.duration = (test.endTime.getTime() - test.startTime.getTime())/1000 + 's';
								testList.setTestResult(testName, environment, test);
								delete runningTestsDefered[testName + '/' + environment];
								execDefer.resolve(test);
							} catch(e) {
								execDefer.reject(e);
							}
						}
					);
					return execDefer.promise;
				})
				.rethrow()
			;
		}
	;




	return function(req, res, next, testName, environment){
		console.log('running %s / %s ', testName, environment)
		prepareAndExecTest(testName, environment);
		res.end('true');
		next();
	};
};
