import { DEFAULT_ASCENT_DIVISOR, DEFAULT_DESCENT_DIVISOR } from './calc.js';
import { DEFAULT_PROVIDER } from './elevation.js';

let stages = $state([]);
let error = $state('');
let filename = $state('');
let loading = $state(false);
let loadingMessage = $state('');
let ascentDivisor = $state(DEFAULT_ASCENT_DIVISOR);
let descentDivisor = $state(DEFAULT_DESCENT_DIVISOR);
let currentTrack = $state(null);
let currentRawTrack = $state(null);
let currentWaypoints = $state(null);
let dragging = $state(false);
let elevationProvider = $state(DEFAULT_PROVIDER);

export function getAppState() {
	return {
		get stages() { return stages; },
		set stages(v) { stages = v; },
		get error() { return error; },
		set error(v) { error = v; },
		get filename() { return filename; },
		set filename(v) { filename = v; },
		get loading() { return loading; },
		set loading(v) { loading = v; },
		get loadingMessage() { return loadingMessage; },
		set loadingMessage(v) { loadingMessage = v; },
		get ascentDivisor() { return ascentDivisor; },
		set ascentDivisor(v) { ascentDivisor = v; },
		get descentDivisor() { return descentDivisor; },
		set descentDivisor(v) { descentDivisor = v; },
		get currentTrack() { return currentTrack; },
		set currentTrack(v) { currentTrack = v; },
		get currentRawTrack() { return currentRawTrack; },
		set currentRawTrack(v) { currentRawTrack = v; },
		get currentWaypoints() { return currentWaypoints; },
		set currentWaypoints(v) { currentWaypoints = v; },
		get dragging() { return dragging; },
		set dragging(v) { dragging = v; },
		get elevationProvider() { return elevationProvider; },
		set elevationProvider(v) { elevationProvider = v; },
	};
}
