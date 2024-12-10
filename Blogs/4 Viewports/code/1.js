function renderWorld()
{
	worldTransformX = 400 - entities[0][0]; // 400 - x
	worldTransformY = 300 - entities[0][1]; // 300 - y

	for(let i = 0; i < entities.length; ++i)
	{
		easelEntities[i].x = entities[i][0] + worldTransformX;
		easelEntities[i].y = entities[i][1] + worldTransformY;
	}

	stage.update();
}




