"use strict"
// Points == 200,400,800,1600 for balls as they get smaller
// Start with 3 lives if you die game resets to first level
// Timer starts at 1000 and counts down, presumably you lose if it hits 0
// Weapons == grapple, double grapple, machine gun
// Random animals, points for killing, 2-hits..?
// Ladders
// Breakable and non-breakable platforms
// Box2D is only taking a reference of your userdata.. so you can keep it and modify it
// outside of box2d and the box2d one gets updated.... I think...

var SCORE_BASE = 200;
var BALLOON_BASE_SIZE = 9;
var BALLOON_SIZES = 4;
GRAVITY = 18;
let loadedLevels = [];
let currentLevel = 0;
let levelNeedsInitialised = true;
let gameReady = false;

let entityTypes = [];
var assetMetaData = [];
let rawDat;
let levelLoadQueueStore, levelLoadQueueImmediate;

let testToggle = false;
let balloonsFrozen = false;

let score = 0, time = 1000;
let ground, roof, lWall, rWall, ladderProps;
let hero,platform,platform2, test;
let breakablePlatforms = [];

let playerDead = false, lives = 3;
let shielded = false;
let onLadder = 0, ladderForceApplied = false;
let waitingForGameData = true;
let playerScale, heroMovingLeft = false, heroMovingRight = false;

let itemProps, crabProps;
let item, crab;

let despawnGrappleFlag = false, grappleSpawning = false;
let grappleSections = [], grappleDeploying = false;
let grappleSpawnerProps, grappleSpawner = {deleted:true}, grappleSpawnFlag = false;
let reEnableGrappleDeploying = false;

let delayBalloonSpawn = false;
// let entityTypes['balloon'] = [];
let balloons = [];
let balloonQueue = [];
let balloonSizes = [BALLOON_BASE_SIZE];
for(let i = 1; i < BALLOON_SIZES; ++i)
{
    balloonSizes[i] = BALLOON_SIZES * (2**i);
}
let balloonsToPop = 1 + 2 + 4 + 8;

initialize = () =>
{
    setB2DContactListener(listener);
    setEngineRenderModes("easel", "debug");

    
    if(loadedLevels[currentLevel] != null)
    {
        initLevel(loadedLevels[currentLevel]);
        levelNeedsInitialised = false;
        gameReady = true;
    }

    //TODO: Items need some changes to work with levels
    //TODO: factor this out somewhere... probably asset metadata
    playerScale = 1.5;

    initializeKeyboard(
        {
            up:    [87, 38],
            left:  [65, 37],
            right: [68, 39],
            down:  [83, 40],
            space: [32]
        }
    );
};

function initLevel(levelData)
{
    //TODO:
    // Init Assets
    // for each asset
    //     globalAssets["id"] = asset;

    // Spawn Entities
    lWall = createEntity(entityTypes['edge']);
    entityTypes['edge'].x = WIDTH;
    rWall = createEntity(entityTypes['edge']);
    ground = createEntity(entityTypes['ground']);
    roof = createEntity(entityTypes['roof']);

    for(let i = 0; i < levelData.entities.length; ++i)
    {
        let e = levelData.entities[i];
        if(e.type == "platform")
        {
            spawnPlatform(e.x, e.y, e.width, e.height, e.rotation, e.breaks);
        }
        else if(e.type == "ladder")
        {
            spawnLadder(e.x, e.y, e.sections);
        }
        else if(e.type == "balloon")
        {
            spawnBalloon(e.x, e.y, e.impX, e.impY, e.stage);
        }
        else if(e.type == "hero")
        {
            entityTypes['hero'].x = e.x;
            entityTypes['hero'].y = e.y;
            hero = createEntity(entityTypes['hero']);
        }
    }
}

function parseLevel(levelData)
{
    if(levelData == false)
        return false;

    let level = {assets:[]};
    for(let i = 1; i < levelData.length; ++i)
    {
        if(levelData[i].item.id == "level")
        {
            for(const [key, value] of Object.entries(levelData[i].result))
            {
                level[key] = structuredClone(value);
            }
        }
        else
        {
            level.assets[levelData[i].item.id] = levelData[i].result;
        }
    }

    // Entity Pre-Process
    level.balloonsToPop = 0;
    for(let i = 0; i < level.entities.length; ++i)
    {
        let e = level.entities[i];
        if(e.type == "balloon")
        {
            level.balloonsToPop += (2 ** (e.stage + 1)) - 1;
        }
    }

    //Save to loaded Levels
    if(level.ID != null)
        loadedLevels[level.ID] = level;



    return level;
}

function parseAndInitLevel(levelData)
{
    let level = parseLevel(levelData);

    if( level == false)
        return false;

    initLevel(level);
    return true;
}

function isLevelLoaded(level)
{
    return (!(loadedLevels[level] == null));
}

function loadLevel(level)
{
    if(isLevelLoaded(level))
    {
        initLevel(loadedLevels[level]);
        return;
    }

    blockedLoadingLevel = true;
    levelLoadQueueImmediate.loadManifest(
        "/assets/levels/" + level + "/manifest.json", parseLevel);
}

function fetchAndStoreLevel(level)
{
    if(isLevelLoaded(level))
        return;

    levelLoadQueueStore.loadManifest(
        "/assets/levels/" + level + "/manifest.json", parseLevel);
}

function createGrappleSpawner(pos)
{
    entityTypes['grappleSpawn'].x = pos.x * SCALE;
    entityTypes['grappleSpawn'].y = pos.y * SCALE + entityTypes['grappleSpawn'].height * 1.25;
    grappleSpawner = createEntity(entityTypes['grappleSpawn']);
    grappleSpawner.deleted = false;
    entityTypes['grapple'].x = entityTypes['grappleSpawn'].x;
    entityTypes['grapple'].y = entityTypes['grappleSpawn'].y;
    entityTypes['grapple_tip'].x = entityTypes['grappleSpawn'].x;
    entityTypes['grapple_tip'].y = entityTypes['grappleSpawn'].y;
}

function spawnGrapple(tip = false)
{
    let name = tip ? "grapple_tip" : "grapple";
    grappleSections.push(createEntity(entityTypes[name]));
    let section = grappleSections[grappleSections.length - 1].b2d.GetBody();
    section.ApplyForce(new b2Vec2(0,-GRAVITY * section.GetMass()),section.GetWorldCenter());
    section.SetLinearVelocity(new b2Vec2(0,-15));
}

function spawnLadder(x, y, sections)
{
    entityTypes['ladder'].x = x;
    entityTypes['ladder'].y = y;
    for(let i = 0; i < sections; i++)
    {
        createEntity(entityTypes['ladder']);
        entityTypes['ladder'].y -= entityTypes['ladder'].height*1.1;
    }
}

function spawnItem(x, y, variant)
{
    //TODO: variant
    entityTypes["item"].x = x;
    entityTypes['item'].y = y;
    return createEntity(entityTypes['item']);
}

function spawnPlatform(x, y, width, height, rotation, breakable = false)
{
    let props = entityTypes["platform"];
    if(breakable)
    {
        props = structuredClone(props);
        props.userData = {id: "platform", var: "breakable", index: breakablePlatforms.length};
    }
    props.x = x;
    props.y = y;
    props.width = width;
    props.height = height;
    props.rotation = rotation;
    if(breakable)
        breakablePlatforms.push(createEntity(props));
    else
        createEntity(props);
}

function deleteBreakablePlatform(index)
{
    if(!breakablePlatforms[index].deleted)
    {
        deleteEntity(breakablePlatforms[index]);
        breakablePlatforms[index].deleted = true;
    }
}

function queueBalloonForSpawn(x, y, impx, impy, stage)
{
    balloonQueue.push([x,y,impx,impy,stage]);
}

function freezeBalloons()
{
    let oldGrav = GRAVITY;
    GRAVITY = 0;
    balloonsFrozen = true;
    _engineB2DWorld.SetGravity(new b2Vec2(0,GRAVITY));
    for(i in balloons)
    {
        if(!balloons[i].deleted)
        {
            balloons[i].oldVel = structuredClone(balloons[i].b2d.GetBody().GetLinearVelocity());
            balloons[i].b2d.GetBody().SetLinearVelocity(new b2Vec2(0,0));
        }
    }
}

function slowBalloons()
{
    if(!balloonsFrozen)
    {
        GRAVITY /=2;
        _engineB2DWorld.SetGravity(new b2Vec2(0,GRAVITY));
        setTimeout(() => {
            GRAVITY *= 2;
            _engineB2DWorld.SetGravity(new b2Vec2(0,GRAVITY));
        }, 10000);
    }
}

function spawnHero(x, y)
{
    entityTypes['hero'].x = x;
    entityTypes['hero'].y = y;
    hero = createEntity(entityTypes['hero']);
}

function spawnBalloon(x, y, impx, impy, stage)
{
    entityTypes['balloon'][stage].userData.index = balloons.length;
    balloons[balloons.length] = createEntity(structuredClone(entityTypes['balloon'][stage]));
    balloons[balloons.length-1].deleted = false;
    let tB = balloons[balloons.length-1].b2d.GetBody();
    let mass = tB.GetMass();
    tB.SetPosition(new b2Vec2(x/SCALE, y/SCALE));
    if(!balloonsFrozen)
        tB.ApplyImpulse(new b2Vec2(impx * mass, impy * mass), tB.GetWorldCenter());
}

function spawnQueuedBalloons()
{
    for(i in balloonQueue)
    {
        let cB = balloonQueue[i];
        spawnBalloon(cB[0],cB[1],cB[2],cB[3],cB[4]);
    }
    balloonQueue = [];
}

function popBalloon(balloon)
{
    let position = balloon.b2d.GetBody().GetPosition();
    let stage = balloon.b2d.GetBody().GetUserData().stage;
    if(stage > 0)
    {
        let yVel = balloon.b2d.GetBody().GetLinearVelocity().y;
        if (position.y * yVel * yVel < 5)
            yVel = -2;
        else
            yVel = -2;
        let off = balloonSizes[stage];
        let yPos = position.y * SCALE - off;
        let x1 = position.x * SCALE + off, x2 = position.x * SCALE - off;
        queueBalloonForSpawn(x1,yPos,5,yVel, stage - 1);
        queueBalloonForSpawn(x2,yPos,-5,yVel, stage - 1);
    }
    score += SCORE_BASE * (2 ** (3 - stage));
    balloonsToPop--;
    deleteEntity(balloon);
    balloon.deleted = true;
    if(Math.floor(Math.random()* 40) < 5)
    {
        console.log("drop item");
    }
}

function despawnGrapple()
{
    if(grappleSpawner.deleted)
        return;
    else
        grappleSpawner.deleted = true;

    grappleDeploying = false;
    deleteEntity(grappleSpawner);
    for(let i in grappleSections)
    {
        deleteEntity(grappleSections[i]);
    }
    grappleSections = [];
    grappleSpawning = false;
}

function nextLevel()
{
    score += 10 * Math.floor(time);
    score += 1000 * lives;
    restartLevel();
}

function restartLevel()
{
    despawnGrapple();
    grappleSpawnFlag = false;
    grappleSpawning = false;
    grappleDeploying = false;
    reEnableGrappleDeploying = false;
    balloons = [];
    time = 1000;

    deleteAllEntities();
    initLevel(loadedLevels[currentLevel]);
}

function restartGame()
{
    submitScore();
    restartLevel();
    score = 0;
    lives = 3;
}


// Update World Loop
update = () => {
    if(!gameReady)
        if(loadedLevels[currentLevel] == null) 
            return;
        else 
            gameReady = true;

    ctx.font = "32px Arial";
    ctx.fillStyle = "#606060";
    ctx.fillText("Score: " + score,15,35);
    ctx.fillText("Time: " + Math.floor(time),625,35);
    ctx.fillText("Lives: " + lives,15,565);
    let movVer = false, movHor = false;

    time -=0.4;

    if(onLadder > 0)
    {
        if(!ladderForceApplied)
        {
            let hB = hero.b2d.GetBody();
            hB.ApplyForce(new b2Vec2(0,-GRAVITY* hB.GetMass()), hB.GetWorldCenter());
            ladderForceApplied = true;
        }
    }
    else if(ladderForceApplied)
    {
        let hB = hero.b2d.GetBody();
        hB.ApplyForce(new b2Vec2(0,GRAVITY* hB.GetMass()), hB.GetWorldCenter());
        ladderForceApplied = false;
    }

    if(balloonsToPop == 0)
    {
        nextLevel();
    }
    if(playerDead)
    {
        lives--;
        playerDead = false;
        if(lives == 0)
        {
            restartGame();
        }
        else
        {
            restartLevel();
        }
    }

    if(time <= 0)
        playerDead = true;

    if(delayBalloonSpawn)
        delayBalloonSpawn = false;

    if(grappleSpawning && !keyboardState.space)
        grappleSpawning = false;

    // Because it takes a frame to delete entities we can get weird collisions
    // so disabling grappleDeploy for a frame fixes these... there's a better
    // way, but this works for now!!
    if(reEnableGrappleDeploying)
        grappleDeploying = true;

    if(grappleSpawnFlag)
    {
        spawnGrapple();
        grappleSpawnFlag = false;
    }

    if(keyboardState.right == true)
    {
        movHor = true;
        if(!heroMovingRight)
        {
            heroMovingRight = true;
            heroMovingLeft = false;
            hero.easel.scaleX = playerScale;
            hero.easel.gotoAndPlay("walk");
        }
        ctx.fillText("D",774,60);
        let vel = hero.b2d.GetBody().GetLinearVelocity();
        vel.x = Math.min(vel.x + 2, 10);
        hero.b2d.GetBody().SetLinearVelocity(vel);
    }
    if(keyboardState.left == true)
    {
        movHor = true;
        if(!heroMovingLeft)
        {
            heroMovingLeft = true;
            heroMovingRight = false;
            hero.easel.scaleX = -playerScale;
            hero.easel.gotoAndPlay("walk");
        }
        ctx.fillText("A",714,60);
        let vel = hero.b2d.GetBody().GetLinearVelocity();
        vel.x = Math.max(vel.x - 2, -10);
        hero.b2d.GetBody().SetLinearVelocity(vel);
    }
    if(keyboardState.space == true && !grappleSpawning)
    {
        despawnGrapple();
        grappleSpawning = true;
        grappleDeploying = false;
        reEnableGrappleDeploying = true;
        createGrappleSpawner(hero.b2d.GetBody().GetPosition());
        spawnGrapple(true);
    }
    if(keyboardState.up == true && onLadder > 0)
    {
        movVer = true;
        let hB = hero.b2d.GetBody();
        let vel = hB.GetLinearVelocity().y;
        if(vel > -5)
            hB.ApplyImpulse(new b2Vec2(0,-0.6),hB.GetWorldCenter());
    }
    if(keyboardState.down == true && onLadder > 0)
    {
        movVer = true;
        let hB = hero.b2d.GetBody();
        let vel = hB.GetLinearVelocity().y;
        if(vel < 5)
            hB.ApplyImpulse(new b2Vec2(0,0.6),hB.GetWorldCenter());
    }
    if(!(movHor && movVer))
    {
        let vel = hero.b2d.GetBody().GetLinearVelocity();

        if(!movHor)
        {
            heroMovingLeft = false;
            heroMovingRight = false;
            vel.x = 0;
            hero.easel.gotoAndPlay("idle");
        }
        if(!movVer && onLadder > 0)
            vel.y = 0;

        hero.b2d.GetBody().SetLinearVelocity(vel);
    }

    if(despawnGrappleFlag)
    {
        despawnGrapple();
        despawnGrappleFlag = false;
        delayBalloonSpawn = true;
    }

    // Ahh the joys of physics, another case where we delay a frame. This time to
    // avoid the newly spawned balloons hitting the grapple before it despawns..
    // perhaps the engine should update after the game does..?
    if(!delayBalloonSpawn)
        spawnQueuedBalloons();

};

function fatalError()
{
    //TODO
}

function loadGameData(gameData)
{
    for( const [name, metadata] of Object.entries(gameData.assetMetaData))
    {
        assetMetaData[name] = metadata;
    }

    for( const [name, props] of Object.entries(gameData.entityTypes))
    {
        if(props.userData == null)
            props.userData = {"id": name};
        else       
            props.userData.id = name;
        
        entityTypes[name] = createEntityProperties(props);
    }


    // Expand balloon properties
    let m = entityTypes['balloon'].stageRadiusReductionMultiplier;
    let e = structuredClone(entityTypes['balloon']);
    entityTypes['balloon'] = [];
    entityTypes['balloon'][e.userData.stage] = structuredClone(e);
    while(e.userData.stage > 0)
    {
        e.radius *= m;
        --e.userData.stage;
        entityTypes['balloon'][e.userData.stage] = structuredClone(e);
    }
}

function fetchGameData()
{
    //Create the request.
    let url = './data/game.json';
    let request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.onreadystatechange = function()
    {
        // 4 == response ready.
        if(request.readyState != 4)
            return;

        if(request.status != 200)
        {
            console.error(request.responseText);
            fatalError();
        }
        else
        {
            rawDat = JSON.parse(request.responseText);
            loadGameData(rawDat);
            startGame();
        }
    };

    request.send();
}

function fetchLevel(n)
{

}
    
function submitScore()
{
    //Create the request.
    let url = './backend/add_highscore.php';
    let request = new XMLHttpRequest();
    request.open('POST', url, true);
    request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    request.onreadystatechange = function()
    {
        // 4 == response ready.
        if(request.readyState != 4)
            return;

        if(request.status != 200)
            console.error(request.responseText);
        else
            console.log(request.responseText);
    };

    // Prepare data and send request.
    let params = 'score=' + score;
    request.send(params);
}

/*****
* Utility Functions & Objects
*/
  

/*****
* Listeners
*/
let listener = new Box2D.Dynamics.b2ContactListener;
listener.BeginContact = function(contact)
{
    let fixa = contact.GetFixtureA().GetBody().GetUserData().id;
    let fixb = contact.GetFixtureB().GetBody().GetUserData().id;

    if((fixa=="ladder" && fixb == "hero") || (fixa=="hero" && fixb=="ladder"))
    {
        ++onLadder;
    }
    else if((fixa=="item" && fixb == "hero") || (fixa=="hero" && fixb=="item"))
    {
        deleteEntity(item);
        if(!shielded)
            shielded = true;
    }
    else if((fixa=="grapple_tip" && fixb == "roof") || (fixa=="roof" && fixb=="grapple_tip"))
    {
        if(grappleDeploying)
        {
            for(let i in grappleSections)
            {
                grappleSections[i].b2d.GetBody().SetLinearVelocity(new b2Vec2(0,0));
            }
            grappleDeploying = false;
        }
        //grappleSections[0].SetLinearVelocity(new b2Vec2(0,0));
    }
    else if((fixa=="grapple_tip" && fixb == "platform") || (fixa=="platform" && fixb=="grapple_tip"))
    {
        if(grappleDeploying)
        {
            if(contact.GetFixtureB().GetBody().GetUserData().var == "solid")
            {
                for(let i in grappleSections)
                {
                    grappleSections[i].b2d.GetBody().SetLinearVelocity(new b2Vec2(0,0));
                }
                grappleDeploying = false;
            }
            else
            {
                despawnGrappleFlag = true;
                deleteBreakablePlatform(contact.GetFixtureB().GetBody().GetUserData().index);
            }
        }
    }
    else if(fixa == "balloon" && (fixb == "grapple" || fixb == "grappleSpawn" || fixb == "grapple_tip"))
    {
        if(!despawnGrappleFlag)
        {
            let cB = contact.GetFixtureA().GetBody();
            popBalloon(balloons[cB.GetUserData().index]);
            despawnGrappleFlag = true;
        }
    }
    else if((fixa == "grapple" || fixa == "grappleSpawn" || fixa == "grapple_tip") && fixb == "balloon")
    {
        if(!despawnGrappleFlag)
        {
            let cB = contact.GetFixtureB().GetBody();
            popBalloon(balloons[cB.GetUserData().index]);
            despawnGrappleFlag = true;
        }
    }
    else if(fixa == "hero" && fixb == "balloon")
    {
        if(!shielded)
            playerDead = true;
        else
        {
            let uD = contact.GetFixtureB().GetBody().GetUserData();
            balloonsToPop -= (2 ** (uD.stage + 1)) - 1; 
            deleteEntity(balloons[uD.index]);
            balloons[uD.index].deleted = true;
            shielded = false;
        }
    }
    else if(fixb == "hero" && fixa == "balloon")
    {
        if(!shielded)
            playerDead = true;
        else
        {
            let uD = contact.GetFixtureA().GetBody().GetUserData();
            balloonsToPop -= (2 ** (uD.stage + 1)) - 1; 
            deleteEntity(balloons[uD.index]);
            balloons[uD.index].deleted = true;
            shielded = false;
        }
    }
}

listener.EndContact = function(contact)
{
    let fixa = contact.GetFixtureA().GetBody().GetUserData().id;
    let fixb = contact.GetFixtureB().GetBody().GetUserData().id;
    if((fixa=="ladder" && fixb == "hero") || (fixa=="hero" && fixb=="ladder"))
    {
        --onLadder;
    }
    else if( (fixa == "grappleSpawn" && (fixb == "grapple"|| fixb == "grapple_tip")) ||
        ((fixa == "grapple"  || fixa == "grapple_tip") && fixb == "grappleSpawn") )
    {
        if(grappleDeploying)
        {
            grappleSpawnFlag = true;
        }
    }
}

listener.PostSolve = function(contact, impulse)
{
    let fixa=contact.GetFixtureA().GetBody().GetUserData().id;
    let fixb=contact.GetFixtureB().GetBody().GetUserData().id;
}

listener.PreSolve = function(contact, oldManifold)
{
    let fixa=contact.GetFixtureA().GetBody().GetUserData().id;
    let fixb=contact.GetFixtureB().GetBody().GetUserData().id;
}





levelLoadQueueStore = new createjs.LoadQueue(true);
levelLoadQueueStore.addEventListener("complete",(e) =>
    {
        if(parseLevel(levelLoadQueueStore.getItems(true)) == false)
            console.error("Failed to parse level");
        else
            console.log("Parsed level successfully");
        levelLoadQueueStore.removeAll();
    }
);

levelLoadQueueStore.loadManifest("assets/levels/1/manifest.json");

levelLoadQueueImmediate = new createjs.LoadQueue(true);
levelLoadQueueImmediate.addEventListener("complete",(e) =>
    {
        if(parseAndInitLevel(levelLoadQueueImmediate.getItems(true)) == false)
            console.error("Failed to parse level");
        else
            console.log("Parsed level successfully");
        levelLoadQueueImmediate.removeAll();
    }
);
fetchGameData();