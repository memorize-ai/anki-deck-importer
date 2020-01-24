import * as admin from 'firebase-admin'

import { FIREBASE_ADMIN_KEY_PATH, DEFAULT_STORAGE_BUCKET } from './constants'

admin.initializeApp({
	credential: admin.credential.cert(FIREBASE_ADMIN_KEY_PATH),
	storageBucket: DEFAULT_STORAGE_BUCKET
})

export default admin

export const firestore = admin.firestore()
export const storage = admin.storage().bucket()
