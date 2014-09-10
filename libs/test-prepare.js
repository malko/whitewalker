"use strict";
var fs = require('./fs-promised.js')
	, path = require('path')
;

module.exports = {
	/**
	* @param {string} testName name of the test case to run (file must have the same name)
	* @param {string} testPath path to the test directory
	* @param {string} tmpPath  path to the temporary directory
	* @param {string} [environment]  test environment name
	* @returns {promise<string>} temporary test file name promise
	*/
	prepare: function(testName, testPath, tmpPath, environment){
		var testFilename = path.normalize(testPath + '/' + testName + '.js')
			, tmpFilename = path.normalize(tmpPath + '/' + testName + (environment ? '-' + environment : '') + '.js')
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
			// replace named steps with requires
			.success(function(test){
				required.forEach(function(patterns){
					test = test.replace(new RegExp('(["\'])?' + patterns[0] + '\\1\\s*:\\s*(["\'])' + patterns[1] + '\\2', 'g'), function(){
						return '"' + patterns[0] + '": require("../steps/' + patterns[1] + '.js")';
					});
				});
				return fs.writeFilePromise(tmpFilename, test, 'utf8').rethrow();
			})
			.success(function(){
				return tmpFilename;
			})
			.rethrow()
		;
	}
};
