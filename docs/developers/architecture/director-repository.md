# Director repository module

The director repository is responsible for keeping track of robots, their ECUs, which images have been installed, and other tasks.

There are four main mutations performed against it:

1. Initialisation

When a team is initialisedit will create an initial `root.json` metadata file that will be stored in the director repository using the keys that were created as part of the team creation.

2. Registering a robot

3. Registering an ECU in a robot

4. Processing a robot (vehicle) manifest

## Robots and ECUs

Constriaints (some of these may change):
- Robots contain one or more ECUs.
- There is always one and only primary per robot.
- Once assigned the primary ECU cannot be changed.

## Rollouts

Cannot be modified but may be cancelled.