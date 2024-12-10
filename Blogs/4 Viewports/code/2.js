function clamp(value, min, max)
{
	return value < min ? min : (value > max ? max : value);
}

let worldStart = 256;
let worldEnd = worldStart + 2048;

let camera =
{
	x: 0, y:0,
	target: 0,
	minX: worldStart + 400,
	minY: worldStart + 300,
	maxX: worldEnd - 400,
	maxY: worldEnd - 300
};

function renderWorld()
{
	let tx = entities[camera.target][0];
	let ty = entities[camera.target][1];

	camera.x = clamp(tx, camera.minX, camera.maxX);
	camera.y = clamp(ty, camera.minY, camera.maxY);

	worldTransformX = 400 - camera.x;
	worldTransformY = 300 - camera.y;
	for(let i = 0; i < entities.length; ++i)
	{
		easelEntities[i].x = entities[i][0] + worldTransformX;
		easelEntities[i].y = entities[i][1] + worldTransformY;
	}

	stage.update();
}






