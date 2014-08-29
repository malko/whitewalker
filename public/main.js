/*global $, D, stpl*/
/**
* @author Jonathan Gotti
* @licence MIT
*/
;(function(){
	"use strict";
	var socket = io(), envs = null, tests = null, initialDataDefer = D();
	socket.on('setEnvs', function(data){
		envs = data;
		tests && initialDataDefer.resolve();
	});
	socket.on('setTests', function(data){
		tests = data;
		envs && initialDataDefer.resolve();
	});
	socket.on('setTest', function(data){
		console.log("setTest", data);
	})
	// extend basic-compat with getPromise and getJSONPromise methods
	$.getPromise = function(){
		var d = D();
		$.get.apply($,arguments).done(d.resolve).fail(d.reject);
		return d.promise;
	};
	$.getJSONPromise = function(url){
		var d = D();
		$.getJSON.apply($,arguments).done(d.resolve).fail(d.reject);
		return d.promise;
	};
	// add basic replace elmt method
	// $.fn.replace = function(elmt){
	// 	var self = this;
	// 	elmt.nodeType && (elmt = $(elmt));
	// 	return $.each(elmt,function(){
	// 		this.parentNode.insertBefore(self[0] || self, this);
	// 		this.parentNode && this.parentNode.removeChild(this);
	// 	});
	// };

	// get and register required stpl templates
	$.each(['tests','test','test-run-buttons'],function(id, tplName){
		$.getPromise(tplName + '.stpl').success(function(tplStr){ stpl.registerString(tplName,tplStr); });
	})

	// on ready document bind events
	$(function(){
		initialDataDefer.promise
			.success(function(){
				$(stpl('tests', {tests:tests, envs:envs})).insertAfter('h1');
			})
		;
		$('body').on('click', 'button.testrunner', function(){
			var button = $(this)
				, testName = button.attr('rel')
				, parent = button.closest('dt')
				, testStatusPromise = $.getJSONPromise('/run/'+testName)
			;
			parent = parent.add(parent.next('dd'))
			button.attr('disabled', 'disabled');
			parent
				.removeClass('status-unknown status-failed status-ok')
				.addClass('status-running')
			;
			testStatusPromise
				.ensure(function(){
					parent.removeClass('status-running');
					button.attr('disabled', '');
				})
				.success(function(res){
					$(stpl('test', {test:res, envs:envs})).insertBefore(parent[0]);
					parent.remove();
				})
				.error(function(error){
					parent.addClass('status-failed');
					console && console.log(error);
					parent.attr('title', error);
				})
			;
		});
	});
})();
