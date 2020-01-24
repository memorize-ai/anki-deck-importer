import { writeFileSync as writeFile } from 'fs'
import { firestore } from './firebase-admin'

import { TOPICS_PATH } from './constants'

export default async () => {
	const { docs } = await firestore.collection('topics').get()
	
	const topics = docs.reduce((acc, doc) => ({
		...acc,
		[doc.id]: [doc.get('name')]
	}), {})
	
	writeFile(TOPICS_PATH, JSON.stringify(topics, null, '\t'))
	
	return topics
}

if (require.main === module)
	exports.default().then(console.log).catch(console.error)
