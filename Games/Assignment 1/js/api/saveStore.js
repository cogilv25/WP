// Checks if localStorage is available as this can be disabled by users.
//   We create saveStore as an interface so we don't have to check every
//   time we want to use it.

"use strict"
var saveStore;

try
{
  saveStore = window.localStorage;
  saveStore.setItem("test", "test");
  saveStore.removeItem("test");
}
catch (e)
{
  //If localStorage is not available we make stub functions
  // so that the game can continue blissfully unaware.
  saveStore = {
    getItem: (k) => { return null; },
    setItem: (k, v) => { },
    removeItem: (k) => { } 
  };

  // Note: Technically we could get an exception for running out of storage
  // and this code would not detect that, however we are using a few bytes
  // per local user so this really isn't a concern!
}