/**

- sri-lazy-loader.js
- 
- Race-safe lazy script loader with Subresource Integrity (SRI).
- A variant of this module loads Leaflet on thedjcalendar.com only when a
- page actually needs a map - and survives the failure modes that plain
- script-tag injection does not.
- 
- Handles:
- 
  - concurrent callers: two widgets request the same library at once,
- both get the same in-flight Promise, the script loads exactly once
- 
  - pre-existing tags: if the library is already in the DOM (another
- system loaded it), resolve immediately instead of double-loading
- and corrupting its globals
- 
  - integrity: SRI hash + crossorigin, so a tampered CDN file can never
- execute
- 
  - timeout + cleanup: a hung CDN request rejects, removes its node,
- and unblocks a later retry
- 
  - zero dependencies
     */

var inflight = {};   // url -> Promise

/**

- loadScript(url, opts) -> Promise
- 
- opts: {
- integrity:   'sha384-...'   (for third-party origins)
- crossOrigin: 'anonymous'    (default for integrity'd scripts)
- timeoutMs:   12000
- }
   */
  function loadScript(url, opts) {
    opts = opts || {};

  // Already resolved once? Return the same promise to every caller.
  if (inflight[url]) {
    return inflight[url];
  }

  // Already in the DOM from another loader? Do not load it twice -
  // double-loading a stateful library (e.g. Leaflet) corrupts its globals.
  var existing = document.querySelector('script[src="' + url + '"]');
  if (existing) {
    inflight[url] = Promise.resolve(existing);
    return inflight[url];
  }

  inflight[url] = new Promise(function (resolve, reject) {
    var script = document.createElement('script');
    script.src = url;
    script.async = true;

if (opts.integrity) {
  script.integrity = opts.integrity;
  script.crossOrigin = opts.crossOrigin || 'anonymous';
}

var timer = setTimeout(function () {
  cleanup(script);
  delete inflight[url];          // unblock a future retry
  reject(new Error('script load timed out: ' + url));
}, opts.timeoutMs || 12000);

function cleanup(node) {
  clearTimeout(timer);
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }
}

script.onload = function () {
  cleanup(script);
  resolve(script);
};
script.onerror = function () {
  cleanup(script);
  delete inflight[url];
  reject(new Error('script failed to load: ' + url));
};

document.head.appendChild(script);

  });

  return inflight[url];
}

/**

- loadLeaflet() - the production use case, kept as documentation:
- a map page pulls its own dependency, first-touch only.
   */
  function loadLeaflet() {
    return loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', {
   integrity: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
   crossOrigin: ''
    }).then(function () {
   return window.L;
    });
  }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadScript: loadScript };
}
