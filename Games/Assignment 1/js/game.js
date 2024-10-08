"use strict"
// Points == 200,400,800,1600 for balls as they get smaller
// Start with 3 lives if you die game resets to first level
// Timer starts at 1000 and counts down, presumably you lose if it hits 0
// Weapons == grapple, double grapple, machine gun
// Random animals, points for killing, 2-hits..?
// Ladders
// Breakable and non-breakable platforms 

GRAVITY = 9;

let score = 0;
let despawnGrappleFlag = false, grappleSpawning = false;;
let ground,roof,lWall,rWall;
let hero,platform,platform2, test;
let grappleSectionProps, grappleSections = [], grappleDeploying = false;
let grappleSpawnerProps, grappleSpawner, grappleSpawnFlag = false;
let reEnableGrappleDeploying = false;
let delayBalloonSpawn = false;

let balloonProps = [];
let balloons = [];
let balloonQueue = [];
let balloonSizes = [9,18,36,72];

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
    edgeProps.categories = 2;
    edgeProps.userData = {id: "roof"};
    roof = createEntity(edgeProps);

    let solidPlat = createEntity(
        createEntityProperties({
            x:400, y:100,
            width:200, height: 8,
            shape: "rect",
            type:"static",
            categories: 2,
            userData: {id:"solid_platform"}
        })
    );

    hero = createEntity(
        createEntityProperties({
            x:50, y:600-48,
            width: 20, height: 40,
            shape: "rect",
            density:0.2,
            fixedRotation:true,
            sleepingAllowed:false,
            mask: 65535-8,
            userData:{id:"hero"}
        })
    );
    grappleSpawnerProps = createEntityProperties(
        {
            x:30, y:600 - 8 -30/2,
            width: 10, height: 30,
            shape: "rect",
            density:0.2,
            fixedRotation:true,
            sensor: true,
            type: "static",
            categories: 16, mask: 4 + 8,
            userData:{id:"grappleSpawn"}
        }
    );
    grappleSectionProps = createEntityProperties(
        {
            x:30, y:600 - 8 -36/2,
            width: 10, height: 36,
            shape: "rect",
            density:0.2,
            fixedRotation:true,
            sleepingAllowed: false,
            sensor: true,
            categories: 8, mask: 2 + 4 + 16,
            userData:{id:"grapple"}
        }
    );


    balloonProps[3] = createEntityProperties(
    {
        radius:72, friction: 0.01,
        density:0.1, restitution: 1,
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



    spawnBalloon(400, 300, 4, 1, 3);

    // platform = defineNewStatic(0.5, 5, 1.02, -193, 250, 200, 8, 0, "plat");
    // platform2 = defineNewStatic(0.5, 0.5, 1.05, 600, 250, 300, 8, 0, "plat");

    initializeKeyboard(
        {
            up:    [87, 38],
            left:  [65, 37],
            right: [68, 39],
            down:  [83, 40]
        }
    );
};

function createGrappleSpawner(pos)
{
    grappleSpawnerProps.x = pos.x * SCALE;
    grappleSpawnerProps.y = pos.y * SCALE + 6; 
    grappleSpawner = createEntity(grappleSpawnerProps);
    grappleSectionProps.x = grappleSpawnerProps.x;
    grappleSectionProps.y = grappleSpawnerProps.y;
}

function spawnGrapple()
{
    grappleSections.push(createEntity(grappleSectionProps));
    let section = grappleSections[grappleSections.length - 1].b2d.GetBody();
    section.ApplyForce(new b2Vec2(0,-GRAVITY * section.GetMass()),section.GetWorldCenter());
    section.SetLinearVelocity(new b2Vec2(0,-15));
}

function queueBalloonForSpawn(x, y, impx, impy, stage)
{
    balloonQueue.push([x,y,impx,impy,stage]);
}

function spawnBalloon(x, y, impx, impy, stage)
{
    console.log(balloons.length);
    balloonProps[stage].userData.index = balloons.length;
    balloons[balloons.length] = createEntity(structuredClone(balloonProps[stage]));
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
        let off = balloonSizes[stage];
        let yPos = position.y * SCALE - off;
        let x1 = position.x * SCALE + off, x2 = position.x * SCALE - off;
        queueBalloonForSpawn(x1,yPos,4,-2, stage - 1);
        queueBalloonForSpawn(x2,yPos,-4,-2, stage - 1);
    }
    deleteEntity(balloon);
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


// Update World Loop
update = () => {
    ctx.font = "32px Arial";
    ctx.fillStyle = "#606060";
    ctx.fillText("Score: " + score,9,35);
    let keyPressed = false;


    if(delayBalloonSpawn)
        delayBalloonSpawn = false;

    if(grappleSpawning && !keyboardState.up)
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
        keyPressed = true;
        ctx.fillText("D",774,60);
        let vel = hero.b2d.GetBody().GetLinearVelocity();
        vel.x = Math.min(vel.x + 2, 10);
        hero.b2d.GetBody().SetLinearVelocity(vel);
    }
    if(keyboardState.left == true)
    {
        keyPressed = true;
        ctx.fillText("A",714,60);
        let vel = hero.b2d.GetBody().GetLinearVelocity();
        vel.x = Math.max(vel.x - 2, -10);
        hero.b2d.GetBody().SetLinearVelocity(vel);
    }
    if(keyboardState.up == true && !grappleSpawning)
    {
        despawnGrapple();
        grappleSpawning = true;
        grappleDeploying = false;
        reEnableGrappleDeploying = true;
        createGrappleSpawner(hero.b2d.GetBody().GetPosition());
        spawnGrapple();
    }
    if(keyboardState.down == true)
    {
        keyPressed = true;
        ctx.fillText("S",744,60);
        despawnGrapple();
    }
    if(!keyPressed)
    {
        let vel = hero.b2d.GetBody().GetLinearVelocity();
        vel.x = 0;
        hero.b2d.GetBody().SetLinearVelocity(vel);
    }

    if(despawnGrappleFlag)
    {
        despawnGrapple();
        despawnGrappleFlag = false;
        delayBalloonSpawn = true;
    }

    if(!delayBalloonSpawn)
        spawnQueuedBalloons();

};
    
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

    if((fixa=="grapple" && fixb == "roof") || (fixa=="roof" && fixb=="grapple"))
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
    else if((fixa=="grapple" && fixb == "solid_platform") || (fixa=="roof" && fixb=="solid_platform"))
    {
        if(grappleDeploying)
        {
            for(let i in grappleSections)
            {
                grappleSections[i].b2d.GetBody().SetLinearVelocity(new b2Vec2(0,0));
            }
            grappleDeploying = false;
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

}

listener.EndContact = function(contact)
{
    let fixa = contact.GetFixtureA().GetBody().GetUserData().id;
    let fixb = contact.GetFixtureB().GetBody().GetUserData().id;
    
    if( (fixa == "grappleSpawn" && fixb == "grapple") ||
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

startGame();