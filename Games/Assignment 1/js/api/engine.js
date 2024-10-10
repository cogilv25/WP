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

function setEngineRenderMode(renderMode)
{
	if(_engineRenderModes[renderMode] == null)
		console.error("Invalid render mode specified! Reverting change!");
	else
		_engineRender = _engineRenderModes[renderMode];
}

function setB2DContactListener(listener)
{
	_engineB2DWorld.SetContactListener(listener);
}

function startGame()
{
	_engineStart();
}

function getDefaultEntityProperties(createB2D = true, createEasel = true)
{
	let props = { 
		x: 0, y: 0, width: 10, height: 10, radius: 10,
		rotation: 0, shape: "circle", type: "dynamic",
		"createB2D": createB2D, "createEasel": createEasel
	};


	if(createB2D)
	{
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
	}

	if(createEasel)
	{
		//TODO
	}
	return props;
}

function createEntityProperties(sparseProperties, createB2D = true, createEasel = true)
{
	let props = getDefaultEntityProperties(createB2D, createEasel);

	if(sparseProperties != null)
		for(let key of Object.keys(sparseProperties))
			props[key] = sparseProperties[key];

	return props;
}

// Properties must contain all required properties, use createEntityProperties
// where using sparse properties
function createEntity(properties = null)
{
	if(properties == null)
		properties = getDefaultEntityProperties();
	let entity = {};
	if(properties.createB2D)
		entity.b2d = _createB2DEntity(properties);
	if(properties.createEasel)
		entity.easel = _createEaselEntity(properties);

	return entity;
}

function deleteEntity(entity)
{
	_engineDeleteEntities.push(entity);
}

function defineNewStatic(density, friction, restitution, x, y, width, height, angle, objid) {
    let fixDef = new b2FixtureDef;
    fixDef.density = density;
    fixDef.friction = friction;
    fixDef.restitution = restitution;
    let bodyDef = new b2BodyDef;
    bodyDef.type = b2Body.b2_staticBody;
    bodyDef.position.x = x / SCALE;
    bodyDef.position.y = y / SCALE;
    bodyDef.angle = angle;
    fixDef.shape = new b2PolygonShape;
    fixDef.shape.SetAsBox(width/SCALE, height/SCALE);
    let thisobj = _engineB2DWorld.CreateBody(bodyDef).CreateFixture(fixDef);
    thisobj.GetBody().SetUserData({id:objid})
    return thisobj;
}

function defineNewDynamic(density, friction, restitution, x, y, width, height, objid) {
    let fixDef = new b2FixtureDef;
    fixDef.density = density;
    fixDef.friction = friction;
    fixDef.restitution = restitution;
    let bodyDef = new b2BodyDef;
    bodyDef.type = b2Body.b2_dynamicBody;
    bodyDef.position.x = x / SCALE;
    bodyDef.position.y = y / SCALE;
    fixDef.shape = new b2PolygonShape;
    fixDef.shape.SetAsBox(width/SCALE, height/SCALE);
    let thisobj = _engineB2DWorld.CreateBody(bodyDef).CreateFixture(fixDef);
    thisobj.GetBody().SetUserData({id:objid})
    return thisobj;
}

function defineNewDynamicCircle(density, friction, restitution, x, y, r, objid) {
    let fixDef = new b2FixtureDef;
    fixDef.density = density;
    fixDef.friction = friction;
    fixDef.restitution = restitution;
    let bodyDef = new b2BodyDef;
    bodyDef.type = b2Body.b2_dynamicBody;
    bodyDef.position.x = x / SCALE;
    bodyDef.position.y = y / SCALE;
    fixDef.shape = new b2CircleShape(r/SCALE);
    let thisobj = _engineB2DWorld.CreateBody(bodyDef).CreateFixture(fixDef);
    thisobj.GetBody().SetUserData({id:objid})
    return thisobj;
}  

// Internal variables, defines, etc, not intended to be used
// externally but may be warranted where certain behaviours are
// desired. You have been warned!

var _engineContext = ctx;;
var _engineRunning = true;
var _engineRenderModes = 
{ 
	"easel": _engineRenderEasel,
	"debug": _engineRenderDebug,
	"none": _engineRenderNone
};

// B2D
var _engineB2DWorld;
var _engineB2DDebugDraw;
var _engineB2DEntities = [];
var _engineDeleteEntities = [];


// Internal functions, not intended to be called externally but may
// be warranted where certain behaviours are desired. All functions
// are anonymous to allow overwriting but again care should be taken
// if doing so.
// You have been warned! Again!!!

var _engineRender = (context) => 
{
	//Draw no renderer selected to screen.
};

var _engineInit = () =>
{
	_engineInitB2D(_engineContext);
	_engineInitEasel();
}

var _engineUpdate = () =>
{

    for(i in _engineDeleteEntities)
    {
		_engineB2DWorld.DestroyBody(_engineDeleteEntities[i].b2d.GetBody());
    }

    _engineRender(_engineContext);
    update();

    _engineB2DWorld.Step(
    1/60, // framerate
    10, // velocity iterations
    10 // position iterations
    );
    window.requestAnimationFrame(_engineUpdate);
}

var _engineStart = () =>
{
	_engineInit();
	initialize();
	window.requestAnimationFrame(_engineUpdate);
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

function _engineInitEasel()
{

}

function _engineRenderEasel(context)
{
	// Update easel transforms
	// Draw Easel scene
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
	//TODO
}


/** TODO:
 * ------------------------------------------------------------------------------------
 * 
 * - Support 2 contexts one easel one b2d.
 *     - Support an arbitrary number of contexts.
 * 
 * 
*/