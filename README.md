sri-lazy-loader

A race-safe lazy script loader with Subresource Integrity. A variant of this
module loads Leaflet (https://leafletjs.com) on
The DJ Calendar (https://thedjcalendar.com) - only on pages that actually
render a map, and only once, no matter how many components ask for it.

The problem it solves

Lazy-loading a CDN library with a <script> tag is five lines of code -
and then it breaks in production in four ways this module prevents:

1. The double-load race. Two independent widgets (a city map and a
   "Next Show Radar" panel) both need Leaflet. Both inject a script tag.
   The library initializes twice and its global state corrupts: markers
   registered on a destroyed map instance. The loader returns the same
   in-flight Promise to concurrent callers - one tag, one init.
2. The pre-existing tag. Another system loaded the library first.
   Re-injecting is the same corruption with extra steps; the loader detects
   the existing tag and resolves immediately.
3. The tampered CDN file. Third-party origins get an SRI hash and
   crossorigin, so a compromised CDN or MITM payload is blocked by the
   browser before it executes. A supply-chain attack on a mapping library
   should not become an incident on your site.
4. The hung request. A stalled CDN request must not leave a zombie
   <script> tag and a Promise that never settles. Timeout -> node removed
   -> in-flight entry cleared, so a later retry actually can retry.

Usage

loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', {
  integrity: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
  crossOrigin: ''
}).then(function () {
  var map = L.map('map-canvas').setView([40.9, -74.1], 11);
});

Design decisions

| Decision                      | Why                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| Promise registry keyed by URL | Deduping concurrent callers is one line with a cache; without it, every race is a heisenbug.         |
| Detect pre-existing tags      | The DOM is shared state; pretending otherwise is how double-initialization bugs ship.                |
| SRI on everything third-party | The loader is the last line of defense for supply-chain integrity; it costs one hash.                |
| Cleanup on failure            | A dead script node with a dangling onerror is a leak; timeout must unblock retries, not just reject. |
| No bundler, no framework      | Ships as one file that a plain <script> tag or any module system can use.                            |

Scope

Pattern implementation, published as-is: the production site passes its own
mount elements and hash configuration at the call site. loadLeaflet() is
included as the documented real-world use case.
