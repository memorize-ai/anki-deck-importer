import * as admin from 'firebase-admin'

import { FIREBASE_ADMIN_KEY_PATH } from './constants'

admin.initializeApp({
	credential: admin.credential.cert(FIREBASE_ADMIN_KEY_PATH),
	storageBucket: 'memorize-ai-dev.appspot.com'
})

export default admin

export const firestore = admin.firestore()
export const storage = admin.storage().bucket()
