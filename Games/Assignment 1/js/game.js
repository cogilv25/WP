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
GRAVITY = 18;
let loadedLevels = [];
let currentLevel = 0;
let gameReady = false;
let paused = false;
let balloonsToPop;
let savePoint = null, loadSaveFlag = false;
let gameOver = false, gameWon = false;
let heroScaleX;
let musicStarted = false;
let bgMusicTrack, bgMusicVolume = 0.15;

//TODO: Add a button on main & pause menus, this would neatly get around
//        the annoying first interaction audio problem!
let muted = true;

let entityTypes = [];

// This is a fragile structure and should probably be protected, labels are loaded
//  in for each image for each spritesheet then they are converted to images once
//  we are sure the assets have loaded
var assetMetaData = [];
let rawDat;
let levelLoadQueue;

// Should be a stack really, like levels should so if something is not found at the top
// we can traverse down until we find it, or don't as the case may be
let assets = {};

let balloonsFrozen = false;

let score = 0, time = 1000;
let ground, roof, lWall, rWall;
let hero;
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
let balloons = [];
let balloonQueue = [];


initialize = () =>
{
    setB2DContactListener(listener);
    addRenderer((context)=>
        {
            setHudScore(score);
            setHudTime(Math.floor(time));
        }, "hud"
    );
    setEngineRenderTargets([ctx, ctx2, ctx]);
    setEngineRenderModes(["easel", "debug", "hud"]);

    if(loadSaveFlag)
    {
        score = savePoint.score;
        lives = savePoint.lives;
        currentLevel = savePoint.level - 1;
    }
    
    if(loadedLevels[currentLevel] != null)
    {
        initLevel(loadedLevels[currentLevel]);
        gameReady = true;
    }

    updateHealthBar(lives);

    initializeKeyboard(
        {
            up:    [87, 38],  // ↑ or W
            left:  [65, 37],  // ← or A
            down:  [83, 40],  // ↓ or S
            right: [68, 39],  // → or D
            space: [32],      // SPACE
            pause: [27],      // ESC
            debug: [115, 223] // ` or F4
        }
    );

    registerInputCallback("left", "down",() =>
    {
        hero.easel.scaleX = -heroScaleX;
        hero.easel.gotoAndPlay("walk");
    });
    registerInputCallback("left", "up",() =>
    {
        if(!keyboardState.right)
        {
            hero.easel.scaleX = -heroScaleX;
            hero.easel.gotoAndPlay("idle");
        }
        else
            hero.easel.scaleX = heroScaleX;
    });
    registerInputCallback("right", "down",() =>
    {
        hero.easel.scaleX = heroScaleX;
        hero.easel.gotoAndPlay("walk");
    });
    registerInputCallback("right", "up",() =>
    {
        if(!keyboardState.left)
        {
            hero.easel.scaleX = -heroScaleX;
            hero.easel.gotoAndPlay("idle");
        }
        else
            hero.easel.scaleX = -heroScaleX;
    });
    registerInputCallback("debug", "edge", () =>
    {
        toggleCanvasDisplayed();
    });
};

function setGamePaused(value)
{
    if(!value)
    {
        setEnginePaused(false);
        setPhysicsPaused(true);
    }
    else
    {
        setEnginePaused(true);
        paused = true
    }
}

function initLevel(levelData)
{
    
    for(let key in levelData.assets)
    {
        assets[key] = levelData.assets[key];
    }

    // Spawn Entities
    createEntity(entityTypes["background"]);
    let props = structuredClone(entityTypes['edge']);
    lWall = createEntity(props);
    props.x = WIDTH;
    rWall = createEntity(props);
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
            hero.easel.scaleX = -(heroScaleX = hero.easel.scaleX);
        }
    }
    balloonsToPop = levelData.balloonsToPop;
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
    assets['whistle_sound'].play();
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
        let off = entityTypes["balloon"][stage].radius;
        let yPos = position.y * SCALE - off;
        let x1 = position.x * SCALE + off, x2 = position.x * SCALE - off;
        queueBalloonForSpawn(x1,yPos,5,yVel, stage - 1);
        queueBalloonForSpawn(x2,yPos,-5,yVel, stage - 1);
    }
    score += SCORE_BASE * (2 ** (3 - stage));
    balloonsToPop--;
    createjs.Sound.play("pop" + (stage+1) + "_sound");
    deleteEntity(balloon);
    balloon.deleted = true;
    if(Math.floor(Math.random()* 40) < 5)
    {
        console.log("drop item");
    }
}

function despawnGrapple()
{
    assets['whistle_sound'].stop();
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

function saveState()
{
    savePoint =
    {
        score: score,
        level: currentLevel + 1,
        lives: lives
    };

    saveStore.setItem("save_state_" + userID, JSON.stringify(savePoint));
}

function nextLevel()
{
    score += 10 * Math.floor(time);
    score += 1000 * lives;
    ++currentLevel;
    if(currentLevel == loadedLevels.length)
    {
        gameOver = true;
        gameWon = true;
        setContinueButtonVisibility(false);
        saveStore.removeItem("save_state_" + userID);
        return true;
    }
    saveState();
    restartLevel();
    return false;
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
    setGamePaused(false);
    setHudLevel(loadedLevels[currentLevel].name);
    initLevel(loadedLevels[currentLevel]);
}

function restartGame()
{
    score = 0;
    updateHealthBar(lives = 3);
    currentLevel = 0;
    restartLevel();
}


// Update World Loop
update = () => {
    if(!gameReady)
        if(loadedLevels[currentLevel] == null) 
            return;
        else
        {
            initLevel(loadedLevels[currentLevel]);
            gameReady = true;
        }

    if(paused) return;

    if(gameOver)
    {
        if(gameWon)
        {
            setPopupHeading("You Won!");
            setPopupMessage("Well done! You have completed every level and completed the game! But who is the greatest of them all!? Check the highscores to find out!");
        }
        else
        {
            setPopupHeading("You Lost!");
            setPopupMessage("Well, well, well, another day, another snarky message.. Maybe one day you will ascend, but for now you will have to settle for this mighty score..");
        }
        setContinueButtonVisibility(false);
        submitScore();
        setPopupScore(score);
        setGamePaused(true);
        showPopup();
        return;
    }
    let movVer = false, movHor = false;

    time -=0.4;


    if(keyboardState.pause)
    {
        setEnginePaused(true);
        showPauseMenu();
    }

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
        if(nextLevel())
            return;
    }
    if(playerDead)
    {
        updateHealthBar(--lives);
        playerDead = false;
        if(lives == 0)
        {
            saveStore.removeItem("save_state_" + userID);
            setContinueButtonVisibility(false);
            gameOver = true;
            gameWon = false;
        }
        else
        {
            setContinueButtonVisibility(true);
            saveState();
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
        }
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
        }
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

function fatalError(message)
{
    //TODO: something more useful...
    console.error(message);
    // Throw an exception we will not catch.
    throw new Error("Fatal Error: " + message);
}

function loadGameData(items)
{
    for(var i = 1; i < items.length; ++i)
    {
        let id = items[i].item.id;
        if(id == "metadata")
        {
            assetMetaData = structuredClone(items[i].result);
        }
        else if(id == "settings")
        {
            let gameData = items[i].result;
            for( const [name, props] of Object.entries(gameData.entityTypes))
            {
                if(props.userData == null)
                    props.userData = {"id": name};
                else       
                    props.userData.id = name;
                
                entityTypes[name] = createEntityProperties(props);
            }
        }
        // Sounds are internally processed by preloadjs
        else if(items[i].item.type != "sound")
        {
            assets[id] = items[i].result;
        }
    }

    // Within the metadata for assets that can contain multiple images
    // we must replace the asset ids of images with the actual image 
    // data. This is mostly for SpriteSheets.
    //
    // We could do this in the upper loop only if we can guarantee that
    // all required assets appear before the metadata in "items". I could
    // ensure the manifest loads in that order but that's very fragile.
    for(let key in assetMetaData)
    {
        let asset = assetMetaData[key];
        if(asset.type == "sound")
        {
            if(asset.singleInstance)
                assets[key] = createjs.Sound.createInstance(key);
        }
        if(asset.images == null)
            continue;

        for(let i = 0; i < asset.images.length; ++i)
            asset.images[i] = assets[asset.images[i]];
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

function startMusic()
{
    let currentTrack = 0;
    let looper = () =>
    {
        window.setTimeout(()=>
        {
            bgMusicTrack = assets["bg_track_" + (++currentTrack+1)];
            bgMusicTrack.play();
            bgMusicTrack.volume = bgMusicVolume;
            currentTrack %= 4;
        }, 3000);
    }

    for(let i = 0; i < 5; ++i)
    {
        assets['bg_track_' + (i + 1)].addEventListener("complete", looper);
    }

    bgMusicTrack = assets["bg_track_1"]
    bgMusicTrack.play();
    bgMusicTrack.volume = bgMusicVolume;
}
    
function submitScore()
{
    let scoreCopy = structuredClone(score);
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
    };

    // Prepare data and send request.
    let params = 'score=' + scoreCopy;
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
    else if(fixa=="shield_item" && fixb == "hero")
    {
        deleteEntity(item);
        if(!shielded)
            shielded = true;
    }
    else if(fixa=="hero" && fixb=="shield_item")
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
            assets['whistle_sound'].stop();
        }
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
                assets['whistle_sound'].stop();
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

setUnPauseCallback(()=>{ window.setTimeout(()=>setEnginePaused(false),300); });

setLevelAnimateCallback(()=>{window.setTimeout(()=>{setPhysicsPaused(false); paused=false;},300);});

setPopupClosedCallback(()=>
    {
        gameOver = false;
        gameWon = false;
        saveStore.removeItem("save_state_" + userID);
    });

setMenuItemHoverCallback(()=>
    {
        if(!gameReady) return;
        assets["tick_sound"].play();
    });

setNewGameCallback(()=>
{
    if(!musicStarted)
    {
        musicStarted = true;
        startMusic();
    }

    loadSaveFlag = false;
    restartGame();
});

setContinueCallback(()=>{
    if(!musicStarted)
    {
        musicStarted = true;
        startMusic();
    }
    // This first part is for an edge case where a user accidentally
    //  clicks new game then quits before dying, their save is intact. 
    savePoint = JSON.parse(saveStore.getItem("save_state_" + userID));

    if(savePoint != null)
        loadSaveFlag = true;

    score = savePoint.score;
    lives = savePoint.lives;
    currentLevel = savePoint.level - 1;
    updateHealthBar(lives);
    restartLevel();
});

setQuitGameCallback(()=>
    {
        // Start the game after 600ms when it has been hidden,
        // reset the game to the current level and pause the game
        window.setTimeout(()=>
            {
                setGamePaused(true);
                restartGame();
            },600);
    });


setGamePaused(true);

// We keep trying to load levels until
//  we can't find a file and fail.
var loadingLevels = true;
levelLoadQueue = new createjs.LoadQueue(true);
levelLoadQueue.installPlugin(createjs.Sound);
levelLoadQueue.addEventListener("error", (e) =>
    {
        loadingLevels = false;
    }
);

levelLoadQueue.addEventListener("complete",(e) =>
    {
        let level = parseLevel(levelLoadQueue.getItems(true));
        if(level != false)
            console.log("Parsed level " + (level.ID + 1) + " successfully");

        levelLoadQueue.removeAll();


        if(loadingLevels)
        {
            let i = 0; 
            while(loadedLevels[i] != null) 
                ++i;
            
            levelLoadQueue.loadManifest("assets/levels/" + 
                        (i + 1) + "/manifest.json");
        }
    }
);

savePoint = JSON.parse(saveStore.getItem("save_state_" + userID));
if(savePoint == null)
    levelLoadQueue.loadManifest("assets/levels/1/manifest.json");
else
{
    setContinueButtonVisibility(true);
    levelLoadQueue.loadManifest("assets/levels/" + savePoint.level + "/manifest.json");
    loadSaveFlag = true;
}


(() => {
    // This is only used once so it's in an anonymous function so that
    // the garbage collector will *hopefully* free up the memory...
    let gameDataLoadQueue = new createjs.LoadQueue(true);
    gameDataLoadQueue.installPlugin(createjs.Sound);
    gameDataLoadQueue.addEventListener("complete",(e) =>
        {
            if(loadGameData(gameDataLoadQueue.getItems(true)) == false)
                fatalError("Failed to load game data");
            else
                console.log("Game data loaded successfully");

            gameDataLoadQueue.destroy();
            startGame();

        }
    );
    gameDataLoadQueue.loadManifest("assets/data/manifest.json");
})();