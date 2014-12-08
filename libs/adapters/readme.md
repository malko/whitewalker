# Making a framework adapter to use in whitewalker

So you want to use whitewalker but you use another framework than nightwatch or protractor.
No problem just create your own framework adapter.

First your module must reside in a file named after the adapter name e.g. nightwatch.js, protractor.js...
Basicly it will look like this:

```javascript
module.exports = {
	// how the configFileName should be named
	configFileName: 'nightwatch.json'
	// command line to launch with placeholders for selenium environment name and the testFilename to execute
	, cmdTemplate: 'nightwatch -e {{environment}} -c ./nightwatch.json -t {{testFilename}}'
	, configLoader: function(cfgPath){

	}
	, map: function(data){
		// must return json data
	}
};
```
