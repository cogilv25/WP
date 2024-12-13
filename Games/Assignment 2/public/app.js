var worldSettings;
var INPUT;
var entityTypes;
// I can't include the generators in the entityTypes
//   as they contain image elements, so the easy
//   solution is to put them in a seperate array.
var spriteSheetGenerators = [];
var soundMap;
var assets = [];
let camera;
let background;
// Stores an entity for each hunger stage, for each player.
//    these are not copies but references, which is why we
//    need a set per player.
let possiblePlayerEntities = [[],[]];
let inputMap;
let socket = io();
socket.on("connect", () => {
	console.log(socket.id);
});


// Ahh yes, event-driven programming... At least I'm getting
//    better at keeping these event driven monstrosities from
//    spiraling into chaos, or at least I'd like to think so!
var clientReady = false;
async function initializeApplication()
{
	// We are counting the files loaded so we know when
	//    everything is loaded..
	var dataFilesLoaded = 0;

	// Load a data file optionally running it through a
	//    parse function before returning.
	async function loadDataFile(path, parseFunction = false)
	{
		let data = await (await fetch(path)).json();
		++dataFilesLoaded;

		if(parseFunction === false)
			return data;
		else
			return parseFunction(data);
	}

	// Expand the sparse properties into full properties
	//    for each entity. This does involve storing data
	//    we don't need for each entity but it's not much.
	function parseEntityTypes(entities)
	{
		let fullEntityTypes = [];
		for([k,v] of Object.entries(entities))
		{
			fullEntityTypes[k] = structuredClone(entities.default);
			for([k2,v2] of Object.entries(v))
			{
				fullEntityTypes[k][k2] = v2;
			}
		}
		return fullEntityTypes;
	}

	// Initializes input mechanisms.
	function parseInputData(data)
	{
		let keyMap = [];
		for([k,v] of Object.entries(data))
			keyMap.push(v);

		initializeKeyboard(keyMap, false);
		registerUniversalKeyboardCallback("edge", (input, state) =>
		{
			if(input == 8)
				camera.target = (camera.target + 1) % 2;
			if(gameStarted)
				socket.emit("input", String.fromCharCode(parseInt(input) + (state ? 128 : 0)));
		});
		return data;
	}


	let assetLoadFailed = false;
	let assetLoadQueue = new createjs.LoadQueue(true);
    assetLoadQueue.installPlugin(createjs.Sound);
    assetLoadQueue.addEventListener("error", (e) =>
	    {
	    	assetLoadFailed = true;
	    }
    );
    assetLoadQueue.addEventListener("complete",(e) =>
        {
        	++dataFilesLoaded;
        	let items = assetLoadQueue.getItems(true);
        	for(let i = 0; i < items.length; ++i)
        	{
        		// Sounds are internally processed by preloadjs
        		if(items[i].item.type != "sound")
		            assets[items[i].item.id] = items[i].result;
        	}
        }
    );

    // TODO: These awaits can throw exceptions.. 
    //    they shouldn't but still.
    assetLoadQueue.loadManifest("assets/manifest.json");
	worldSettings = await loadDataFile("./data/world.json");
	INPUT = await loadDataFile("./data/input.json", parseInputData);
	entityTypes = await loadDataFile("./data/entities.json", parseEntityTypes);
	soundMap = await loadDataFile("./data/sound_map.json");
	let clientData = await loadDataFile("./data/client.json");

	// There's probably a better way but we are basically waiting for
	//    the assetLoadQueue to finish using this promise.
	let success = await new Promise((resolve, reject) => 
		{
			let checkFinished = () => 
			{
				if(dataFilesLoaded == 6)
					return resolve(true);
				else if(assetLoadFailed)
					return resolve(false);
				else
					setTimeout(checkFinished, 100);
			};

			checkFinished();
		}
	);


	if(!success)
	{
		console.error("Fatal: Game client failed to load and parse data files!");
		return;
	}

	// Combine client entities into entityTypes
	for([k,v] of Object.entries(clientData.entities))
	{
		if(k == "default") continue;
		let fullClientEntity = {...structuredClone(clientData.entities['default']), ...clientData.entities[k]};
		for([k2,v2] of Object.entries(fullClientEntity))
			entityTypes[k][k2] = v2;

		// Sprites contain a "generator" which contains information about how
		//    to create the sprite sheet. This gets directly passed to easel,
		//    however, it contains named references of the images it needs
		//    which are loaded by preload so we need to swap these out for
		//    the actual images which easel expects.
		// Unfortunately we can't run structuredClone on the actual images,
		//    this breaks entityTypes so we created a seperate array for the
		//    initialized generators.
		if(entityTypes[k].graphics == "sprite")
		{
			spriteSheetGenerators[k] = structuredClone(entityTypes[k].generator);
			let gen = spriteSheetGenerators[k];
			for(let i = 0; i < gen.images.length; ++i)
			{
				gen.images[i] = assets[gen.images[i]];
			}
		}
	}

	// Combine client world settings into worldSettings.
	for([k,v] of Object.entries(clientData.world))
		worldSettings[k] = v;


	camera = {
		x: 0, y: worldSettings.height + worldSettings.offsetY,
		maxSpeed: 20,
		moveFactor: 0.05,
		minX: worldSettings.offsetX + 400,
		minY: worldSettings.offsetY + 300,
		maxX: worldSettings.width + worldSettings.offsetX - 400,
		maxY: worldSettings.height + worldSettings.offsetY - 300,
	}
	stage = new createjs.Stage(canvas);
	stage.snapPixelsEnabled = true;
}


function clamp(value, min, max)
{
	return value < min ? min : (value > max ? max : value);
}

let cachedAnimation = [0, 0];
function renderWorld()
{
	let xMove = (entities[camera.target][0] - camera.x) * camera.moveFactor;
	let yMove = (entities[camera.target][1] - camera.y) * camera.moveFactor;

	let tx = camera.x + clamp(xMove, -camera.maxSpeed, camera.maxSpeed);
	let ty = camera.y + clamp(yMove, -camera.maxSpeed, camera.maxSpeed);

	camera.x = clamp(tx, camera.minX, camera.maxX);
	camera.y = clamp(ty, camera.minY, camera.maxY);

	let worldTransformX = 400 - camera.x;
	let worldTransformY = 300 - camera.y;

	for(let i = 0; i < 2; ++i)
	{
		if(players[i].stage != cachedStage[i])
		{
			console.log("Current: " + players[i].stage + " Cached: " + cachedStage[i]);
			stage.removeChild(easelEntities[i])
			easelEntities[i] = possiblePlayerEntities[i][players[i].stage]
			stage.addChild(easelEntities[i]);
		}
		if(players[i].animation != cachedAnimation[i])
		{
			if(players[i].animation == 0)
			{
				easelEntities[i].regY = 0;
				easelEntities[i].gotoAndPlay("idle");
			}
			else if(players[i].animation == 4)
			{
				easelEntities[i].regY = -7;
				easelEntities[i].gotoAndPlay("balloon");
			}
		}
		if((easelEntities[i].scaleX > 0 && players[i].direction < 0) || 
			(easelEntities[i].scaleX < 0 && players[i].direction > 0))
		{
			easelEntities[i].scaleX *= -1;
		}
	}

	for(let i = 0; i < entities.length; ++i)
	{
		easelEntities[i].x = entities[i][0] + worldTransformX;
		easelEntities[i].y = entities[i][1] + worldTransformY;
	}

	background.x = worldTransformX;
	background.y = worldTransformY;

	stage.update();
}

let hBar = document.getElementById("h_bar_bar");
const hBarColors = ["#e52","#e52","#e92","#da2"];

// TODO: if we relog these may not be correct for a frame..
//    not sure I can 
let cachedHunger = [120, 120], cachedStage = [3, 3];
function renderHungerBar(hunger)
{
	let diff = hunger - cachedHunger[playerId];
	if(diff < 1 && diff > -1)
		return;

	let ratio = clamp(hunger / 120, 0, 1);

	hBar.style.width = (ratio * 100) + "%";

	let stage = Math.floor((hunger + 39) / 40);

	if(stage != cachedStage[playerId])
		hBar.style.backgroundColor = hBarColors[stage];
}

let stage;
let entities = [];
let easelEntities = [];
let playerId = 0;
let players = [{hunger: 120, stage: 3, direction: 1, animation: 0}, {hunger: 120, stage: 3, direction: 1, animation: 0}];

let gameStarted = false;
let lobbies = [];

let lc = document.getElementById("lobby_creator");
let ln = document.getElementById("lobby_name");
let lv = document.getElementById("lobby_view");
let createLobbyButton = document.getElementById("create_lobby");
let mainMenu = document.getElementById("main_menu");
let gameView = document.getElementById("game_view");
let canvas = document.getElementById("canvas");
let loginButton = document.getElementById("login_button");
let registerButton = document.getElementById("register_button");
let authView = document.getElementById("auth_view");
let authForm = document.getElementById("auth_form");
let authButton = document.getElementById("auth_button");
let username = document.getElementById("username");
let password = document.getElementById("password");

let lastTick = performance.now();

let loginFormEvent = "login";


loginButton.addEventListener("click", () =>
	{
		loginButton.classList.add("auth_selected");
		loginButton.classList.remove("auth_unselected");
		registerButton.classList.add("auth_unselected");
		registerButton.classList.remove("auth_selected");
		loginFormEvent = "login";
		authButton.textContent = "Login";
	});

registerButton.addEventListener("click", () =>
	{
		registerButton.classList.add("auth_selected");
		registerButton.classList.remove("auth_unselected");
		loginButton.classList.add("auth_unselected");
		loginButton.classList.remove("auth_selected");
		loginFormEvent = "register";
		authButton.textContent = "Register";
	});

authForm.addEventListener("animationend", () =>
	{
		authForm.classList.remove("invalid_login");
	});

username.addEventListener("keypress", () =>
	{
		if(username.value.length == username.maxLength)
		{
			authForm.classList.add("invalid_login");
		}
	});

password.addEventListener("keypress", () =>
	{
		if(password.value.length == password.maxLength)
		{
			authForm.classList.add("invalid_login");
		}
	});

authForm.addEventListener("submit", (e) =>
	{
		e.preventDefault();
		if(username.value.length < 5 || password.value.length < 5)
		{
			// TODO: notification
			authForm.classList.add("invalid_login");
			return;
		}
		socket.emit(loginFormEvent, 
			{
				username: username.value,
				password: password.value
			});
	});

let lobbyList = document.getElementById("lobbies");
ln.addEventListener("keypress", () =>
	{
		if(ln.value.length == ln.maxLength)
		{
			lc.classList.add("invalid_lobby");
		}
	});
lc.addEventListener("animationend", () => 
	{
		lc.classList.remove("invalid_lobby"); 
	});

lc.addEventListener("submit", (e) => 
	{
		e.preventDefault();
		if(ln.value.length < 5)
		{
			lc.classList.add("invalid_lobby");
			return;
		}

		socket.emit("create_lobby", ln.value);
		ln.value = "";
	});

function renderLobbies()
{
	lobbyList.textContent = "";
	for(let i = 0; i < lobbies.length; ++i)
	{
		let l = document.createElement("div");
		l.classList.add("lobby");
		l.textContent = lobbies[i].name;
		let s = document.createElement("span");
		s.textContent = "(" + lobbies[i].players.length + " / 2)";
		l.appendChild(s);
		l.addEventListener("click", () => 
			{
				joinLobby(i);
			});
		lobbyList.appendChild(l);
	}
}

function createEntity(props, addToStage = true)
{
	let g, entity;

	if(props.graphics == "image")
	{
		entity = new createjs.Bitmap(assets[props.image_id]);
		if(props.shape == 1)
		{
			let oScale = (props.radius * 2) / entity.image.naturalHeight;
			entity.scaleY = oScale * props.scaleX;
			entity.scaleX = oScale * props.scaleY;
		}
		else
		{
			entity.scaleY = (props.height / entity.image.naturalHeight) * props.scaleY;
			entity.scaleX = (props.width / entity.image.naturalWidth) * props.scaleX;
		}

		entity.regX = entity.image.width / 2;
		entity.regY = entity.image.height / 2;;
	}
	else if(props.graphics == "sprite")
	{
		console.log(props);
		// Perhaps this should be done at initialization..?
		//    probably won't matter for us since it's mostly
		//    just our characters that have sprites atm...
		g = new createjs.SpriteSheet(spriteSheetGenerators[props.type]);
		entity = new createjs.Sprite(g, props.default_animation);
		entity.scaleX = (props.width / props.generator.frames.width) * props.scaleX;
		entity.scaleY = (props.height / props.generator.frames.height) * props.scaleY;
	}
	else if(props.graphics == "tiles")
	{
		entity = new createjs.Shape();
		entity.graphics.beginBitmapFill(assets[props.tile]).drawRect(0, 0, props.width, props.height);

		entity.tileW = assets[props.tile].naturalWidth;
		entity.tileH = assets[props.tile].naturalHeight;
		entity.regX = props.width / 2;
		entity.regY = props.height / 2;
	}
	else
	{
		// This draws blue squares and red circles, it was
		//    good for debugging so I thought I'd leave it.
		g = new createjs.Graphics()
		g.setStrokeStyle(1);
		g.beginStroke(createjs.Graphics.getRGB(0,0,0));
		let rx = 0, ry = 0;

		if(props.shape == 1)
		{
			g.beginFill(createjs.Graphics.getRGB(255,0,0));
			g.drawCircle(0, 0, props.radius);
		}
		else
		{
			g.beginFill(createjs.Graphics.getRGB(0,0,255));
			g.rect(0, 0, props.width, props.height);
			rx = props.width / 2;
			ry = props.height / 2;
		}

		entity = new createjs.Shape(g);
		entity.regX = rx;
		entity.regY = ry;
	}

	entity.x = props.x;
	entity.y = props.y;
	entity.rotation = props.rotation;

	if(addToStage)
	{
		stage.addChild(entity);
		stage.update();
	}
	return entity;
}

function initializeWorld(state, pId)
{

	background = new createjs.Shape();
	background.graphics.beginBitmapFill(assets[worldSettings.background_tile]).drawRect
		(worldSettings.offsetX, worldSettings.offsetY, worldSettings.width, worldSettings.height);
	background.tileW = assets[worldSettings.background_tile].naturalWidth;
	background.tileH = assets[worldSettings.background_tile].naturalHeight;
	background.regX = 0;
	background.regY = 0;

	stage.addChild(background);

	console.log(state);
	let playerDetails = [];
	for(let i = 0; i < state.length; ++i)
	{
		let template = state[i];
		if(template.type == "player")
		{
			// We will initialize the players last so they draw on top!
			//    we also need to initialize all potential characters
			playerDetails.push([i, template.x, template.y])
			// We need to keep the indices correct...
			easelEntities.push(0);
			entities.push([template.x, template.y]);
			continue;
		}
		// Certain entities will have no client side presence, for example door_stopper
		//    which is an invisible entity used in the propogation of heavy door events.
		if(entityTypes[template.type] == null)
		{
			// We need to keep the indices correct...
			easelEntities.push(0);
			entities.push(0);
			continue;
		}
		let props = structuredClone(entityTypes[template.type]);
		for([k, v] of Object.entries(template))
		{
			props[k] = v;
		}
		if(entityTypes[template.type].shape == 1)
			console.log(props);
		easelEntities.push(createEntity(props));
		entities.push([props.x, props.y]);
	}
	console.log(entityTypes);

	let playerStages = ['player_s', 'player_m', 'player_l'];
	for(let i = 0; i < 2; ++i)
	{
		possiblePlayerEntities[i][0] = 0;
		for(let j = 0; j < 3; ++j)
		{
			let props = structuredClone(entityTypes[playerStages[j]]);
			props.x = -256;
			props.y = -256;
			props.type = playerStages[j];
			possiblePlayerEntities[i][j + 1] = createEntity(props, false);
		}
		possiblePlayerEntities[i][0] = possiblePlayerEntities[i][1];
		possiblePlayerEntities[i][3].x = playerDetails[i][1];
		possiblePlayerEntities[i][3].y = playerDetails[i][2];
		easelEntities[playerDetails[i][0]] = possiblePlayerEntities[i][3];
		stage.addChild(easelEntities[i]);
	}


	playerId = pId;
	camera.target = pId;
	camera.x = entities[pId][0] - 400;
	camera.y = entities[pId][1] - 300;


	stage.update();
}

function joinLobby(index)
{
	socket.emit("join_lobby", lobbies[index].name);
}


socket.on("joined_world", (state, pId) =>
	{
		initializeWorld(state, pId);
		mainMenu.style.display = "none";
		gameView.style.display = "flex";
		gameStarted = true;
		disableDefaultKeyboard = true;
	});

socket.on("logged_in", (remoteLobbies) =>
	{
		console.log("Logged In!");
		lv.style.display = "flex";
		authView.style.display = "none";
		lobbies = remoteLobbies;
		ln.focus();
		renderLobbies();
	});

socket.on("invalid_login", (error) =>
	{
		// TODO: notifications top-right
		console.error(error);
	});

socket.on("lobby_dissolve", (lobby) => 
	{
		lobbies.splice(lobbies.findIndex(
			(a) => { return a.name === lobby.name; })
		, 1);
		renderLobbies();
	});

socket.on("lobby_update", (lobby) =>
	{
		lobbies[lobbies.findIndex(
			(a) => { return a.name === lobby.name; }
		)] = lobby;
		renderLobbies();
	});

var lastMessage;
socket.on("u", (update) =>
{
	if(!gameStarted) return;
	//console.log(update);
	// let delta = performance.now() - lastTick;
	// console.log(1000 / delta);
	// lastTick = performance.now();

	let buffer = new Uint16Array(update);
	let bufferu8 = new Uint8Array(update);

	// Get player details.
	for(let i = 0; i < 2; ++i)
	{
		players[i].hunger = bufferu8[i*2] >> 1;
		players[i].direction = ((bufferu8[i*2] & 1) + 2) % 3 - 1;
		players[i].animation = bufferu8[i*2+1];
		players[i].stage = Math.floor((players[i].hunger + 39) / 40);
	}

	console.log("Direction: " + players[0].direction);


	let off = 3;
	let stateShorts = bufferu8[2 * off];
	let soundEventCount = bufferu8[1 + 2 * off++];
	for(let i = off; off < i + stateShorts; ++off)
	{
		let entityState = buffer[off] >> 12;
		let id = buffer[off] & 4095;
		entities[id][2] = entityState;
	}

	for(let i = off * 2; i < off * 2 + soundEventCount; ++i)
		createjs.Sound.play(soundMap[bufferu8[i]]);

	off += Math.floor((soundEventCount + 1) / 2);

	for(let i = 0; i < (buffer.length - off) / 4; ++i)
	{
		let entityState = buffer[off + i * 4] >> 12;
		let id = buffer[off + i * 4] & 4095;
		entities[id][0] = buffer[off + i * 4 + 1];
		entities[id][1] = buffer[off + i * 4 + 2];
		entities[id][2] = entityState;
		easelEntities[id].rotation = buffer[off + i * 4 + 3] / (65536 / 360);
	}

	renderHungerBar(players[playerId].hunger);
	renderWorld();
	for(let i = 0; i < 2; ++i)
	{	
		cachedHunger[i] = players[i].hunger;
		cachedStage[i] = players[i].stage;
		cachedAnimation[i] = players[i].animation;
	}

	lastMessage = buffer;
});

// TODO: What is this?
//    It's an event for when a user joins your lobby,
//    only matters when you're in a lobby waiting for
//    a world
socket.on("player_joined", (player) =>
	{
		
	});

socket.on("invalid_lobby", (message) =>
	{
		lc.classList.add("invalid_lobby");
		console.log(message);
	});

socket.on("lobby_created", (lobby) =>
	{
		lobbies.push(lobby);
		renderLobbies();
	});


socket.on("lobby_list", (newLobbies) =>
	{
		lobbies = newLobbies;
		renderLobbies();
	});

initializeApplication();