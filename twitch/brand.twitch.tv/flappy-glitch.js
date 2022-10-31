;(function() {
"use strict";

var GAME_DISPLAY_HEIGHT = 600;
var SPRITE_HEIGHT = 120;
var SPRITE_WIDTH = 120;
var SPRITE_HIT_OFFSET = 24;
var COLOR_HEIGHT = 40;
var COLOR_WIDTH = 40;
var GRAVITY = 2200;
var JUMP_VELOCITY = -740;
var SCROLL_VELOCITY = -400;
var SPAWN_ROWS = 10;
var EMOTE_SPAWN_TIMER = 1500;
var COLOR_SPAWN_TIMER = 1000;
var DEFAULT_BACKGROUND = "#000";

var SCROLL_SPEED_INCREASE_TIMER = 2000;
var SCROLL_VELOCITY_INCREMENT = 8;
var SCROLL_VELOCITY_INCREMENT_MAX = 350;

var STATE_START = 0;
var STATE_PLAYING = 1;
var STATE_ENDING = 2;
var STATE_END = 3;

var MUSIC_VOLUME = 1;
var SOUND_VOLUME = 0.7;

var COLOR_POINTS = 50;
var GRADIENT_POINTS = 100;

var Assets = Assets || {};

function hexStringToNumber(hexString) {
	return parseInt(hexString.replace(/^#/, ""), 16);
}

var shapes = [
	[1, 1],
	[1, 2], [1, 3], [1, 4],
	[2, 1], [3, 1], [4, 1]
];


Assets.loadMaps = function (colorMap, gradientMap, emoteMap) {
	Assets.colorMap = colorMap;
	Assets.gradientMap = gradientMap;
	Assets.emoteMap = emoteMap;
	Assets.colorKeys = Object.keys(Assets.colorMap);
	Assets.emoteKeys = Object.keys(Assets.emoteMap);
	Assets.gradientKeys = [];
};

Assets.preload = function (baseUrl) {
	baseUrl = baseUrl ? (baseUrl + "/").replace(/\/+$/, "") + "/" : "/";

	// Audio from https://www.kenney.nl/assets/digital-audio (CC0 1.0 Universal)
	this.load.audio("hit", baseUrl + "sounds/hit.mp3");
	this.load.audio("jump", baseUrl + "sounds/jump.mp3");
	this.load.audio("pickup", baseUrl + "sounds/pickup.mp3");

	this.load.image("glitch", baseUrl + "images/glitch.png");

	for (var i = 0; i < Assets.emoteKeys.length; i++) {
		this.load.image(Assets.emoteKeys[i], Assets.emoteMap[Assets.emoteKeys[i]]);
	}

	for (var colorKey in Assets.colorMap) {
		if (Assets.colorMap.hasOwnProperty(colorKey)) {
			Assets.colorMap[colorKey].value = hexStringToNumber(Assets.colorMap[colorKey].color);
		}
	}

	for (i = 0; i < Assets.gradientMap.length; i++) {
		if (Assets.gradientMap[i].color.length < 2) {
			continue;
		}

		var gradientKey = "_gradient-" + (Assets.gradientMap[i].name || i);
		var texture = this.textures.createCanvas(gradientKey, COLOR_WIDTH, COLOR_HEIGHT);
		var context = texture.getContext();
		var gradient = context.createLinearGradient(0, 0, 0, COLOR_HEIGHT);
		var stopLength = 1 / (Assets.gradientMap[i].color.length - 1);

		for (var j = 0; j < Assets.gradientMap[i].color.length; j++) {
			gradient.addColorStop(j * stopLength, Assets.gradientMap[i].color[j]);
		}

		context.fillStyle = gradient;
		context.strokeStyle = Assets.gradientMap[i].color[0] + "33";
		context.beginPath();
		context.arc(COLOR_WIDTH / 2, COLOR_HEIGHT / 2, COLOR_WIDTH / 2, 0, 2 * Math.PI);
		context.fill();
		context.stroke();

		texture.refresh();

		Assets.colorMap[gradientKey] = Assets.gradientMap[i];
		Assets.gradientKeys.push(gradientKey);
	}
};

Assets.getRandomShape = function () {
	return shapes[Math.floor(Math.random() * shapes.length)];
};

Assets.getRandomEmoteKey = function (excludeLastIndex) {
	return Assets.emoteKeys[Math.floor(Math.random() * Assets.emoteKeys.length - (excludeLastIndex ? 1 : 0))];
};

Assets.getRandomColorKey = function () {
	return Assets.colorKeys[Math.floor(Math.random() * Assets.colorKeys.length)];
};

Assets.getRandomGradientKey = function () {
	return Assets.gradientKeys[Math.floor(Math.random() * Assets.gradientKeys.length)];
};

function createPlayer() {
	this.player = this.physics.add.image(this.cameras.main.centerX - (this.spriteWidthScaled / 2), this.cameras.main.centerY - (this.spriteHeightScaled / 4), "glitch")
		.setScale(this.spriteScale)
		.setVelocity(0, 0)
		.setOrigin(0, 0.5)
		.setDepth(2)
		.setSize(SPRITE_WIDTH - SPRITE_HIT_OFFSET, SPRITE_HEIGHT - SPRITE_HIT_OFFSET)
		.setOffset(SPRITE_HIT_OFFSET / 2, SPRITE_HIT_OFFSET / 2);

	this.player.body.allowGravity = false;

	this.playerTween = this.tweens.add({
		targets: this.player,
		y: this.player.y + (this.spriteHeightScaled / 2),
		duration: 450,
		ease: "Sine.easeInOut",
		yoyo: true,
		loop: -1
	});
}

function resetPlayer() {
	this.player.alive = true;
	this.player.body.allowGravity = true;
	this.playerTween.stop();
}

function updatePlayer() {
	if (this.player.angle < 20) {
		this.player.angle += 1;
	}
}

var game;
var onDone;
var onLoad;
var onCollect;
var assetsBaseUrl;
var starting = false;
var preloaded = false;

var containerElement;
var backgroundElements = [];
var currentBackgroundIndex = 0;
var scoreElement;
var colorElement;



// ----
// Init

window.startFlappyGlitch = function (options) {
	if (starting) {
		return;
	}

	starting = true;

	if (game) {
		game.scene.scenes[0].scene.restart();
		return;
	}

	Assets.loadMaps(options.colorMap, options.gradientMap, options.emoteMap);

	assetsBaseUrl = options.assetsBaseUrl;
	onDone = options.onDone || function () {};
	onLoad = options.onLoad || function () {};
	onCollect = options.onCollect || function () {};
	containerElement = document.getElementById(options.containerId);

	scoreElement = document.createElement("div");
	scoreElement.classList.add("game-text");
	scoreElement.classList.add("score-text");
	containerElement.appendChild(scoreElement);

	colorElement = document.createElement("div");
	colorElement.classList.add("game-text");
	colorElement.classList.add("color-text");
	containerElement.appendChild(colorElement);

	for (var i = 0; i < 2; i++) {
		var backgroundElement = document.createElement("div");
		backgroundElement.classList.add("game-background");
		backgroundElements.push(backgroundElement);
		containerElement.appendChild(backgroundElement);
	}

	backgroundElements[0].classList.add("active");

	game = new Phaser.Game({
		type: Phaser.AUTO,
		parent: options.containerId,
		transparent: true,
		input: {
			keyboard: true
		},
		scale: {
			mode: Phaser.Scale.RESIZE,
			parent: options.containerId,
			width: "100%",
			height: "100%"
    },
		autoRound: false,
		physics: {
			default: "arcade",
			arcade: {
				gravity: {y: GRAVITY}
			}
		},
		scene: {
			preload: preload,
			create: create,
			update: update
		}
	});
};



// -----
// Scene

function preload() {
	if (preloaded) {
		return;
	}

	preloaded = true;

	Assets.preload.apply(this, [assetsBaseUrl]);
}

function create() {
	onLoad();
	starting = false;
	resetDependencies.apply(this);
	this.scrollSpeedIncrease = 0;
	this.lastHitEmoteKey = null;
	this.currentColorKey = null;
	this.score = 0;
	this.highscore = this.highscore || 0;

	scoreElement.innerText = "";
	colorElement.innerText = "";

	this.state = STATE_START;

	updateSpriteScale.apply(this, [this.cameras.main.height]);
	createPlayer.apply(this);
	adjustForSpriteScale.apply(this);

	this.emotes = this.add.group();
	this.colors = this.add.group();

	for (var i = 0; i < backgroundElements.length; i++) {
		backgroundElements[i].style.background = DEFAULT_BACKGROUND;
	}

	this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
	this.jumpKey.once("down", onFirstInput.bind(this));
	this.input.on("pointerdown", onFirstInput.bind(this));

	this.oldHeight = this.cameras.main.height;
	this.oldWidth = this.cameras.main.width;
	this.scale.on("resize", resize, this);
}

function onFirstInput() {
	this.jumpKey.removeAllListeners();
	this.input.removeAllListeners();
	start.apply(this);
}

function resetDependencies() {
	this.time.removeAllEvents();
	this.input.removeAllListeners();
	this.scale.off("resize", resize);

	if (this.jumpKey) {
		this.jumpKey.removeAllListeners();
	}
}

function update() {
	if (this.state !== STATE_END && this.player.y - (this.spriteHeightScaled / 2) > this.sys.canvas.height) {
		this.state = STATE_END;
		resetDependencies.apply(this);

		if (onDone) {
			onDone(getResults.apply(this));
			this.scene.stop();
		} else {
			this.scene.start();
		}

		return;
	}

	if (this.state !== STATE_PLAYING) {
		return;
	}

	updatePlayer.apply(this);
	this.emotes.children.each(function (emote, list) {
		if (emote.x < -this.spriteWidthScaled) {
			this.emotes.remove(emote, true, true);
		}

		emote.setScale(this.spriteScale);
	}.bind(this));

	this.colors.children.each(function (color, list) {
		if (color.x < -this.spriteWidthScaled) {
			this.colors.remove(color, true, true);
		}

		color.setScale(this.spriteScale);
	}.bind(this));

	this.physics.overlap(this.player, this.emotes, hitEmote.bind(this));
	this.physics.overlap(this.player, this.colors, collectColor.bind(this));
	this.physics.overlap(this.colors, this.emotes, destroyColor.bind(this));
}



function start() {
	if (this.state !== STATE_START) {
		return;
	}

	this.state = STATE_PLAYING;

	scoreElement.innerText = this.score;
	setCurrentColor.apply(this, [Assets.colorKeys[0]]);
	resetPlayer.apply(this);
	jump.apply(this);

	this.jumpKey.on("down", jump.bind(this));
	this.input.on("pointerdown", jump.bind(this));

	this.emoteSpawnTimer = this.time.addEvent({
		delay: EMOTE_SPAWN_TIMER * 2,
		callback: addEmotes.bind(this)
	});

	this.colorSpawnTimer = this.time.addEvent({
		delay: COLOR_SPAWN_TIMER,
		callback: addColor.bind(this),
		loop: true
	});

	this.increaseScrollVelocityTimer = this.time.addEvent({
		delay: SCROLL_SPEED_INCREASE_TIMER,
		callback: increaseScrollVelocity.bind(this),
		loop: true
	});
}



// -------
// Scaling

function resize(gameSize) {
	var yDelta = gameSize.height / this.oldHeight;
	var xDelta = gameSize.width / this.oldWidth;

	this.oldHeight = this.cameras.main.height;
	this.oldWidth = this.cameras.main.width;
	this.cameras.resize(gameSize.width, gameSize.height);
	this.physics.world.setBounds(0, 0, gameSize.width, gameSize.height, true, true, true, true);

	updateSpriteScale.apply(this, [gameSize.height]);
	adjustForSpriteScale.apply(this);

	this.player.setX((gameSize.width / 2) - (this.spriteWidthScaled / 2));
	this.player.setY(this.player.y * yDelta);

	this.emotes.children.each(function (emote) {
		emote.setPosition(emote.x * yDelta, emote.y * yDelta);
		emote.setScale(this.spriteScale);
		emote.setVelocityX(this.scrollVelocityScaled - this.scrollSpeedIncrease);
	}.bind(this));

	this.colors.children.each(function (color) {
		color.setPosition(color.x * yDelta, color.y * yDelta);
		color.body.velocity.x = this.scrollVelocityScaled - this.scrollSpeedIncrease;
	}.bind(this));
}

function updateSpriteScale(height) {
	this.spriteScale = 0.5 * (height / GAME_DISPLAY_HEIGHT);
	this.spriteHeightScaled = this.spriteScale * SPRITE_HEIGHT;
	this.spriteWidthScaled = this.spriteScale * SPRITE_WIDTH;
}

function adjustForSpriteScale() {
	this.physics.world.gravity.y = GRAVITY * this.spriteScale;
	this.jumpVelocityScaled = JUMP_VELOCITY * this.spriteScale;
	this.scrollVelocityScaled = SCROLL_VELOCITY * this.spriteScale;
	this.player.setScale(this.spriteScale);
}



// -------
// Actions

function jump() {
	if (!this.player.alive || this.player.y < 0) {
		return;
	}

	this.sound.play("jump", {volume: SOUND_VOLUME});
	this.player.setVelocityY(this.jumpVelocityScaled);

	var animation = this.tweens.add({
		targets: this.player,
		angle: -20,
		duration: 100
	});
}

function collectColor(player, color) {
	this.score += color.points;

	if (this.score > this.highscore) {
		this.highscore = this.score;
	}

	this.sound.play("pickup", {volume: SOUND_VOLUME});
	scoreElement.innerText = this.score;
	setCurrentColor.apply(this, [color.colorKey]);
	this.colors.remove(color, true, true);

	onCollect(Assets.colorMap[color.colorKey]);
}

function hitEmote(player, emote) {
	if (!this.player.alive) {
		return;
	}

	this.sound.play("hit", {volume: SOUND_VOLUME});
	this.state = STATE_ENDING;
	this.player.alive = false;
	this.lastHitEmoteKey = emote.emoteName;
	this.time.removeAllEvents();

	this.colors.children.each(function (color) {
		color.body.velocity.x = 0;
	});

	this.emotes.children.each(function (emote) {
		emote.setVelocityX(0);
	});
}



// -------
// Helpers


function setCurrentColor(colorKey) {
	var colorOptions = Assets.colorMap[colorKey];

	this.currentColorKey = colorKey;

	backgroundElements[currentBackgroundIndex].classList.remove("active");
	currentBackgroundIndex = (currentBackgroundIndex + 1) % backgroundElements.length;
	backgroundElements[currentBackgroundIndex].classList.add("active");

	if (Array.isArray(colorOptions.color)) {
		var hexColors = colorOptions.color.join(",");
		backgroundElements[currentBackgroundIndex].style.background = "linear-gradient(" + hexColors + ")";
	} else {
		backgroundElements[currentBackgroundIndex].style.background = colorOptions.color;
	}

	colorElement.innerText = colorKey.replace(/^_gradient\-/, "");
	colorElement.style.color = colorOptions.fontColor;
	scoreElement.style.color = colorOptions.fontColor;
}

function destroyColor(color, emote) {
	this.colors.remove(color, true, true);
}

function getSpawnPoint(heightInRows) {
	var yRows = SPAWN_ROWS - heightInRows + 1; // + 1 includes the bottom row

	return {
		x: this.cameras.main.width,
		y: (Math.floor(Math.random() * yRows) * this.spriteHeightScaled) + (this.spriteHeightScaled / 2)
	};
}

function increaseScrollVelocity() {
	this.scrollSpeedIncrease += SCROLL_VELOCITY_INCREMENT;

	if (this.scrollSpeedIncrease > SCROLL_VELOCITY_INCREMENT_MAX) {
		this.scrollSpeedIncrease = SCROLL_VELOCITY_INCREMENT_MAX;
	}

	this.emotes.children.each(function (emote) {
		emote.setVelocityX(this.scrollVelocityScaled - this.scrollSpeedIncrease);
	}.bind(this));

	this.colors.children.each(function (color) {
		color.body.velocity.x = this.scrollVelocityScaled - this.scrollSpeedIncrease;
	}.bind(this));
}

function addColor() {
	var spawnPoint = getSpawnPoint.apply(this, [1]);
	var color;
	var shouldAddSolidColor = !!Math.floor(Math.random() * 4);

	if (shouldAddSolidColor) {
		var colorKey = Assets.getRandomColorKey();
		color = this.add.graphics({fillStyle: {color: Assets.colorMap[colorKey].value}, x: spawnPoint.x, y: spawnPoint.y}).setDepth(1);
		color.fillRect(0, 0, COLOR_WIDTH, COLOR_HEIGHT);
		this.physics.add.existing(color);
		color.body.setSize(COLOR_WIDTH, COLOR_HEIGHT);
		color.colorKey = colorKey;
		color.points = COLOR_POINTS;
	} else {
		var gradientKey = Assets.getRandomGradientKey();
		color = this.physics.add.image(spawnPoint.x, spawnPoint.y, gradientKey).setDepth(1);
		color.colorKey = gradientKey;
		color.points = GRADIENT_POINTS;
	}

	color.body.velocity.x = this.scrollVelocityScaled - this.scrollSpeedIncrease;
	color.body.allowGravity = false;
	this.colors.add(color);
}

function addEmotes() {
	var shape = Assets.getRandomShape();
	var emoteName = Assets.getRandomEmoteKey(this.score > this.highscore);
	var spawnPoint = getSpawnPoint.apply(this, [shape[1]]);

	for (var x = 0; x < shape[0]; x++) {
		for (var y = 0; y < shape[1]; y++) {
			addEmote.apply(this, [emoteName, spawnPoint.x + (x * this.spriteWidthScaled), spawnPoint.y + (y * this.spriteHeightScaled)]);
		}
	}

	this.emoteSpawnTimer = this.time.addEvent({
		delay: EMOTE_SPAWN_TIMER - (this.scrollSpeedIncrease * 2),
		callback: addEmotes.bind(this)
	});
}

function addEmote(emoteName, x, y) {
	var emote = this.physics.add.image(x, y, emoteName)
		.setScale(this.spriteScale)
		.setDepth(1)
		.setVelocityX(this.scrollVelocityScaled - this.scrollSpeedIncrease)
		.setSize(SPRITE_WIDTH - SPRITE_HIT_OFFSET, SPRITE_HEIGHT - SPRITE_HIT_OFFSET)
		.setOffset(SPRITE_HIT_OFFSET / 2, SPRITE_HIT_OFFSET / 2);

	emote.emoteName = emoteName;

	this.emotes.add(emote);
	emote.body.allowGravity = false;
}

function getResults() {
	var colorEntry = Assets.colorMap[this.currentColorKey];
	var colorValue;
	var fontColor;

	if (colorEntry) {
		fontColor = colorEntry.fontColor;
		colorValue = colorEntry.color;
	}

	return {
		score: this.score,
		highscore: this.highscore,
		emote: this.lastHitEmoteKey,
		color: {
			name: this.currentColorKey,
			fontColor: fontColor,
			value: colorValue
		}
	};
}
}());
