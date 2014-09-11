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
						// if runningEndPromise didn't change we can remove pointer to it
						if( runningEndPromise === runningTestsDefered[testId].promise ){
							runningEndPromise = null;
						}
						delete runningTestsDefered[testId];
						// remove prepared test file from tmp dir
						fs.unlink(testFilename, function(err){ err && console.error(err); });
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
			testList.queueTest(testName, environment);
			return D.resolveAll(runningEndPromise)
				.success(function(){
					testList.startTest(testName, environment);
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
		prepareAndExecTest(testName, environment);
		res.end('true');
		next();
	};
};
