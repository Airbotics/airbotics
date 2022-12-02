import express, { Request } from 'express';
import forge from 'node-forge';
import { keyStorage } from '../../core/key-storage';
import { blobStorage } from '../../core/blob-storage';
import { logger } from '../../core/logger';
import { generateCertificate } from '../../core/crypto';
import prisma from '../../core/postgres';
import {
    RootCABucket,
    RootCACertObjId,
    RootCAPrivateKeyId,
    RootCAPublicKeyId
} from '../../core/consts';
import { ensureRobotAndNamespace } from '../../middlewares';

const router = express.Router();


/**
 * A robot is provisioning itself using the provisioning credentials.
 * 
 * - Create the robot in the db.
 * - Generate a p12 and send it back.
 * 
 * NOTE: This is the only endpoint that doesn't use the `ensureRobotAndNamespace` middleware.
 * Instead it directly pulls out the `air-client-id` header, which for this endpoint only
 * is the namespace id.
 * 
 * TODO:
 * - handle ttl
 */
router.post('/devices', async (req: Request, res) => {

    const {
        deviceId,
        ttl
    } = req.body;

    const namespace_id = req.header('air-client-id')!;

    try {
        await prisma.robot.create({
            data: {
                namespace_id,
                id: deviceId
            }
        });

    } catch (error) {
        if (error.code === 'P2002') {
            logger.warn('could not provision robot because it is already provisioned');
            return res.status(400).json({ code: 'device_already_registered' });
        }
        throw error;
    }


    const robotKeyPair = forge.pki.rsa.generateKeyPair(2048);

    // load root ca and key, used to sign provisioning cert
    const rootCaPrivateKeyStr = await keyStorage.getKey(RootCAPrivateKeyId);
    const rootCaPublicKeyStr = await keyStorage.getKey(RootCAPublicKeyId);
    const rootCaCertStr = await blobStorage.getObject(RootCABucket, RootCACertObjId) as string;
    const rootCaCert = forge.pki.certificateFromPem(rootCaCertStr);

    // generate provisioning cert using root ca as parent
    const opts = {
        commonName: deviceId,
        cert: rootCaCert,
        keyPair: {
            privateKey: forge.pki.privateKeyFromPem(rootCaPrivateKeyStr),
            publicKey: forge.pki.publicKeyFromPem(rootCaPublicKeyStr)
        }
    };
    const robotCert = generateCertificate(robotKeyPair, opts);

    // bundle into pcks12, no encryption password set
    const p12 = forge.pkcs12.toPkcs12Asn1(robotKeyPair.privateKey, [robotCert, rootCaCert], null, { algorithm: 'aes256' });

    logger.info('robot has provisioned')
    return res.status(200).send(Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'));

});


/**
 * Ingest network info reported by a robot
 */
router.put('/system_info/network', ensureRobotAndNamespace, async (req: Request, res) => {

    const {
        hostname,
        local_ipv4,
        mac
    } = req.body;

    const {
        namespace_id,
        robot_id
    } = req.robotGatewayPayload!;

    await prisma.networkReport.create({
        data: {
            namespace_id,
            robot_id,
            hostname,
            local_ipv4,
            mac
        }
    });

    logger.info('ingested robot network info');
    return res.status(200).end();
});


export default router;