# Tasks
- [1] Basic cut the rope
- [x] Ball hits a box(frog) as win condition
- [x] Ball falls off screen is lose condition
- [x] Dynamically create rope between 2 bodies
- [x] destroy orphaned nodes
- [x] properties of rope (robust property implementation)
- [x] Realistic rope behaviour 
- [x] Stretchy rope..?

# Talking Points
- Drawing dotted line to indicate cut location, allows cutting multiple ropes at once, also moving mouse release to document allows letting go off the canvas with the intended results.
- Score count down from 1000 and add a fixed amount (500) for getting the food to the frog.
- Rope first thoughts global rope properties to define distance between nodes. Calculate required rope length from the 2 points (ax, ay), (bx, by) then divide by the distance between nodes property to get the number of nodes required. For each node n calculate the position in the form (x,y) as ((ax-bx)/nodes, (ay-by)/nodes).
- Rope "types" could be defined by giving ropes a "material" which defines the frequency and damping ratio for it's joints and the damping for it's nodes.
- First attempt, distance joints are very stretchy (maybe need to change the distance joint properties or even just the weight of the nodes), some nodes are inside other bodies which may be causing some instability. Nodes should be destroyed when orphaned.
- Fixed instability by tweaking algorithm so that node's don't spawn inside bodies (Math.floor makes the nodes evenly spaced as the step would be for a fractional number of nodes and thus inaccurate, and start at 1 so that first node is not spawned at the beginning of the rope).
- Game is immediately lost if the ball goes off screen, this is annoying so it was set to give a 200px leeway.
- It has become clear that in order to easily change the settings of the rope a more robust system is required for it's creation.. classes or just data files..?
- To remove orphaned bodies we simply check for each of the bodies on a joint we are destroying if their joint list is null after we have destroyed the joint and if so we delete them.
- Maybe it would be nice to delay the deletion of the bodies for effect
- Final settings, ideally the rope wouldn't pass through objects but this could be solved geometrically by ensuring dimensions / making rope more nodes or alternatively by disabling collision of the rope on certain geometry to simulate multiple layers.
- Lower frequencies produces more stretchy rope and damping ratio well.. dampens this effect making the rope come to rest faster.