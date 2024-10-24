"use strict"

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