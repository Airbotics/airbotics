import prisma from '../../core/postgres';
import {
    Namespace,
    Ecu,
    UploadStatus,
    TUFRole,
    TUFRepo
} from "@prisma/client";


const NAMESPACE_ID = 'test-namespace';
const ROBOT_ID = 'test-robot';
const PRIMARY_IMAGE_ID = 'test-primary-image';
const SECONDARY_IMAGE_ID = 'test-secondary-image';
const PRIMARY_ECU_ID = 'test-primary-ecu';
const SECONDARY_ECU_ID = 'test-secondary-ecu';
const EXPIRES_AT = '2050-01-01T12:00:00.000Z'; //lets not worry about expiry for seeder



const createNamespace = async () => {

    console.log('dev seeder creating namespace...');

    await prisma.namespace.create({
        data: {
            id: NAMESPACE_ID
        }
    });

    console.log('dev seeder created namespace');

}


const createImage = async () => {

    console.log('dev seeder creating image...');

    //The primary 'image' is simply a text file with 'primary' as the body
    //The secondary 'image' is simply a text file with 'secondary' as the body
    await prisma.image.createMany({
        data: [
            {
                id: PRIMARY_IMAGE_ID,
                namespace_id: NAMESPACE_ID,
                size: 5,
                sha256: '986a1b7135f4986150aa5fa0028feeaa66cdaf3ed6a00a355dd86e042f7fb494',
                sha512: 'fa01128f36bcb2fd0ab277bced17de734c0e4a1e022dc26ad9b85d3b64a5c7af499d3af526fa25500bd73f4b2a0886b22a1e1ff68250de496aa4d847ffe9607b',
                status: UploadStatus.uploaded
            },
            {
                id: SECONDARY_IMAGE_ID,
                namespace_id: NAMESPACE_ID,
                size: 5,
                sha256: 'c0f69e19ba252767f183158737ab1bc44f42380d2473ece23a4f276ae7c80dff',
                sha512: '7ec0750d1e26845a313bf932749748516a1ce5d65f66fb50aa051047e3a91172c1e998a756f3981e38061f1a46d02d0e9162049e3bba1cdda176c42b145370b6',
                status: UploadStatus.uploaded
            }
        ]
    });

    console.log('dev seeder created image');

}



const createRobot = async () => {

    console.log('dev seeder creating robot...');

    await prisma.robot.create({
        data: {
            id: ROBOT_ID,
            namespace_id: NAMESPACE_ID
        }
    });

    console.log('dev seeder created robot');

}


const createECUs = async () => {

    console.log('dev seeder creating ECUs...');

    await prisma.ecu.createMany({
        data: [
            {
                id: PRIMARY_ECU_ID,
                namespace_id: NAMESPACE_ID,
                robot_id: ROBOT_ID,
                provisioned: true,
                primary: true
            },
            {
                id: SECONDARY_ECU_ID,
                namespace_id: NAMESPACE_ID,
                robot_id: ROBOT_ID,
                provisioned: true,
                primary: false
            }
        ]
    });

    console.log('dev seeder created ECUs');

}


const createImageRepoMetadata = async () => {

    console.log('dev seeder creating image repo metadata...');

    await prisma.metadata.createMany({
        data: [
            {
                namespace_id: NAMESPACE_ID,
                role: TUFRole.root,
                repo: TUFRepo.image,
                version: 1,
                value: {},
                expires_at: EXPIRES_AT
            },
            {
                namespace_id: NAMESPACE_ID,
                role: TUFRole.targets,
                repo: TUFRepo.image,
                version: 1,
                value: {},
                expires_at: EXPIRES_AT
            },
            {
                namespace_id: NAMESPACE_ID,
                role: TUFRole.snapshot,
                repo: TUFRepo.image,
                version: 1,
                value: {},
                expires_at: EXPIRES_AT
            },
            {
                namespace_id: NAMESPACE_ID,
                role: TUFRole.timestamp,
                repo: TUFRepo.image,
                version: 1,
                value: {},
                expires_at: EXPIRES_AT
            }
        ]
    });

    console.log('dev seeder created image repo metadata');

}


const createTmpRollout = async () => {

    console.log('dev seeder creating tmp rollout...');


    await prisma.tmpEcuImages.createMany({
        data: [
            {
                ecu_id: PRIMARY_ECU_ID,
                image_id: PRIMARY_IMAGE_ID
            },
            {
                ecu_id: SECONDARY_ECU_ID,
                image_id: SECONDARY_IMAGE_ID
            }
        ]
    })


    console.log('dev seeder created tmp rollout');


}


(async () => {

    await createNamespace();
    await createImage();
    await createRobot();
    await createECUs();
    await createImageRepoMetadata();
    await createTmpRollout();

})()


