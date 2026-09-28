import {generateKeyPairSync,randomBytes} from 'node:crypto';
const {publicKey,privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),pub=publicKey.export({format:'jwk'}),priv=privateKey.export({format:'jwk'});
console.log('VAPID_PUBLIC_KEY='+Buffer.concat([Buffer.from([4]),Buffer.from(pub.x,'base64url'),Buffer.from(pub.y,'base64url')]).toString('base64url'));
console.log('VAPID_PRIVATE_KEY='+priv.d);console.log('CRON_SECRET='+randomBytes(32).toString('hex'));console.log('VAPID_SUBJECT=mailto:YOUR_EMAIL');
