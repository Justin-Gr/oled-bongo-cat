//========== GLOBAL KEY LISTENER ==========

// const { GlobalKeyboardListener } = require('node-global-key-listener');
//
// const listener = new GlobalKeyboardListener();
//
// listener.addListener((e, down) => {
// 	console.log(`${e.name} ${down ? 'pressed' : 'released'}`);
// });

//========== BONGO CAT FRAMES ==========

const bongoCatFrames = require('./bongo-cat.json');
const frames = [
	bongoCatFrames['frame0'], // hands up
	bongoCatFrames['frame1'], // left hand down
	bongoCatFrames['frame2'], // right hand down
	bongoCatFrames['frame3']  // both hands down
]

let frameIndex = 0;
let idleTimeout;

const IDLE_TIMEOUT_DURATION = 1000;

//========== GAMESENSE SETUP ==========

/** @type {any} */
const gamesense = require('gamesense-client');

const endpoint = new gamesense.ServerEndpoint();
endpoint.discoverUrl();

const game = new gamesense.Game('OLED_BONGO_CAT', 'OLED Bongo Cat', 'jgrosjean');
const client = new gamesense.GameClient(game, endpoint);

const screenEvent = new gamesense.GameEvent('SCREEN_EVENT');

const SCREEN_WITH = 128;
const SCREEN_HEIGHT = 40;
const DEVICE_TYPE = gamesense.DeviceType.SCREENED128x40;

client.registerGame()
	.then(bindScreenHandler)
	.then(initScreen)
	.then(bindKeyListener)
	.then(client.startHeartbeatSending)
	.catch(error => console.error(error));

/**
 * Binds the screen event handler to the screen event.
 */
async function bindScreenHandler() {
	/**
	 * Setup of an event handler for the screen device.
	 * @type {gamesense.ScreenEventHandler}
	 */
	const screenEventHandler = new gamesense.ScreenEventHandler(DEVICE_TYPE, gamesense.ScreenZone.ONE);
	screenEventHandler.datas = [blankImage()];
	await client.bindEvent(screenEvent, [screenEventHandler]);
}

/**
 * Creates a blank image.
 * @returns {gamesense.ImageFrame}
 */
function blankImage() {
	const data = new Array(SCREEN_WITH * SCREEN_HEIGHT / 8).fill(0);
	return new gamesense.ImageFrame(data);
}

/**
 * Screen initialization.
 */
async function initScreen() {
	await updateScreenEvent(0);
}

/**
 * Setups and binds the key listener.
 */
function bindKeyListener() {
	process.stdin.setRawMode(true);
	process.stdin.resume();
	process.stdin.setEncoding("utf8");
	process.stdin.on("data", async key => await handleKeyPress(key));
}

/**
 * Handles key presses.
 *
 * @param key
 * @returns {Promise<void>}
 */
async function handleKeyPress(key) {
	// Handles interruption signal
	if (key === "\u0003") {
		await gracefulShutdown();
	}

	// Switches frame
	frameIndex = frameIndex === 1 ? 2 : 1;
	await updateScreenEvent(frameIndex);

	// Setups idle timeout
	clearTimeout(idleTimeout);
	idleTimeout = setTimeout(() => {
		frameIndex = 0;
		updateScreenEvent(frameIndex);
	}, IDLE_TIMEOUT_DURATION);
}

/**
 * Updates the screen event to display a frame.
 * @param {!number} frameIndex
 */
async function updateScreenEvent(frameIndex) {
	const imageDataKey = `image-data-${SCREEN_WITH}x${SCREEN_HEIGHT}`;

	screenEvent.value = frameIndex;
	screenEvent.frame = {
		[imageDataKey]: frames[frameIndex]
	};

	await client.sendGameEventUpdate(screenEvent);
}

/**
 * Gracefully shutdowns the program by unbinding it from GameSense.
 * @returns {Promise<void>}
 */
async function gracefulShutdown() {
	console.log('Shutting down');
	process.stdin.setRawMode(false);
	process.stdin.pause();

	try {
		client.stopHeartbeatSending();
		await client.stopGame();
		await client.removeGame();
		console.log('Successfully removed OLED Bongo Cat');
	}
	finally {
		process.exit(0);
	}
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('SIGHUP', gracefulShutdown);