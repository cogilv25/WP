<?php 
	//TODO: Error Handling
	//TODO: Remove debug code
	//TODO: Refactor
	session_start();
	define('REDIRECT_URI', "https://comp-server.uhi.ac.uk/~21010093/WP1?action=login&provider=");
	define('DEFAULT_AVATAR', "./assets/oauth/default_profile.png");
	require("OAuth2Providers.php");
	require("database.php");


	function useToken($providerName, $token)
	{
		if(!array_key_exists($providerName, OAUTH2_PROVIDERS))
			return false;

		$provider = OAUTH2_PROVIDERS[$providerName];

		// TODO: Remove local debug code
		if($_SERVER['SERVER_NAME'] == "webprog.com")
			return createOrUpdateUser(initializeDatabase(), $providerName, $token, "BlubberFish", DEFAULT_AVATAR);

		$headers = [
			'Content-Type: application/x-www-form-urlencoded',
			"Accept: application/json",
			"Authorization: Bearer " . $token
		];

		$curl = curl_init($provider['apiURL']);
		curl_setopt($curl, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
		curl_setopt($curl, CURLOPT_RETURNTRANSFER, TRUE);
		curl_setopt($curl, CURLOPT_USERAGENT, "curl");
		curl_setopt($curl, CURLOPT_POST, false);
		curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);

		$result = json_decode(curl_exec($curl), true);

		// TODO: error handling
		if(isset($result['error'])) return false;

		$unique_identifier = $result[$provider['unique']];
		$name = $result[$provider['name']];
		$avatar_link = "";
		foreach ($provider['avatar'] as $term)
		{
			// If one of the terms exists in the result but
			// is set to null then the user has no avatar.
			if(!isset($result[$term])){
				if(array_key_exists($term, $result)){
					$avatar_link = DEFAULT_AVATAR;
					break;
				}
			}

			$avatar_link .= $result[$term] ?? $term;
		}
		return createOrUpdateUser(initializeDatabase(), $providerName, $unique_identifier, $name, $avatar_link);
	}

	function attemptAuthorization()
	{
		if(isset($_SESSION['provider']))
		{
			if(isset($_SESSION['token']))
			{
				if(useToken($_SESSION['provider'], $_SESSION['token']))
					return true;
			}

			session_unset();
			return false;
		}

		if(!isset($_GET['provider']))
			return false;

		if(isset($_GET['code']))
			return authorize($_GET['provider'], $_GET['code']);

		header("Location: " . generateAuthLink($_GET['provider']));
		die();
	}

	function authorize($providerName, $code)
	{
		$provider = OAUTH2_PROVIDERS[$providerName];
		$headers = [
			'Content-Type: application/x-www-form-urlencoded',
			"Accept: application/json"
		];

		$params = [
			'grant_type' => 'authorization_code',
			'redirect_uri' => REDIRECT_URI . $providerName,
			'code' => $code,
			'client_id' => $provider['client_id'],
			'client_secret' => $provider['client_secret']
		];

		$curl = curl_init($provider['tokenURL']);
		curl_setopt($curl, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
		curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($curl, CURLOPT_FOLLOWLOCATION, true);
		curl_setopt($curl, CURLOPT_VERBOSE, true);
		curl_setopt($curl, CURLOPT_USERAGENT, $_SERVER['HTTP_USER_AGENT']);
		curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
		curl_setopt($curl, CURLOPT_POST, true);
		curl_setopt($curl, CURLOPT_POSTFIELDS, http_build_query($params));

		$result = json_decode(curl_exec($curl));


		if(!isset($result->access_token))
			return false;


		$_SESSION['token'] = $result->access_token;
		$_SESSION['provider'] = $_GET['provider'];

		// Refresh to remove the get variables, not strictly necessary
		// but looks better in my opinion.
		header("Location: " . strtok($_SERVER["REQUEST_URI"],'?'));
		die();
	}

	function generateAuthLink($providerName)
	{
		if($_SERVER['SERVER_NAME'] == "webprog.com")
		{
			$_SESSION['token'] = "Test";
			$_SESSION['provider'] = $providerName;
			return "?action=login&provider=" . $providerName;
		}

		$provider = OAUTH2_PROVIDERS[$providerName];

		if($provider == null)
			return "./";

		$params = [
			"client_id" => $provider['client_id'],
			"redirect_uri" => REDIRECT_URI . $providerName,
			"response_type" => "code",
			"scope" => $provider['scope']
		];

		return $provider['authURL'] . '?' . http_build_query($params);
	} 

	function logout()
	{
		session_unset();
		header("Location: ./");
		die();
	}
?>