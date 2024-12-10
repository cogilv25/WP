let camera =
{
	x: 0, y:0,
	target: 0,
	maxSpeed: 20,
	moveFactor: 0.2,
	minX: worldStart + 400,
	minY: worldStart + 300,
	maxX: worldEnd - 400,
	maxY: worldEnd - 300
};

function renderWorld()
{
	// Get the amount we want to move by based on a factor of the distance
	//    along each axis.
	let xMove = (entities[camera.target][0] - camera.x) * camera.moveFactor;
	let yMove = (entities[camera.target][1] - camera.y) * camera.moveFactor;

	// tx, ty is the new position ignoring the world bounds
	let tx = camera.x + clamp(xMove, -camera.maxSpeed, camera.maxSpeed);
	let ty = camera.y + clamp(yMove, -camera.maxSpeed, camera.maxSpeed);

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





