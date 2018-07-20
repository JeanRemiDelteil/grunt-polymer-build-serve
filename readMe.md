# grunt-polymer-build-serve

- Use polymer-build with grunt to streamline build process
- Serve front-end project using node es6 imports resolution and Firebase hosting settings

## Tasks

### polyServe

parameters:
- host: 'localhost'
- port: '5000'
- root: ./path/to/root

Issue: (because we're using superstatic and not firebase serve logic)
- No automatic Firebase 404 page
- No automatic Firebase settings
- No automatic /__/ Firebase library

### polyBuild

parameters:
- Same parameters as expect for polymer.json
- build: contain build specific options
```javascript
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
```

Issue:
- no SW insertion
- polymer version not detected (3.x by default)