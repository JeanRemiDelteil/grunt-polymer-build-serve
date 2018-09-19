/**
 * Implement a static server with superstatic, that can fix node import for use in front-end code.
 * Fix node import using poly-serve
 */


const superstatic = require("superstatic").server;
const path = require("path");
const fetch = require("node-fetch");
const {Readable} = require('stream');
const polyServeCLI = require("polyserve/lib/cli");


class StreamBuffer extends Readable {
	
	constructor(buffer) {
		super();
		
		this.push(buffer);
		this.push(null);
	}
	
	// noinspection JSUnusedGlobalSymbols
	_read() {
	}
}

/**
 * Start superStatic server
 *
 * @param options
 * @param options.cwd
 * @param options.port
 * @param options.host
 * @param options.config
 * @param options.provider
 */
function startSuperStatic(options) {
	
	let server = superstatic({
		debug: false,
		port: options.port,
		host: options.host,
		config: options.config,
		cwd: options.cwd,
		stack: "strict",
		provider: options.provider,
	});
	
	return new Promise(resolve => server.listen(() => resolve({
		host: options.host,
		port: options.port,
	})));
}

function getProvider(port) {
	
	/**
	 * Resolve file request through local polyserve server
	 *
	 * @param req
	 * @param pathName
	 */
	return function provider(req, pathName) {
		// noinspection JSUnresolvedFunction
		return fetch(`http://localhost:${port}${pathName}`, {
			headers: {
				// avoid compilation, (CLI option 'never' does not work)
				'User-Agent': 'Chrome/69.0.3497.100',
			}
		})
			.then(res => res.buffer())
			.then(buffer => {
				
				// Check content for file not found
				const content = buffer.toString();
				if (/^(ENOENT|ENOTDIR|EISDIR)/.test(content)) return null;
				
				
				return {
					// A readable stream for the content
					stream: new StreamBuffer(buffer),
					// The length of the content
					size: buffer.length,
					/*// (optional) a content-unique string such as an MD5 hash computed from the content
					 etag: null,
					 // (optional) a Date object for when the content was last modified
					 modified: null,*/
				};
			});
	};
}

function setCliArg(args) {
	let newArgs = process.argv.slice(0, 2);
	
	// Set arguments
	for (let arg in args) {
		newArgs.push(`--${arg}=${args[arg]}`);
	}
	
	process.argv = newArgs;
}


/**
 * @param options
 * @param options.port
 * @param options.host
 * @param options.root
 *
 * @return Promise
 */
function startDevServer(options) {
	options = options || {};
	options.host = options.host || 'localhost';
	options.port = options.port || '5000';
	
	let cwd = path.join(process.cwd(), options.root);
	
	
	// load firebase options if any
	try {
		let firebaseOptions = require(path.join(cwd, 'firebase.json'));
		firebaseOptions['hosting'] && (options['config'] = firebaseOptions['hosting']);
	}
	catch (e) {
	}
	options.config && (cwd = path.join(cwd, options.config.public));
	
	// Set options for Polymer server
	let cliArgs = {
		'compile': 'never',
		'root': cwd,
		'module-resolution': 'node',
	};
	!options.config && (cliArgs['port'] = options.port);
	setCliArg(cliArgs);
	
	options.config && console.log('Starting intermediary DEV server...\n');
	
	// Start intermediary dev server
	let polymer_server;
	// noinspection JSCheckFunctionSignatures
	return polyServeCLI.run()
		.then(serverOptions => {
			polymer_server = serverOptions['server'];
			const intermediaryServerPort = polymer_server.address().port;
			
			if (!options.config) return {
				host: polymer_server.address().address,
				port: intermediaryServerPort,
			};
			
			return startSuperStatic({
				...options,
				cwd,
				provider: getProvider(intermediaryServerPort),
			});
		})
		.then(({host, port}) => {
			console.log(`DEV server started, serving ${cwd}`);
			console.log(`DEV server: http://${host}:${port}  ${options.config && '* Using Firebase server *' || ''}`);
			
			return polymer_server;
		})
		.catch(err => {
			console.error(err);
			process.exit(69);
		});
}


module.exports = {
	start: startDevServer,
};
