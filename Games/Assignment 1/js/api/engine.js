/** A simple game "engine" or framework
 *  ---------------------------------------------------------------
 *  Mostly ties together Box2D and EaselJS to present a unified API
 *  to the game specific code. Keeping things as simple as possible
 *  where we can!
**/ 
"use strict"

// The following functions are intended to be replaced by the game
// module and are then called back by the engine.

// This function is called by the engine every frame.
var update = () =>
{

};

// This function is called by the engine after it has initialized
// but before the main game loop starts.
var initialize = () =>
{

};

// Functions for game specific code to call into. this is the main
// API that game-specific code should be calling into.
// TODO: doesn't do anything..?
// TODO: Refactor renderer, modes, and targets system
function setEngineRenderModes(renderModes)
{
	if(!Array.isArray(renderModes))
	{
		renderModes = [renderModes];
	}
	else
	{
		for(let i in renderModes)
		{
			if(i >= _engineRenderers.length)
			{
				console.error("Too many render modes submitted! Extra modes ignored");
				return;
			}
			if(_engineRenderModes[renderModes[i]] == null) 
				console.error("Invalid render mode specified! Submitted mode: " + renderModes[i]);
			else
				_engineRenderers[i] = _engineRenderModes[renderModes[i]];
		}
	}
}

function setEngineRenderTargets(renderTargets)
{
	//TODO
}

function setB2DContactListener(listener)
{
	_engineB2DWorld.SetContactListener(listener);
}

function startGame()
{
	_engineInit();
}

function deleteAllEntities()
{
	_engineDeleteEntities = [];
	for(i in _engineEntities)
    {
    	let e = _engineEntities[i];
    	if(e.b2d != null)
			_engineB2DWorld.DestroyBody(e.b2d.GetBody());
		if(e.easel != null)
			_engineEaselStage.removeChild(e.easel);
	}

	// TODO:
	// I marginally prefer the idea of managed contact
	// listeners and freezing those...
	
	_enginePreventEntityActions = true;
	_engineB2DWorld.Step(
    1/60, // framerate
    10, // velocity iterations
    10 // position iterations
    );
    _enginePreventEntityActions = false;
}

// onLoadedFunction receives false on failure or
// the generated Object on success
function loadJson(path, onLoadedFunction)
{
	//preload Shtuffssh
}

function getDefaultEntityProperties()
{
	let props = { 
		x: 0, y: 0, width: 10, height: 10, radius: 10,
		rotation: 0, shape: "circle", type: "dynamic",
		"createB2D": true, "createEasel": false
	};
	props.density = 0.5;
	props.friction = 0.5;
	props.restitution = 0.5;
	props.linearDamping = 0;
	props.sensor = false;
	props.sleepingAllowed = true;
	props.fixedRotation = false;
	props.userData = {};
	props.categories = 1;
	props.mask = 65535;
	props.group = 0;
	props.easelType = "bitmap";
	props.scaleX = 1;
	props.scaleY = 1;
	props.linkB2DToEasel = false;

	return props;
}

function createEntityProperties(sparseProperties)
{
	let props = getDefaultEntityProperties();

	if(sparseProperties != null)
	{
		for(let key of Object.keys(sparseProperties))
			props[key] = sparseProperties[key];
		if(sparseProperties.type == "static")
		{
			if(sparseProperties.linkB2DToEasel == null)
			{
				props.linkB2DToEasel = false;
			}
		}
	}

	return props;
}

// Properties must contain all required properties, use createEntityProperties
// where using sparse properties
function createEntity(properties = null)
{
	if(_enginePreventEntityActions)
		return null;

	if(properties == null)
		properties = getDefaultEntityProperties();
	let entity = {};
	if(properties.createB2D)
		entity.b2d = _createB2DEntity(properties);
	if(properties.createEasel)
		entity.easel = _createEaselEntity(properties);

	if(properties.linkB2DToEasel)
		entity.linked = true;

	_engineEntities.push(entity);
	entity.engineID = _engineEntities.length - 1;

	return entity;
}

function deleteEntity(entity)
{
	if(!_enginePreventEntityActions)
		_engineDeleteEntities.push(entity);
}

// Internal variables, defines, etc, not intended to be used
// externally but may be warranted where certain behaviours are
// desired. You have been warned!

var _engineContexts = [ctx, ctx2];
var _engineRunning = true;
var _engineRenderModes = 
{ 
	"easel": _engineRenderEasel,
	"debug": _engineRenderDebug,
	"none": _engineRenderNone
};

var _enginePreventEntityActions = false;
var _engineEntities = [];

// B2D
var _engineB2DWorld;
var _engineB2DDebugDraw;
var _engineB2DEntities = [];
var _engineDeleteEntities = [];

// Easel
var _engineEaselStage;
var _engineStageWidth, _engineStageHeight;
var _engineLoader;

// Internal functions, not intended to be called externally but may
// be warranted where certain behaviours are desired. All functions
// are anonymous to allow overwriting but again care should be taken
// if doing so.
// You have been warned! Again!!!

var _engineRenderers = [ _engineRenderDebug, _engineRenderEasel ];

var _engineInit = () =>
{
	_engineInitEasel();
	_engineInitB2D(_engineContexts[0]);
}

var _engineUpdate = () =>
{
	//TODO: Some entities will be b2d or easel only
	// - Sensors == b2d only
	// - backgrounds == easel only
    for(i in _engineDeleteEntities)
    {
    	let e = _engineDeleteEntities[i];
    	if(e.b2d != null)
			_engineB2DWorld.DestroyBody(e.b2d.GetBody());
		if(e.easel != null)
			_engineEaselStage.removeChild(e.easel);

		let j = e.engineID;
		_engineEntities.splice(e.engineID, 1);
		for(;j < _engineEntities.length; ++j)
		{
			--_engineEntities[j].engineID;
		}
    }
    _engineDeleteEntities = [];


    update();
    _engineB2DWorld.Step(
    1/60, // framerate
    10, // velocity iterations
    10 // position iterations
    );

    _engineUpdateLinkedEntities();

    for(let i in _engineRenderers)
    {
    	_engineRenderers[i](_engineContexts[i]);
    }


    //window.requestAnimationFrame(_engineUpdate);
}

var _engineStart = () =>
{
	initialize();
	//window.requestAnimationFrame(_engineUpdate);
	createjs.Ticker.framerate = 60;
	createjs.Ticker.timingMode = createjs.Ticker.RAF;
	createjs.Ticker.addEventListener("tick", _engineUpdate);
}

// Static functions, these get assigned to an internal function to allow
// different behaviours to be toggled by switching what function is used.
// Additionally it is possible for the game to create it's own functions
// and replace these entirely.

function _engineInitB2D(context = null)
{
	_engineB2DWorld = new b2World(
		new b2Vec2(0,GRAVITY),
		true
	);

	if(context != null)
	{
		//TODO: Debug Settings
		_engineB2DDebugDraw = new b2DebugDraw();
		_engineB2DDebugDraw.SetSprite(context);
		_engineB2DDebugDraw.SetDrawScale(SCALE);
		_engineB2DDebugDraw.SetFillAlpha(0.3);
		_engineB2DDebugDraw.SetLineThickness(1.0);
		_engineB2DDebugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
		_engineB2DWorld.SetDebugDraw(_engineB2DDebugDraw);
	}
}

function _engineProcessAssets()
{
	//TODO: process loaded assets
	//TODO: check main application is ready

	//Loop through props and process each entity type
	//props.ldrimg = loader.getResult(props.id)
	let props = {
		userData: {id: "background"},
		x: 400, y: 300,
		shape: "rect",
		width: 400, height: 300,
		scaleX: 1,
		scaleY: 1,
		easelType: "bitmap"
	};
	_createEaselEntity(props);
	_engineStart();
}

function _engineInitEasel()
{
	_engineEaselStage = new createjs.Stage(canvas2);
	_engineEaselStage.snapPixelsEnabled = true;
	_engineStageWidth = _engineEaselStage.canvas.width;
	_engineStageHeight = _engineEaselStage.canvas.height;


	_engineLoader = new createjs.LoadQueue();
	_engineLoader.addEventListener("complete", _engineProcessAssets);
	_engineLoader.loadManifest("data/assets.json");
}

function _engineUpdateLinkedEntities()
{
	for(let i in _engineEntities)
	{
		let e = _engineEntities[i];

		if(!e.linked) continue;

		let pos = e.b2d.GetBody().GetPosition();
		let rot = e.b2d.GetBody().GetAngle() * 180 / Math.PI;
		e.easel.x = pos.x * SCALE;
		e.easel.y = pos.y * SCALE;
		e.easel.rotation = rot;
	}
}

function _engineRenderEasel(context)
{
	// Update easel transforms
	// Draw Easel scene
    //_engineEaselStage.update();
    _engineEaselStage.update();
}

function _engineRenderDebug(context)
{
	_engineB2DWorld.DrawDebugData();
}

function _engineRenderNone(context)
{
	context.clearRect(0, 0, WIDTH, HEIGHT);
}

function _createB2DEntity(props)
{
    let fixDef = new b2FixtureDef;
    fixDef.density = props.density;
    fixDef.friction = props.friction;
    fixDef.restitution = props.restitution;
    let bodyDef = new b2BodyDef;
    bodyDef.type = props.type == "dynamic" ? b2Body.b2_dynamicBody : b2Body.b2_staticBody;
    bodyDef.position.x = props.x / SCALE;
    bodyDef.position.y = props.y / SCALE;
    bodyDef.angle = (props.rotation / 180) * Math.PI;
    switch(props.shape)
    {
    	case "circle":
    		fixDef.shape = new b2CircleShape(props.radius / SCALE);
    		break;
    	case "rect":
		    fixDef.shape = new b2PolygonShape;
		    fixDef.shape.SetAsBox(props.width / SCALE, props.height / SCALE);
    		break;
    }
    let entity = _engineB2DWorld.CreateBody(bodyDef).CreateFixture(fixDef);

	entity.SetSensor(props.sensor);
    entity.GetBody().SetUserData(props.userData);
	entity.GetBody().SetSleepingAllowed(props.sleepingAllowed);
	entity.GetBody().SetFixedRotation(props.fixedRotation);
	entity.GetBody().SetLinearDamping(props.linearDamping);
	let filter = entity.GetBody().GetFixtureList().GetFilterData();
	filter.categoryBits = props.categories;
	filter.maskBits = props.mask;
	filter.groupIndex = props.group;
	entity.GetBody().GetFixtureList().SetFilterData(filter);
    return entity;
}

function _createEaselEntity(props)
{
	//TODO: populate props @ load time
	//TODO: Sprite Sheets
	//TODO: Seperate initialization of easel objects from linking to entities <- Can't
	if(props.easelType == "bitmap")
	{
		let image = new createjs.Bitmap(_engineLoader.getResult(props.userData.id));
		if(props.shape == "rect")
		{
			image.scaleY = ((props.height * 2) / image.image.naturalHeight) * props.scaleY;
			image.scaleX = ((props.width * 2) / image.image.naturalWidth) * props.scaleX;
		}
		else if(props.shape == "circle")
		{
			let oScale = (props.radius * 2) / image.image.naturalHeight;
			image.scaleY = oScale * props.scaleX;
			image.scaleX = oScale * props.scaleY;
		}
		image.regX = image.image.width/2;
		image.regY = image.image.height/2;
		image.x = props.x;
		image.y = props.y;
		image.rotation = props.rotation;
		_engineEaselStage.addChild(image);
		return image;
	}
	else if(props.easelType == "spritesheet")
	{
		let meta = assetMetaData[props.userData.id];
		for(let i in meta.images)
		{
			meta.images[i] = _engineLoader.getResult(meta.images[i]);
		}
		console.log(meta);
		let spritesheet = new createjs.SpriteSheet(meta);
		let entity = new createjs.Sprite(spritesheet, "idle");
		entity.x = props.x;
		entity.y = props.y;
		entity.scaleX = props.scaleX;
		entity.scaleY = props.scaleY;

		_engineEaselStage.addChild(entity);
		return entity;
	}
	else if(props.easelType == "bitmapTile")
	{
		let rect = new createjs.Shape();
		rect.graphics.beginBitmapFill(
			_engineLoader.getResult(props.userData.id)
		).drawRect(props.x,props.y,props.width*2,props.height*2)
		//TODO: should be asset metadata
		rect.tileW = props.tileWidth;
		rect.tileH = props.tileHeight;
		rect.regX = props.width;
		rect.regY = props.height;
		rect.snapToPixel = true; // <- Required..?
		_engineEaselStage.addChild(rect);
		return rect;
	}
}


/** TODO:
 * ------------------------------------------------------------------------------------
 * 
 * - Support 2 contexts one easel one b2d. ✓
 *     - Support an arbitrary number of contexts. ~
 * 
 * 
*/