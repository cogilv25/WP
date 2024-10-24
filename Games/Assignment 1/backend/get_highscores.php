<?php
	require "database.php";
	$db = initializeDatabase();
	die(json_encode(getTopHighscores(initializeDatabase())));
?>