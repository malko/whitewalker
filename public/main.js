/*global $, D, stpl, io*/
/**
* @author Jonathan Gotti
* @licence MIT
*/
;(function(){
	"use strict";
	var socket = io()
		, envs = null
		, tests = null
		, initialDataPromises = []
		, opened = {}
	;

	$.getPromise = function(){
		var d = D();
		$.get.apply($,arguments).done(d.resolve).fail(d.reject);
		return d.promise;
	};
	$.getJSONPromise = function(){
		var d = D();
		$.getJSON.apply($, arguments).done(d.resolve).fail(d.reject);
		return d.promise;
	};

	$.fn.stpl = function(tplName, data, replace){
		var res = this;
		if ( ! replace ) {
			this.html(stpl(tplName, data));
		} else {
			res = $(stpl(tplName, data)).insertAfter(this);
			this.remove();
		}
		return res;
	};


	// get and register required stpl templates
	$.each(['tests', 'test', 'test-run-buttons', 'test-report'], function(id, tplName){
		initialDataPromises.push($.getPromise(tplName + '.stpl')
			.success(function(tplStr){ stpl.registerString(tplName,tplStr); })
		);
	});
	// load initial tests data
	initialDataPromises.push($.getJSONPromise('/tests').success(function(data){ tests = data.tests; envs = data.envs}));

	// on ready document bind events
	$(function(){

		socket
			.on('updated', function(){
				window.location.reload();
			})
			.on('setTest', function(testName, environment, test){
				var data = {test:{name:testName}, envtest: test, opened: !!opened[testName + '-report-' + environment]};
				console.log(testName, environment, data.opened, opened)
				$('#' + testName + '-report-' + environment).stpl('test-report', data, true);
				$('#' + testName +' button[rel="' + testName + '/' + environment + '"]')
					.removeClass('status-unknown status-ok status-failed status-running')
					.addClass('status-' + test.status)
				;
			})
			.on('livereload', function(){
				try{
					$('link[href*=css]').each(function(k, link){
						link = $(link);
						link.detach();
						link.attr('href',link.attr('href').replace(/(\?\d*|$)/, '?' + (new Date()).getTime()));
						link.appendTo('head');
						console.log(link.href)
					});
				}catch(e){
					console.log(e)}
				}
			)
		;

		D.all(initialDataPromises)
			.success(function(){
				$('#wwTestsContainer').stpl('tests', {tests:tests});
				$('#environments').stpl('test-run-buttons', {test:{name:'all', tests:envs.map(function(a){ return {name:a}})}});
			})
			.rethrow()
		;

		$('#wwUpdate').click(function(){ $.get('/update'); $(this).prop('disabled',true);});

		$('body')
			.on('click', 'button.testrunner', function(){
				var button = $(this)
					, testName = button.attr('rel')
					, testStatusPromise = $.getJSONPromise('/run/'+testName)
				;
				button.prop('disabled',true);
				testStatusPromise
					.ensure(function(){
						console.log('enabling again')
						button.prop('disabled', false);
					})
					.rethrow()
				;
			})
			.on('click', 'dd > div', function(){
				$(this).toggleClass('open', opened[this.id] = !opened[this.id]);
			})
		;
	});
})();
