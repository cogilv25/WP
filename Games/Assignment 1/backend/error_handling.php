<?php

$ERROR_LOGGED_OUT =    ['status' => 401, 'message' => 'Access Denied!'];
$ERROR_NOT_ADMIN =     ['status' => 403, 'message' => 'Request Denied!'];
$ERROR_INVALID_DATA =  ['status' => 400, 'message' => 'Invalid Data!'];
$ERROR_MISSING_DATA =  ['status' => 400, 'message' => 'Incomplete Request!'];
$ERROR_INTERNAL =      ['status' => 500, 'message' => 'Unknown Error!'];
$ERROR_TEST =          ['status' => 500, 'message' => 'Test!'];

function setErrorAndDie($error)
{
	http_response_code($error['status']);
	die($error['message']);
}

?>