/*jshint -W052*/
/*global $, D, stpl, io*/
/**
* @author Jonathan Gotti
* @licence MIT
*/
;(function(){
	"use strict";
	var socket = io()
		, dataCache = {}
		, counters = {}
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
	$.each(['tests', 'test', 'test-run-buttons', 'test-report', 'main-report'], function(id, tplName){
		initialDataPromises.push($.getPromise(tplName + '.stpl')
			.success(function(tplStr){ stpl.registerString(tplName,tplStr); })
		);
	});
	stpl.registerFilter('in', function(v){ return !!~[].slice.call(arguments,1).indexOf(v);});
	// load initial tests data
	initialDataPromises.push($.getJSONPromise('/tests').success(function(data){ dataCache = data; }));

	function updateCounters(){
		counters = {
			ok: 0
			, failed: 0
			, unknown: 0
			, running: 0
			, queued: 0
			, okPercent: 0
			, failedPercent: 0
			, unknownPercent: 0
			, runningPercent: 0
			, queuedPercent: 0
			, total: 0
		};
		$.each(dataCache.tests, function(k,test){
			$.each(test.tests, function(k, env){
				counters.total++;
				counters[env.status]++;
			});
		});
	}

	// on ready document bind events
	$(function(){
		var $wwReportContainer = $('#wwReportContainer')
			, $statusFilter = $('#statusFilter')
		;
		function reportRefresh(updateCountersFirst){
			updateCountersFirst && updateCounters();
			$wwReportContainer.stpl('main-report', {
				platform: dataCache.platform
				, testCount: dataCache.testCount * dataCache.envs.length
				, counters: counters
			});
		}
		socket
			.on('updated', function(){
				window.location.reload();
			})
			.on('setTest', function(testName, environment, test){
				var data = {test:{name:testName}, envtest: test, opened: !!opened[testName + '-report-' + environment]};
				dataCache.tests[testName].tests[environment] = test;
				$('#' + testName + '-report-' + environment).stpl('test-report', data, true);
				$('#' + testName +' button[rel="' + testName + '/' + environment + '"]')
					.removeClass('status-unknown status-ok status-failed status-running status-queued')
					.addClass('status-' + test.status)
				;
				reportRefresh(true);
				$statusFilter.change();
			})
			.on('livereload', function(){
				try{
					$('link[href*=css]').each(function(k, link){
						link = $(link);
						link.detach();
						link.attr('href',link.attr('href').replace(/(\?\d*|$)/, '?' + (new Date()).getTime()));
						link.appendTo('head');
					});
				}catch(e){
					console.log(e);
				}
			})
		;

		D.all(initialDataPromises)
			.success(function(){
				var initialState = window.location.hash.match(/!\/(.*)$/);
				$('#wwUpdate').toggle(dataCache.versionning);
				$('#wwTestsContainer').stpl('tests', dataCache);
				$('#environments').stpl('test-run-buttons', {
					test: {name: 'all', tests: dataCache.envs.map(function(a){ return {name:a};}) }
					, envs: dataCache.envs
				});
				initialState && $statusFilter.val(initialState).change();
				reportRefresh(true);
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
						button.prop('disabled', false);
					})
					.rethrow()
				;
				return false;
			})
			.on('click', '.expander', function(){
				var dts = $('dt'), collapsed = !!dts.filter('.collapsed').length;
				dts
					.toggleClass('expanded', collapsed)
					.toggleClass('collapsed', !collapsed)
				;
			})
			.on('click', 'dt', function(){
				var dt = $(this)//.closest('dt')
					, collapsed =  dt.hasClass('collapsed')
				;
				dt
					.toggleClass('expanded', collapsed)
					.toggleClass('collapsed', !collapsed)
				;
			})
			.on('click', 'pre, textarea', function(e){
				e.stopImmediatePropagation();
			})
			.on('click', 'dd > div', function(){
				$(this).toggleClass('open', opened[this.id] = !opened[this.id]);
			})
		;
		$statusFilter.on('change', function(){
			var state = $(this).val()
				, stateClass = '.status-' + state
				, elemts = $('dt,dd').removeClass("hidden")
			;
			state && elemts.not(':has('+stateClass+')').addClass("hidden");
			window.location.hash = state ? '!/' + state : '';
		});
	});
})();
