import { ManipulateType } from 'dayjs';
import config from '../../config';
import { ETUFRole } from '../consts';
import { toCanonical } from '../utils';
import { dayjs } from '../time';
import { generateSignature } from '../crypto';
import { generateTufKey, genKeyId } from './index';
import { IKeyPair, ITimestampSignedTUF, ITimestampTUF } from '../../types';


/**
 * Creates a signed tuf timestamp metadata object
 */
export const generateTimestamp = (ttl: (number|string)[], version: number, timestampKeyPair: IKeyPair, snaphostVersion: number): ITimestampTUF => {

    // generate tuf key object
    const timestampTufKey = generateTufKey(timestampKeyPair.publicKey);

    // get key id
    const timestampKeyId = genKeyId(timestampTufKey);

    console.log(dayjs().add(ttl[0] as number, ttl[1] as ManipulateType).format(config.TUF_TIME_FORMAT));
    

    // generate the signed portion of the timestamp metadata
    const signed: ITimestampSignedTUF = {
        _type: ETUFRole.Timestamp,
        expires: dayjs().add(ttl[0] as number, ttl[1] as ManipulateType).format(config.TUF_TIME_FORMAT),
        spec_version: config.TUF_SPEC_VERSION,
        version,
        meta: {
            'snapshot.json': {
                version: snaphostVersion,
                // length: toCanonical(snapshotMetadata).length,
                // hashes: {
                //     sha256: generateHash(toCanonical(snapshotMetadata), { algorithm: 'SHA256' }),
                //     sha512: generateHash(toCanonical(snapshotMetadata), { algorithm: 'SHA512' })
                // }
            }
        }
    };

    // canonicalise it
    const canonicalSigned = toCanonical(signed);

    // sign it
    const sig = generateSignature('rsa', canonicalSigned, timestampKeyPair.privateKey);

    // assemble the full metadata object and return it, phew
    return {
        signatures: [{
            keyid: timestampKeyId,
            sig
        }],
        signed
    };

}