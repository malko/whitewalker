"use strict";
var D = require('d.js')
	, fs = require('fs')
	, childProcess = require('child_process')
	, runningEndPromise = null
	, runningTestsPromise = {}
	, cleanExp = /[^a-z_0-9-]/ig
;

function cleanName(name){
	return name.replace(cleanExp,'');
}

module.exports = function(settings, testList, frameworkAdapter){

	var prepareAndExecTest = function prepareAndExecTest(testName, environment){
			var testId;
			if( !environment || environment === 'all' ){
				testList.getEnvs().forEach(function(environment){
					prepareAndExecTest(testName, environment);
				});
				return;
			}
			if( !testName || testName === 'all' ){
				testList.getList().forEach(function(testName){
					prepareAndExecTest(testName, environment);
				});
				return;
			}
			testName = cleanName(testName);
			environment = cleanName(environment);
			testId = testName + '/' + environment;
			// if test execution is already planed just return the promise of result
			if( runningTestsPromise[testId] ){
				return runningTestsPromise[testId];
			}

			testList.queueTest(testName, environment);
			runningTestsPromise[testId] = D.resolved(runningEndPromise) // use D.resolved so will get a promise even if not ant test running
				.success(function(){
					return frameworkAdapter.prepareTest(testName, settings.paths.tests, settings.paths.tmp, environment);
				})
				.success(function(testFilename){
					return execTestPromise(testFilename, testName, environment)
						.ensure(function(){
							fs.unlink(testFilename, function(err){ err && console.error(err); });
						})
					;
				})
				.ensure(function(){
					runningEndPromise = null;
					delete runningTestsPromise[testId];
				})
				.error(function(err){ // get back from error to avoid blocking test execution indefinitely
					console.log('An error occured while executing %s', testId, err);
				})
			;
			runningEndPromise = runningTestsPromise[testId];
		}
		// execTestPromise(settings.paths.nightwatch, testList, testFilename, testName, environment);
		, execTestPromise = function execTestPromise(testFilename, testName, environment){
			var execDefer = D();
			testList.startTest(testName, environment);

			childProcess.exec(
				frameworkAdapter.getCmd(environment, testFilename)
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
		}
	;

	return function(req, res, next, testName, environment){
		prepareAndExecTest(testName, environment);
		res.end('true');
		next();
	};
};
