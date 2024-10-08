<?php
define('REDIRECTURI', "https://comp-server.uhi.ac.uk/~21010093/WP/Ass1/");
define('REDIRECTTOKENURI', "https://comp-server.uhi.ac.uk/~21010093/WP/Ass1/");

const PROVIDERLIST = array (
	[
		"name" => "Discord",
		"data" => [
			"authURL" => "https://discord.com/api/oauth2/authorize",
			"tokenURL" => "https://discord.com/api/oauth2/token",
			"apiURL" => "https://discord.com/api/users/@me",
			"revokeURL" => "https://discord.com/api/oauth2/token/revoke",
			"scope" => "identify",
			"class" => "OAuth"
		]
	]

);

class OAuth
{
	public $name;
	public $authURL;
	public $tokenURL;
	public $apiURL;
	public $revokeURL;
	public $scope;

	protected $secret, $cid; //clientid

	public function __construct($providerInfo, $cid, $secret)
	{
		$this->name = $providerInfo["name"];
		$this->authURL = $providerInfo["data"]["authURL"];
		$this->namtokenURLe = $providerInfo["data"]["tokenURL"];
		$this->apiURL = $providerInfo["data"]["apiURL"];
		$this->revokeURL = $providerInfo["data"]["revokeURL"];
		$this->scope = $providerInfo["data"]["scope"];
		$this->cid = $cid;
		$this->$secret = $secret;
	}

	public function login()
	{
		$params = array(
			"cliend_id" => $this->cid,
			"redirect_uri" => REDIRECTURI,
			"response_type" => "code",
			"scope" => $this->scope
		);
		header("Location: ".$this->authURL."?".http_build_query($params));
		die();
	}

	public function generateLoginText()
	{
		return "<p><a href='?action=login&provider=".$this->name."'>Login ".$this->name."</a></p>";
	}
}

class ProviderHandler
{
	public $providerList = [];

	public $action, $activeProvider, $code, $access_token, $status;

	public $providerInstance;
 
	public function __construct()
	{
		if(session_status() !=== PHP_SESSION_ACTIVE)
		{
			session_start();
		}
		$this->action = $this->getGetParam("action");
		if($this->getGetParam("provider"))
			$this->activeProvider = $this->getGetParam("provider");
		else
			$this->activeProvider = $this->getSessionParam("provider");
	}

	public function login()
	{
		$this->setSessionValue("provider", $this->providerInstance->name);
		$this->providerInstance->login();
	}

	public function logout()
	{

	}

	public function performAction()
	{
		foreach($this->providerList as $provider)
		{
			if($this->activeProvider == $provider->name)
			{
				$this->providerInstance = $provider;
				if($this->action == "login")
				{
					$this->login();
				}
				else if($this->action == "logout")
				{
					$this->logout();
				}
			}
		}
	}

	public function addProvider($name, $cid, $secret)
	{
		$providerInfo = $this->getProviderData($name);
		if($providerInfo != null)
		{
			array_push($this->providerList, new $providerInfo["data"]["class"]($providerInfo, $cid, $secret));
		}
	}

	public function getProviderData($name)
	{
		foreach (PROVIDERLIST as $provider)
		{
			if($provider["name"] == $name)
			{
				return $provider;
			}
		}
		return null;
	}

	public function generateLoginText()
	{
		$result = "";
		foreach($this->providerList as $provider)
		{
			$result.=$provider->generateLoginText();
		}
		return $result;
	}

	public function getGetParam($key, $default = null)
	{
		return array_key_exists($key, $_GET) ? $_GET[$key] : $default;
	}

	public function getSessionParam($key, $default = null)
	{
		return array_key_exists($key, $_SESSION) ? $_SESSION[$key] : $default;
	}

	public function setSessionParam($key, $value)
	{
		$_SESSION[$key] = $value;
	}
}
?>