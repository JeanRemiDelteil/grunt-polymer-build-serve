/**
 * Register Grunt tasks to
 * - polyServe: Serve a project using es6 and node imports & Firebase hosting settings
 * - polyBuild: Build a polymer 3 / webComponent project
 */

/**
 * Detect if module is loaded via Grunt
 *
 * @return {boolean}
 * @private
 */
function _isGruntProcess() {
	let moduleParent = module;
	while (moduleParent = moduleParent.parent) {
		if (/grunt\.js$/.test(moduleParent.filename)) return true;
	}
	
	return false;
}

/**
 * Register grunt tasks
 * 
 * @param grunt
 */
function registerGruntTasks(grunt) {
	
	// noinspection JSUnresolvedFunction
	/**
	 * Register the polyServe task
	 */
	grunt.registerMultiTask('polyServe', 'run a dev serve, serving es6 app and/or firebase app', function () {
		const startServer = require('../src/server/firePolyServe').start;
		const config = this.data;
		const done = this.async();
		
		startServer(config)
			.then(() => new Promise(resolve => process.on('SIGINT', resolve)))
			.then(done);
	});
	
	// noinspection JSUnresolvedFunction
	/**
	 * Register the polyBuild task
	 */
	grunt.registerMultiTask('polyBuild', 'run polymer-build', function () {
		/**
		 * @type {polyBuild}
		 */
		const polyBuild = require('../src/buildProcess/polybuild');
		const config = this.data;
		const done = this.async();
		
		
		polyBuild(config)
			.then(done);
	});
	
}


module.exports = _isGruntProcess()
	? registerGruntTasks
	: {
		polyServe: require('../src/server/firePolyServe'),
		polyBuild: require('../src/buildProcess/polybuild'),
	};
