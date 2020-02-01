import { writeFileSync as writeFile } from 'fs'

import downloadDeck from './download-deck'
import { DECKS_PATH } from './constants'

const decks: Record<string, {
	downloaded: boolean
	imported: boolean
	topics: string[]
}> = require(DECKS_PATH)

export default async () => {
	for (const [deckId, deckData] of Object.entries(decks)) {
		if (deckData.downloaded)
			continue
		
		try {
			await downloadDeck(deckId)
		} catch (error) {
			if (error.message === '"k" query parameter not found') {
				delete decks[deckId]
				writeFile(DECKS_PATH, JSON.stringify(decks))
				
				continue
			}
			
			throw error
		}
		
		deckData.downloaded = true
		
		writeFile(DECKS_PATH, JSON.stringify(decks))
		
		console.log(`Downloaded deck with ID ${deckId}`)
	}
}

if (require.main === module)
	exports.default().catch(console.error)
