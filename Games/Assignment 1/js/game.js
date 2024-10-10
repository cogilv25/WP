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

let entityTypes = [];
let rawDat;

let testToggle = false;
let balloonsFrozen = false;

let score = 0, time = 1000;
let ground, roof, lWall, rWall, ladderProps;
let hero,platform,platform2, test;
let breakablePlatforms = [];

let playerDead = false, lives = 3;
let shielded = false;
let onLadder = false;
let waitingForGameData = true;

let itemProps, crabProps;
let item, crab;

let despawnGrappleFlag = false, grappleSpawning = false;
let grappleSections = [], grappleDeploying = false;
let grappleSpawnerProps, grappleSpawner, grappleSpawnFlag = false;
let reEnableGrappleDeploying = false;

let delayBalloonSpawn = false;
let balloonProps = [];
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
    setEngineRenderMode("debug");

    let edgeProps = createEntityProperties({
        x:0, y: HEIGHT/2,
        width: 8, height: HEIGHT/2,
        type: "static", shape: "rect",
        density: 0.01, restitution: 0.3,
        userData: {id: "edge"}
    })

    
    lWall = createEntity(edgeProps);
    edgeProps.x = WIDTH;
    rWall = createEntity(edgeProps);
    edgeProps.height = 8;
    edgeProps.x = WIDTH / 2;
    edgeProps.width = WIDTH/2;
    edgeProps.userData = {id: "ground"};
    edgeProps.y = HEIGHT;
    ground = createEntity(edgeProps);
    edgeProps.y = 0;
    edgeProps.categories += 2;
    edgeProps.userData = {id: "roof"};
    roof = createEntity(edgeProps);

    spawnPlatform(400, 165, 200, 8);
    spawnPlatform(400, 435, 200, 8, true);

    hero = createEntity(entityTypes['hero']);

    item = spawnItem(300,300,"shield");

    spawnLadder(300,500,50);

    balloonProps[3] = createEntityProperties(
    {
        radius:72, friction: 0,
        density:1, restitution: 1,
        categories: 4, mask: 65535 - 4,
        userData:{id:"balloon", stage: 3}
    });
    balloonProps[2] = structuredClone(balloonProps[3]);
    balloonProps[2].userData.stage = 2;
    balloonProps[2].radius /= 2;
    balloonProps[1] = structuredClone(balloonProps[2]);
    balloonProps[1].userData.stage = 1;
    balloonProps[1].radius /= 2;
    balloonProps[0] = structuredClone(balloonProps[1]);
    balloonProps[0].userData.stage = 0;
    balloonProps[0].radius /= 2;

    spawnBalloon(400, 300, 8, 1, 3);

    // platform = defineNewStatic(0.5, 5, 1.02, -193, 250, 200, 8, 0, "plat");
    // platform2 = defineNewStatic(0.5, 0.5, 1.05, 600, 250, 300, 8, 0, "plat");

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

function createGrappleSpawner(pos)
{
    entityTypes['grappleSpawn'].x = pos.x * SCALE;
    entityTypes['grappleSpawn'].y = pos.y * SCALE + 6; 
    grappleSpawner = createEntity(entityTypes['grappleSpawn']);
    entityTypes['grapple'].x = entityTypes['grappleSpawn'].x;
    entityTypes['grapple'].y = entityTypes['grappleSpawn'].y;
}

function spawnGrapple()
{
    grappleSections.push(createEntity(entityTypes['grapple']));
    let section = grappleSections[grappleSections.length - 1].b2d.GetBody();
    section.ApplyForce(new b2Vec2(0,-GRAVITY * section.GetMass()),section.GetWorldCenter());
    section.SetLinearVelocity(new b2Vec2(0,-15));
}

function spawnLadder(x, y, height)
{
    entityTypes['ladder'].x = x;
    entityTypes['ladder'].y = y;
    entityTypes['ladder'].height = height;
    createEntity(entityTypes['ladder']);
}

function spawnItem(x, y, variant)
{
    //TODO: variant
    entityTypes["item"].x = x;
    entityTypes['item'].y = y;
    return createEntity(entityTypes['item']);
}

function spawnPlatform(x, y, width, height, breakable = false)
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

function spawnBalloon(x, y, impx, impy, stage)
{
    balloonProps[stage].userData.index = balloons.length;
    balloons[balloons.length] = createEntity(structuredClone(balloonProps[stage]));
    balloons[balloons.length-1].deleted = false;
    let tB = balloons[balloons.length-1].b2d.GetBody();
    let mass = tB.GetMass();
    tB.SetPosition(new b2Vec2(x/SCALE, y/SCALE));
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
    if(grappleSpawner == null)
        return;
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
    hero.b2d.GetBody().SetPosition(new b2Vec2(50/SCALE, (600-48)/SCALE));
    for(i in balloons)
    {
        if(!balloons[i].deleted)
        {
            deleteEntity(balloons[i]);
        }
    }
    balloons = [];
    balloonsToPop = 1 + 2 + 4 + 8;
    queueBalloonForSpawn(400, 300, 8, 1, 3);
    time = 1000;
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
    ctx.font = "32px Arial";
    ctx.fillStyle = "#606060";
    ctx.fillText("Score: " + score,15,35);
    ctx.fillText("Time: " + Math.floor(time),625,35);
    ctx.fillText("Lives: " + lives,15,565);
    let movVer = false, movHor = false;

    time -=0.4;

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
        ctx.fillText("D",774,60);
        let vel = hero.b2d.GetBody().GetLinearVelocity();
        vel.x = Math.min(vel.x + 2, 10);
        hero.b2d.GetBody().SetLinearVelocity(vel);
    }
    if(keyboardState.left == true)
    {
        movHor = true;
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
        spawnGrapple();
    }
    if(keyboardState.up == true && onLadder)
    {
        movVer = true;
        let hB = hero.b2d.GetBody();
        let vel = hB.GetLinearVelocity().y;
        if(vel > -5)
            hB.ApplyImpulse(new b2Vec2(0,-0.6),hB.GetWorldCenter());
    }
    if(keyboardState.down == true && onLadder)
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
            vel.x = 0;
        if(!movVer && onLadder)
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

}

function loadGameData(gameData)
{
    for( const [name, props] of Object.entries(gameData.entityTypes))
    {
        if(props.userData == null)
            props.userData = {"id": name};
        else       
            props.userData.id = name; 
        entityTypes[name] = createEntityProperties(props);
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
        onLadder = true;
        let hB = hero.b2d.GetBody();
        hB.ApplyForce(new b2Vec2(0,-GRAVITY* hB.GetMass()), hB.GetWorldCenter());
    }
    else if((fixa=="item" && fixb == "hero") || (fixa=="hero" && fixb=="item"))
    {
        deleteEntity(item);
        if(!shielded)
            shielded = true;
    }
    else if((fixa=="grapple" && fixb == "roof") || (fixa=="roof" && fixb=="grapple"))
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
    else if((fixa=="grapple" && fixb == "platform") || (fixa=="roof" && fixb=="platform"))
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
    else if(fixa == "balloon" && (fixb == "grapple" || fixb == "grappleSpawn"))
    {
        if(!despawnGrappleFlag)
        {
            let cB = contact.GetFixtureA().GetBody();
            popBalloon(balloons[cB.GetUserData().index]);
            despawnGrappleFlag = true;
        }
    }
    else if((fixa == "grapple" || fixa == "grappleSpawn") && fixb == "balloon")
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
        onLadder = false;
        let hB = hero.b2d.GetBody();
        hB.ApplyForce(new b2Vec2(0, GRAVITY * hB.GetMass()), hB.GetWorldCenter());
    }
    else if( (fixa == "grappleSpawn" && fixb == "grapple") ||
        (fixa == "grapple" && fixb == "grappleSpawn") )
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

fetchGameData();
