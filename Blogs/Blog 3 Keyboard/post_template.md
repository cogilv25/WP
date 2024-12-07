In game development it is common to need to know the state of multiple keyboard keys every frame to perform actions like moving the character, however, the way the browser provides information to the application about this is through the registration of event callbacks. The simplest solution to this problem is to create callbacks for the up and down events and maintain a collection of booleans as such:

[figure]

This is simple and works fine but what if we have multiple keys that do the same thing? Our options are to check for multiple booleans in our game logic for all the keys that do a certain action or maintain a collection of booleans that represent different actions that the player wishes to perform and handle the mapping between keys in our callback. Neither of these options is particularly elegant nor reusable, so how about we introduce the concept of an input map:

[figure]

This structure maps collections of key inputs to actions which our callback can then iterate through and update the state of our booleans very succinctly, finally, we will package this into an initializeKeyboard function that takes an input map as it's argument and a global keyboardState object which maintains the state of our named inputs. We can now initialize the keyboard with a single call and perform actions each frame based on the state of the keyboard:

[figure]

Brilliant! This solves our primary case, however, what happens if we want a user to be able to press a key and say a door opens or closes depending on it's state, well, the door would toggle between open and close each frame meaning the user has to press the key for exactly one frame in order to get the expected behaviour! We could solve this by creating a second callback for the down event or tracking when the state changes in our game logic, but our callback already has this information so why not extend it to allow registering of callbacks for individual actions? We add three objects to store our callbacks and a registration function that takes the type of callback, the action to apply it to and the callback itself:

[figure]

Occasionally you may want a callback that fires for any action, such as for debugging purposes, and this can easily be supported by adding another registration function, three overrideable functions, and modifying the main callback to call these where appropriate:

[figure]

At this point we have a pretty solid data-driven solution that works well, however, we have some global state that doesn't need to be global so let's move everything in to the initialization function except the keyboardState and registration functions, but, wait, our registration functions need to access the objects storing our callbacks which are now in the initializeKeyboard function! Here we can use a little magic and assign the registration functions to anonymous functions within the initializeKeyboard function when it is called so they have access to the variables they need:

[figure]

The final solution is self-contained, extensible and easy to use, however, this level of abstraction is not free, it will certainly cost us some performance but, in simple games it serves a useful role in reducing development time.