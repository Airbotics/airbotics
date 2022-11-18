import crypto, { createSign } from 'crypto';

/**
 * Generates an RSA signature.
 */
const generateRsaSignature = (toSign: string, privateKey: string): string => {

    const signer = createSign('RSA-SHA256');
    signer.write(toSign, 'utf-8');
    signer.end();

    return signer.sign({
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
    }, 'hex');

}


/**
 * Signs a string using a private key.
 */
export const generateSignature = (keyType: 'rsa', toSign: string, privateKey: string): string => {
    switch (keyType) {
        case 'rsa': return generateRsaSignature(toSign, privateKey);
        default: throw new Error('unsupported signature');
    }
}