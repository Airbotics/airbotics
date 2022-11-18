import express from 'express';
import { keyStorage } from '../../core/key-storage';
import config from '../../config';
import { logger } from '../../core/logger';
import { generateKeyPair } from '../../core/crypto';
import { prisma } from '../../core/postgres';
import { TUFRepo, TUFRole } from '@prisma/client';


const router = express.Router();


/**
 * Process a manifest sent by a primary
 * 
 * If all verification checks pass, and a new image is set to be deployed onto some 
 * of the robots ecus then this creates a new set of director repo tuf metadata
 */
router.post('/:namespace/robots/:robot_id/manifests', async (req, res) => {

    const namespace_id = req.params.namespace;
    const robot_id = req.params.robot_id;
    const manifest = req.body;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not process manifest because namespace does not exist');
        return res.status(400).send('could not process manifest');
    }

    // get robot
    const robot = await prisma.robot.findUnique({
        where: {
            namespace_id_id: {
                namespace_id,
                id: robot_id
            }
        },
        include: {
            ecus: true,
            robot_manifests: true
        }
    });

    if (!robot) {
        logger.warn('could not process manifest because robot does not exist');
        return res.status(400).send('could not process manifest');
    }

    // firstly we commit the manifest to the db for archival purposes even if it fails to verify
    await prisma.robotManifest.create({
        data: {
            namespace_id,
            robot_id,
            value: manifest
        }
    });


    /**
     * now we perform an unholy amount of checks, if any of them have failed we flag 
     * this robot for review
     * 
     * checks:
     * - validate the schema is correct
     * - check the vin in the manifest is in the inventory db
     * - check all ecus on this robot in the inventory db are in the manifest
     * - check there are no additional ecus
     * - verify the top-level signature of the manifest
     * - verify every signature for all other ecus in the manifest
     * - check the nonce in each ecu has not been used before
     * - check no any attacks have been reported by the ecus
     * - check the images reported by each of the ecus correspond to the last set that were sent down
     * - probably a few more in time..
     */

    /**
     * if we get to this point we believe we have a manifest that is in good order
     * now we can inspect the images that were reported and decide what to do.
     * in airbotics, images are deployed to robots through rollouts so we consult that table.
     * if the robot is up-to-date then no new tuf metadata needs to be created, so we gracefully
     * exit and thank the primary for its time.
     */

    // NOTE: this is temporary code that will be replaced by something more substantial
    // for now we simply take the most recent rollout for this robot and apply that image to its
    // primary ecu
    const rollout = await prisma.rollout.findFirst({
        where: {
            namespace_id,
            robot_id
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    if (!rollout) {
        logger.info('processed manifest for robot but no images have been assigned to it');
        return res.status(200).end();
    }


    /**
     * if we get to this point we need to create a new set of tuf metadata for the ecus 
     * on this robot, this follows a similar pattern to creating tuf metadata in the image
     * repo when an image is pushed.
     */


    /**
     * finally, if we get here then we have created new tuf metadata which is ready for
     * the ecus the next time it requests it, which will probably be soon. that was a lot...
     */

    logger.info('processed manifest for robot and created new tuf metadata');
    return res.status(200).end();

});



/**
 * Create a robot in a namespace.
 * 
 * Creates a robot and one primary ecu for it, also creates a key pair for it,
 * we dont store the private key here but we store its public key in the key server
 * the response contains the bootstrapping credentials the primary requires to
 * provision itself with us
 */
router.post('/:namespace/robots', async (req, res) => {

    const namespace_id = req.params.namespace;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not create robot because namespace does not exist');
        return res.status(400).send('could not create robot');
    }

    // create the robot in the inventory db
    const robot = await prisma.robot.create({
        data: {
            namespace_id,
            ecus: {
                create: {
                    primary: true
                }
            }
        },
        include: {
            ecus: true
        }
    });

    // create key pair
    const primaryEcuKey = generateKeyPair(config.KEY_TYPE);

    // store the public key in the keyserver
    await keyStorage.putKey(`${robot.id}-public`, primaryEcuKey.publicKey);

    // return the credentials the primary ecu will use to provision itself
    // in the format expected by the client
    // we know the robot only has one ecu now so can safely index its array of ecus
    const response: any = {
        vin: robot.id,
        primary_ecu_serial: robot.ecus[0].id,
        public_key: primaryEcuKey.publicKey,
        namespace_id
    };

    logger.info('created a robot');
    return res.status(200).json(response);

});


/**
 * List robots in a namespace.
 */
router.get('/:namespace/robots', async (req, res) => {

    const namespace_id = req.params.namespace;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not list robots because namespace does not exist');
        return res.status(400).send('could not list robots');
    }

    // get robots
    const robots = await prisma.robot.findMany({
        where: {
            namespace_id
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    const response = robots.map(robot => ({
        id: robot.id,
        created_at: robot.created_at,
        updated_at: robot.updated_at
    }));

    return res.status(200).json(response);

});


/**
 * Get detailed info about a robot in a namespace.
 */
router.get('/:namespace/robots/:robot_id', async (req, res) => {

    const namespace_id = req.params.namespace;
    const robot_id = req.params.robot_id;

    // get robot
    const robot = await prisma.robot.findUnique({
        where: {
            namespace_id_id: {
                namespace_id,
                id: robot_id
            }
        },
        include: {
            ecus: true,
            robot_manifests: true
        }
    });

    if (!robot) {
        logger.warn('could not get info about robot because it or the namespace does not exist');
        return res.status(400).send('could not get robot');
    }

    const response = {
        id: robot.id,
        created_at: robot.created_at,
        updated_at: robot.updated_at,
        robot_manifests: robot.robot_manifests.map(manifest => ({
            id: manifest.id,
            created_at: manifest.created_at
        })),
        ecus: robot.ecus.map(ecu => ({
            id: ecu.id,
            created_at: ecu.created_at,
            updated_at: ecu.updated_at,
        }))
    };

    return res.status(200).json(response);

});


/**
 * Delete a robot
 */
router.delete('/:namespace/robots/:robot_id', async (req, res) => {

    const namespace_id = req.params.namespace;
    const robot_id = req.params.robot_id;

    // try delete robot
    try {

        await prisma.robot.delete({
            where: {
                namespace_id_id: {
                    namespace_id,
                    id: robot_id
                }
            }
        });

        logger.info('deleted a robot');
        return res.status(200).send('deleted robot');

    } catch (error) {
        // catch deletion failure error code
        // someone has tried to create a robot that does not exist in this namespace, return 400
        if (error.code === 'P2025') {
            logger.warn('could not delete a robot because it does not exist');
            return res.status(400).send('could not delete robot');
        }
        // otherwise we dont know what happened so re-throw the errror and let the
        // general error catcher return it as a 500
        throw error;
    }

});



/**
 * Create a rollout.
 * 
 * Creates an association betwen a robot and image.
 */
router.post('/:namespace/rollouts', async (req, res) => {

    const {
        robot_id,
        image_id
    } = req.body;


    const namespace_id = req.params.namespace;

    // check namespace exists
    const namespaceCount = await prisma.namespace.count({
        where: {
            id: namespace_id
        }
    });

    if (namespaceCount === 0) {
        logger.warn('could not create a rollout because namespace does not exist');
        return res.status(400).send('could not create rollout');
    }

    // check robot exists
    const robotCount = await prisma.robot.count({
        where: {
            id: robot_id
        }
    });

    if (robotCount === 0) {
        logger.warn('could not create a rollout because robot does not exist');
        return res.status(400).send('could not create rollout');
    }

    // check image exists
    const imageCount = await prisma.image.count({
        where: {
            id: image_id
        }
    });

    if (imageCount === 0) {
        logger.warn('could not create a rollout because image does not exist');
        return res.status(400).send('could not create rollout');
    }

    const rollout = await prisma.rollout.create({
        data: {
            namespace_id,
            image_id,
            robot_id
        }
    });

    const response = {
        id: rollout.id,
        image_id: rollout.image_id,
        robot_id: rollout.robot_id,
        created_at: rollout.created_at,
        updated_at: rollout.updated_at
    };

    logger.info('created rollout');
    return res.status(200).json(response);

});


/**
 * Fetch role metadata (apart from timestamp) in a namespace.
 * 
 * Timestamp is not handled with this route because it isn't prepended
 * with a dot, i.e. ``/timestamp.json`` instead not ``/1.timestamp.json``
 */
router.get('/:namespace/:version.:role.json', async (req, res) => {

    const namespace_id = req.params.namespace;
    const version = Number(req.params.version);
    const role = req.params.role;

    const metadata = await prisma.metadata.findUnique({
        where: {
            namespace_id_repo_role_version: {
                namespace_id,
                repo: TUFRepo.director,
                role: role as TUFRole,
                version
            }
        }
    });

    if (!metadata) {
        logger.warn(`could not download ${role} metadata because it does not exist`);
        return res.status(404).end();
    }

    // check it hasnt expired
    // TODO    

    return res.status(200).send(metadata.value);

});


/**
 * Fetch timestamp metadata in a namespace.
 */
router.get('/:namespace/timestamp.json', async (req, res) => {

    const namespace_id = req.params.namespace;

    // get the most recent timestamp
    const timestamps = await prisma.metadata.findMany({
        where: {
            namespace_id,
            repo: TUFRepo.director,
            role: TUFRole.timestamp
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    if (timestamps.length === 0) {
        logger.warn('could not download timestamp metadata because it does not exist');
        return res.status(404).end();
    }

    const mostRecentTimestamp = timestamps[0];

    // check it hasnt expired
    // TODO    

    return res.status(200).send(mostRecentTimestamp.value);

});


export default router;