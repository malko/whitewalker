/*global $, D, stpl*/
/**
* @author Jonathan Gotti
* @licence MIT
*/
;(function(){
	"use strict";
	// extend basic-compat with get and getJSON methods
	$.get = function(url){
		var d = D()
			, xhr = new XMLHttpRequest()
		;
		xhr.open('GET', url);
		xhr.onload = function(){
			try{
				if( xhr.status !== 200 && xhr.status !== 304 ){
					throw 'GET ' + url + ' ' + xhr.status + ' (' + xhr.statusText + ')';
				}
				d.resolve(this.responseText);
			} catch(e){
				d.reject(e);
			}
		};
		xhr.onerror = d.reject;
		xhr.send();
		return d.promise;
	};
	$.getJSON = function(url){
		return $.get(url)
			.success(function(res){
				return JSON.parse(res);
			})
		;
	};
	// add basic replace elmt method
	$.fn.replace = function(elmt){
		var self = this;
		elmt.nodeType && (elmt = $(elmt));
		return $.each(elmt,function(){
			this.parentNode.insertBefore(self[0] || self, this);
			this.parentNode && this.parentNode.removeChild(this);
		});
	};

	// get and register required stpl templates
	$.get('test.stpl').success(function(tpl){ stpl.registerString('test',tpl); });

	// on ready document bind events
	$(function(){
		$('body').on('click', 'button.testrunner', function(){
			var button = $(this)
				, testName = button.attr('rel')
				, parent = $('#'+testName+', #'+testName+'-dd')
				, testStatusPromise = $.getJSON('/run/'+testName)
			;
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
					$(stpl('test', res)).replace(parent);
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
