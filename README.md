# sri-lazy-loader

![CI](https://github.com/bryanhamiltondev/sri-lazy-loader/actions/workflows/ci.yml/badge.svg)

**Race-safe lazy script loader with Subresource Integrity.** A variant of this module loads Leaflet on [thedjcalendar.com](https://thedjcalendar.com) — but only on pages that actually render a map, and only once, no matter how many components ask for it. Zero dependencies.

---

## The problem it solves

Lazy-loading a CDN library with a `<script>` tag is five lines of code — and then it breaks in production in four ways this module prevents:

1. **The double-load race.** Two independent widgets (a city map and a "Next Show Radar" panel) both need Leaflet. Both inject a script tag. The library initializes twice and its global state corrupts: markers registered on a destroyed map instance. The loader returns the same in-flight Promise to concurrent callers — one tag, one init.

2. **The pre-existing tag.** Another system loaded the library first. Re-injecting is the same corruption with extra steps; the loader detects the existing tag and resolves immediately.

3. **The tampered CDN file.** Third-party origins get an SRI hash and crossorigin, so a compromised CDN or MITM payload is blocked by the browser before it executes. A supply-chain attack on a mapping library should not become an incident on your site.

4. **The hung request.** A stalled CDN request must not leave a zombie `<script>` tag and a Promise that never settles. Timeout -> node removed -> in-flight entry cleared, so a later retry actually *can* retry.

---

## Usage

```js
loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', {
  integrity: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
  crossOrigin: ''
}).then(function () {
  var map = L.map('map-canvas').setView([40.9, -74.1], 11);
});
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `integrity` | — | SRI hash (`sha384-...` or `sha256-...`) for third-party scripts |
| `crossOrigin` | `'anonymous'` | Cross-origin mode for integrity'd scripts |
| `timeoutMs` | `12000` | Max milliseconds before rejecting and cleaning up |

### Result

Returns a Promise that resolves with the `<script>` element on success, or rejects with an `Error` on failure/timeout. The loader never leaves zombie nodes or dangling listeners.

---

## From production

On thedjcalendar.com, every city page and the "Next Show Radar" map calls `loadLeaflet()` on first interaction. Before this module shipped, we'd occasionally see duplicate Leaflet instances — one map would initialize, then a second `<script>` tag would land and re-initialize, corrupting the first map's state. The bug was intermittent, impossible to reproduce in dev (no race condition over localhost), and the fix was a single module that treats the Promise registry as the source of truth.

The `loadLeaflet()` helper is included as the documented real-world use case:

```js
function loadLeaflet() {
  return loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', {
    integrity: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
    crossOrigin: ''
  }).then(function () {
    return window.L;
  });
}
```

---

## Design decisions

| Decision | Why |
|----------|-----|
| **Promise registry keyed by URL** | Deduping concurrent callers is one line with a cache; without it, every race is a heisenbug. |
| **Detect pre-existing tags** | The DOM is shared state; pretending otherwise is how double-initialization bugs ship. |
| **SRI on everything third-party** | The loader is the last line of defense for supply-chain integrity; it costs one hash. |
| **Cleanup on failure** | A dead script node with a dangling `onerror` is a leak; timeout must unblock retries, not just reject. |
| **No bundler, no framework** | Ships as one file that a plain `<script>` tag or any module system can use. |

---

## Related

- [dj-card-preview](https://github.com/bryanhamiltondev/dj-card-preview) — hover-preview system that uses this loader for its Leaflet dependency on map-rich pages
- [next-show-radar](https://github.com/bryanhamiltondev/next-show-radar) — the map widget this loader was built to support
