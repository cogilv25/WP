<?php
require_once("error_handling.php");

function initializeDatabase()
{
	// Disables exceptions, errors can still be handled
    //   by checking the return value.
	mysqli_report(MYSQLI_REPORT_OFF);
	try
	{
		if($_SERVER['SERVER_NAME'] == "webprog.com")
			$db = new mysqli("localhost","root","","pang");
		else
			$db = new mysqli("comp-server.uhi.ac.uk","SH21010093","21010093","SH21010093");
	}
	catch(Exception $e)
	{
		setErrorAndDie($ERROR_INTERNAL);
	}

	if($db == false)
		setErrorAndDie($ERROR_INTERNAL);

	if($db->connect_error)
		setErrorAndDie($ERROR_INTERNAL);

	
	return $db;
}

// Check if the user exists and if their avatar needs updated, we don't check
//  name as this can be altered freely after initial creation in game.
function createOrUpdateUser($db, string $provider, string $uid, string $name, string $avatar) : bool
{
	// Check for User
	$query = $db->prepare("SELECT `id`, `avatar` FROM `pang_user` WHERE ".
		"`provider`=? AND `provider_uid`=?;");

	$query->bind_param("ss", $provider, $uid);
	$result = $query->execute();
	$query->store_result();
	if($result == false) return false;

	if($query->num_rows > 0)
	{
		// If user exists
		$query->bind_result($id, $oldAvatar);
		$query->fetch();
		$query->close();
		$_SESSION['user'] = $id;
		
		
		// Update Avatar if needed.
		if(strcmp($avatar, $oldAvatar) != 0)
		{
			$query = $db->prepare("UPDATE `pang_user` SET `avatar`=? WHERE `id`=" . $id);
			$query->bind_param("s", $avatar);
			$query->execute(); // We don't really need to handle this failing, not critical.
			$query->close();
		}
		return true;
	}

	// Create User
	// Name is limited to 10 characters and set to all upper case (stylistic choice).
	$query = $db->prepare("INSERT INTO `pang_user` (`name`,`provider`,`provider_uid`,`avatar`) VALUES ".
		"( UPPER(LEFT(REPLACE(?,' ',''),10)), ?, ?, ? )");
	$query->bind_param("ssss", $name, $provider, $uid, $avatar);
	$result = $query->execute();
	$_SESSION['user'] = $db->insert_id;
	$query->close();

	return $result;
}

// Returns true if the score is a new highscore and the query succeeds, otherwise false.
function insertScoreIfNewHighscore($db, $score)
{
	$id = $_SESSION['user'];

	$result = $db->query("SELECT `score` FROM `pang_highscore` WHERE `user_id`=" . $id);

	if($result == false)
		return false;

	// Create a row if this user has no highscore.
	if($result->num_rows == 0)
	{
		// This is the users first score
		return $db->query("INSERT INTO `pang_highscore` (`user_id`, `score`) VALUES " . 
			"(" . $id . "," . $score . ")");
	}

	// Update the users highscore if they have beaten it.
	if($result->fetch_row()[0] > $score)
		return false;
	else
		return $db->query("UPDATE `pang_highscore` SET `score`=" . $score .
			" WHERE " . "`user_id`=" . $id);
}

function getTopHighscores($db)
{
	$result = $db->query("SELECT `name`, `score` FROM `pang_highscore` JOIN `pang_user` ORDER BY `score` DESC LIMIT 8");

	// TODO: May not be needed, however, the behaviour of
	//       fetch_all when the query fails is undocumented.
	if($result == false) return [];
	
	return $result->fetch_all();
}
?>