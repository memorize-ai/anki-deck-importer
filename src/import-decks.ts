import { writeFileSync as writeFile } from 'fs'

import importDeck from './import-deck'
import { DECKS_PATH } from './constants'

const decks: Record<string, {
	downloaded: boolean
	imported: boolean
	topics: string[]
}> = require(DECKS_PATH)

export default async () => {
	for (const [deckId, deckData] of Object.entries(decks)) {
		if (deckData.imported || !deckData.downloaded)
			continue
		
		console.log(`Importing deck with ID ${deckId}...`)
		
		try {
			await importDeck(deckId, deckData.topics)
		} catch (error) {
			console.error(error)
			continue
		}
		
		deckData.imported = true
		
		writeFile(DECKS_PATH, JSON.stringify(decks))
		
		console.log(`Imported deck with ID ${deckId}`)
	}
}

if (require.main === module)
	exports.default().catch(console.error)
