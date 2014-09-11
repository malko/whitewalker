/*jshint -W052*/
"use strict";
var D = require('d.js')
	, fs = require('./fs-promised.js')
	, path = require('path')
	, cachePath = null
	, cache = {}
	, environments
	, testList
;
function readTestFromCache(testName){
	var d = D()
		, path = cachePath + testName + '.json'
	;
	fs.exists(path, function(exists){
		if(! exists){
			return d.resolve(null);
		}
		fs.readJsonPromise(path).success(d.resolve).error(d.reject);
	});
	return d.promise;
}
function writeTestToCache(testName){
	var path = cachePath + testName + '.json';
	return fs.writeJsonPromise(path, cache[testName]).rethrow();
}

function readListFromDir(){
	return fs.readdirPromise('tests/')
		.success(function(tests){
			return tests.sort().map(function(testname){ return path.basename(testname, '.js'); });
		})
	;
}


function initTestEnvObj(environment, status){
	var now = new Date();
	return {
		name: environment
		, queuedTime: status ? now : ''
		, startTime: status === 'running' ? now : ''
		, endTime: ''
		, duration: 0
		, out:''
		, status: status ? status : 'unknown'
	};
}
function initTestObj(testName){
	var test = {name: testName, tests: {}};
	environments.forEach(function(env){ test.tests[env] = initTestEnvObj(env); });
	return test;
}

function updateList(noCache){
	return readListFromDir()
		.success(function(tests){
			var fromCachePromise = [];
			tests.forEach(function(testName){
				var p;
				if (cache[testName]) {
					return;
				}
				// test not already in the list
				if ( noCache ){
					cache[testName] = initTestObj(testName);
					return;
				}
				p = readTestFromCache(testName)
					.success(function(testObj){
						if( ! cache[testName]){
							cache[testName] = testObj || initTestObj(testName);
						}
					})
					.error(function(error){
						if( ! cache[testName]){
							cache[testName] = initTestObj(testName);
						}
						cache[testName].error = error;
					})
				;
				fromCachePromise.push(p);
				cache[testName] = null;
			});
			return fromCachePromise.length ? D.all(fromCachePromise) : null;
		})
		.success(function(){ return cache; })
		.rethrow()
	;
}

module.exports = testList = {
	_observers:[]
	, cache: cache
	, setCachePath: function(dirPath){
		cachePath = path.normalize(dirPath + '/');
		fs.existsSync(cachePath) || fs.mkdirSync(cachePath);
		return this;
	}
	, load: updateList
	, getList: function(){ return Object.keys(cache); }
	, registerObserver: function(observer){
		this._observers.push(observer);
	}
	, unregisterObserver: function(observer){
		var id = this._observers.indexOf(observer);
		(~id) && this._observers.splice(id,1);
	}
	, update: function(){ return updateList(true);}
	, reset: function(){
		for(var test in cache){
			delete cache[test];
		}
		return updateList();
	}
	, setEnvs: function(envs){
		environments = envs;
		return this;
	}
	, getEnvs: function(){ return environments; }
	, setTestResult: function(testName, environment, testData){
		var tests = cache[testName].tests;
		tests[environment] = testData;
		this._observers.forEach(function(observer){
			observer.emit && observer.emit('setTest', testName, environment, tests[environment]);
		});
		tests[environment].status.match(/failed|ok/) && writeTestToCache(testName);
	}
	, queueTest: function(testName, environment){
		return testList.setTestResult(testName, environment, initTestEnvObj(environment, 'queued'));
	}
	, startTest: function(testName, environment){
		var test = cache[testName].tests[environment], testData;
		if( !(test && (test.status === 'unknown' || test.status === 'queued')) ){
			return testList.setTestResult(testName, environment, initTestEnvObj(environment, 'running'));
		}
		testData = test;
		testData.status = 'running';
		testData.startTime = new Date();
		testList.setTestResult(testName, environment, testData);
	}
};
