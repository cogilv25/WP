<?php
	session_start();
	require "database.php";

	$db = initializeDatabase();

	$result = $db->query("SELECT `name`, `score` FROM `highscore` JOIN `user` ORDER BY `score` DESC LIMIT 5");

	$highscores = [];
	while($row = $result->fetch_row())
	{
		$highscores[] = $row;
	}

	die(json_encode($highscores, JSON_PRETTY_PRINT));
?>