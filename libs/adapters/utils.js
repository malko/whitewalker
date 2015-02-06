var fs = require('fs')
	, adaptersCache = []
;

function isDir(dirPath){
	return fs.statSync(dirPath).isDirectory();
}

function normalizeAdapterConfigPath(adapterOrAdapterName, path){
	if ( typeof adapterOrAdapterName === 'string' ){
		adapterOrAdapterName = getAdapterInstance(adapterOrAdapterName);
	}
	if ( isDir(path) ){
		path += '/' + adapterOrAdapterName.configFileName;
	}
	return path;
}

/**
* return a cached list of availables adapter unless forceRefresh is true
* @param {boolean} forceRefresh force to refresh the cache of availables adapter
*/

function listAvailables(forceRefresh) {
	forceRefresh && (adaptersCache = []);

	if( adaptersCache.length ){
		return adaptersCache;
	}

	adaptersCache = fs.readdirSync(__dirname).filter(function(fileOrDirName){
		return isDir(__dirname + '/' + fileOrDirName);
	});
	return adaptersCache;
}

/**
* return the corresponding adapter from its name
* @param {string} adapterName the name of the adapter we want to use
*/
function getAdapterInstance(adapterName){
	return require(__dirname + '/' + adapterName + '/' + adapterName + '.js');
}

/**
* read a config for given adapter at path
* @param {string} adapterName the name of the adapter we want to use
* @param {string} path file or directory to read the config from. In case of a directory will automatically append the adapter.configFileName
*/
function readConfig(adapterName, path){
	var adapter = getAdapterInstance(adapterName);
	return adapter.configLoader(normalizeAdapterConfigPath(adapter, path));
}

/**
* return the translated configuration
* @param {string} adapterName the name of the adapter we want to use
* @param {object} config the config to write
*/
function translateConfig(adapterName, config){
	return getAdapterInstance(adapterName).configTranslator(config);
}
/**
* write a config for given adapter in given path
* @param {string} adapterName the name of the adapter we want to use
* @param {string} path file or directory where to write the config. In case of a directory will automatically append the adapter.configFileName
* @param {object} config the config to write
*/
function writeConfig(adapterName, path, config){
	var adapter = getAdapterInstance(adapterName);
	return adapter.configWriter(normalizeAdapterConfigPath(adapter, path), config);
}

/**
* check the given path exists or it contains an adapter config file in case of a directory
* @param {string} adapterName the name of the adapter we want to use
* @param {string} path file or directory where to verify the config. In case of a directory will automatically append the adapter.configFileName
*/
function hasConfig(adapterName, path){
	return fs.existsSync(normalizeAdapterConfigPath(adapterName, path));
}

/**
* get the default config for given adapter
* @param {string} adapterName the name of the adapter we want to use
*/
function getDefaultConfig(adapterName){
	return getAdapterInstance(adapterName).getDefaultConfig();
}

module.exports = {
	listAvailables: listAvailables
	, getInstance: getAdapterInstance
	, readConfig: readConfig
	, translateConfig: translateConfig
	, writeConfig: writeConfig
	, hasConfig: hasConfig
	, getDefaultConfig: getDefaultConfig
};
