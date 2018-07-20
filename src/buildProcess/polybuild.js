const path = require('path');
const vinylFs = require('vinyl-fs');

const {PolymerProject, getOptimizeStreams, forkStream, HtmlSplitter} = require('polymer-build');
const {pipeStreams, waitFor} = require('polymer-build/lib/streams');
const mergeStream = require('merge-stream');
const CustomElementsEs5AdapterInjector = require('./custom-es5-injector');

const mainBuildDirectoryName = 'build';


/**
 * Generate a single build based on the given `options` ProjectBuildOptions.
 *
 * Note that this function is only concerned with that single build, and does
 * not care about the collection of builds defined on the config.
 *
 * @param {BuildOption} options
 * @param {PolymerProject} polymerProject
 *
 * @return {Promise}
 */
function build(options, polymerProject) {
	const buildName = options.name || 'default';
	
	// If no name is provided, write directly to the build/ directory.
	// If a build name is provided, write to that subdirectory.
	const buildDirectory = path.join(mainBuildDirectoryName, options.outputPath !== undefined ? options.outputPath : buildName);
	//console.log(`"${buildDirectory}": Building with options:`, options);
	
	// Fork the two streams to guarantee we are working with clean copies of each
	// file and not sharing object references with other builds.
	const sourcesStream = forkStream(polymerProject.sources());
	const depsStream = forkStream(polymerProject.dependencies());
	
	const bundled = !!(options.bundle);
	
	// noinspection JSValidateTypes
	/**
	 * @type {NodeJS.ReadableStream | NodeJS.WritableStream}
	 */
	let buildStream = mergeStream(sourcesStream, depsStream);
	
	const compiledToES5 = (options.js === undefined)
		? false
		: options.js.compile === true || options.js.compile === 'es5';
	if (compiledToES5) {
		buildStream = buildStream.pipe(new CustomElementsEs5AdapterInjector());
	}
	
	if (bundled) {
		// Polymer 1.x and Polymer 2.x deal with relative urls in dom-module
		// templates differently.  Polymer CLI will attempt to provide a sensible
		// default value for the `rewriteUrlsInTemplates` option passed to
		// `polymer-bundler` based on the version of Polymer found in the project's
		// folders.  We will default to Polymer 1.x behavior unless 2.x is found.
		const polymerVersion = '3.0.0';
		const bundlerOptions = {
			rewriteUrlsInTemplates: !polymerVersion.startsWith('2.'),
		};
		if (typeof options.bundle === 'object') {
			Object.assign(bundlerOptions, options.bundle);
		}
		
		buildStream = buildStream.pipe(polymerProject.bundler(bundlerOptions));
	}
	
	const htmlSplitter = new HtmlSplitter();
	
	buildStream = pipeStreams([
		buildStream,
		htmlSplitter.split(),
		
		getOptimizeStreams({
			html: options.html,
			css: options.css,
			js: {
				...options.js,
				moduleResolution: polymerProject.config.moduleResolution,
			},
			entrypointPath: polymerProject.config.entrypoint,
			rootDir: polymerProject.config.root,
		}),
		
		htmlSplitter.rejoin(),
	]);
	
	if (options.insertPrefetchLinks) {
		buildStream = buildStream.pipe(polymerProject.addPrefetchLinks());
	}
	
	buildStream.once('data', () => {
		console.info(`(${buildName}) Building...`);
	});
	
	if (options.basePath) {
		let basePath = options.basePath === true ? buildName : options.basePath;
		if (!basePath.startsWith('/')) {
			basePath = '/' + basePath;
		}
		if (!basePath.endsWith('/')) {
			basePath = basePath + '/';
		}
		buildStream = buildStream.pipe(polymerProject.updateBaseTag(basePath));
	}
	
	if (options.addPushManifest) {
		buildStream = buildStream.pipe(polymerProject.addPushManifest());
	}
	
	// Finish the build stream by piping it into the final build directory.
	buildStream = buildStream.pipe(vinylFs.dest(buildDirectory));
	
	/* INSERT SW here */
	/*// If a service worker was requested, parse the service worker config file
	 // while the build is in progress. Loading the config file during the build
	 // saves the user ~300ms vs. loading it afterwards.
	 const swPrecacheConfigPath = path.resolve(
	 polymerProject.config.root,
	 options.swPrecacheConfig || 'sw-precache-config.js');
	 let swConfig: SWConfig|null = null;
	 if (options.addServiceWorker) {
	 swConfig = await loadServiceWorkerConfig(swPrecacheConfigPath);
	 }*/
	
	// There is nothing left to do, so wait for the build stream to complete.
	// noinspection JSCheckFunctionSignatures
	return waitFor(buildStream)
		.then(() => {
			/* IF SW inserted */
			/*if (options.addServiceWorker) {
			 logger.debug(`Generating service worker...`);
			 if (swConfig) {
			 logger.debug(`Service worker config found`, swConfig);
			 } else {
			 logger.debug(
			 `No service worker configuration found at ` +
			 `${swPrecacheConfigPath}, continuing with defaults`);
			 }
			 await addServiceWorker({
			 buildRoot: buildDirectory as LocalFsPath,
			 project: polymerProject,
			 swPrecacheConfig: swConfig || undefined,
			 bundled: bundled,
			 });
			 }*/
			
			console.info(`(${buildName}) Build complete!`);
		});
}

/**
 * Run a polymer build
 *
 * @param {{}} projectConfig - polymer.json config object, including build config
 * @param {{}} projectConfig.build - build config
 *
 * @return {Promise}
 */
function polyBuild(projectConfig) {
	// noinspection JSCheckFunctionSignatures
	const project = new PolymerProject(projectConfig);
	
	return build(projectConfig.build, project);
}


/**
 * @typedef {{}} BuildOption
 *
 * @property {string} name
 * @property {boolean | *} bundle
 * 
 * @property {{}} js
 * @property {boolean | 'es5' | 'es2015'} [js.compile]
 * @property {boolean} [js.minify]
 * @property {boolean} [js.transformModulesToAmd]
 * 
 * @property {{}} html
 * @property {boolean} [html.minify]
 * @property {{}} css
 * @property {boolean} [css.minify]
 * 
 * @property {boolean} insertPrefetchLinks
 * @property {string} basePath
 * @property {boolean} addPushManifest
 *
 * @property {string} outputPath
 */

module.exports = polyBuild;
