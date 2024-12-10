An unavoidable problem when developing a game where a continuous open world is desired is if the world is larger than can reasonably be rendered in the viewport. This problem is not insurmountable however, only requiring fairly basic maths, unless of course we are discussing 3D where in we would have to introduce the concepts of quaternions and 4x4 Matrices, but I will spare you for today and deal only in 2D! We will discuss here a simple solution, there is also an accompanying video (link at the bottom) that shows the concepts discussed in action.

Ok so where do we start? The simplest thing we might want to do is follow the players entity (object in the game world) around. The simplest way to do this is to calculate an x and y value that if added to the entities position would place them in the centre of the viewport, and then apply this to all objects in the world. In our case our viewport is 800 pixels wide by 600 pixels tall so we want the entity to be placed at position (400, 300). Here is a code snippet that calculates the translation required and applies it to every entity in the world:

[figure]

The maths is really quite simple, the harder part is understanding that we need to move the world around the player rather than moving the player within the world as seems more logical, although once this clicks the rest is easy! A possible issue arises, when the player goes to the edge of the world the camera looks outside of the bounds of the world, which is probably not what we want in most cases.

[figure]

Additionally we may want to change the entity that we are looking at or even set a fixed position in the world at times. We will add a camera object that has a target entity, position, and, minimum and maximum positions. Currently it will always follow the player entity but this could be changed to another entity during gameplay or set to null and an if statement inserted to render at whatever position the camera is set to:

[figure]

This code is basically the same as the original version but it can no longer go outside of the bounds of the game (as shown in the video) this works simply by calculating the min x, min y, max x and max y and clamping the cameras position between these values. What we have now is completely usable and doesn't really need any more changes, however, this is where you can unleash your creativity! I will present a simple example of how you could adjust this camera to move more smoothly, especially when the target is changed:

[figure]

So in this example the camera moves towards its target on each frame by some factor of the distance between them rather than sticking absolutely to the player, the factor and maxSpeed can be adjusted to create different characteristics, visual effects can be applied to create a sensation of speed, mouse input could be incorporated, really the sky is the limit here! That's all I have for today so please take a look at the video to see a live demonstration! youtube.com/poop.