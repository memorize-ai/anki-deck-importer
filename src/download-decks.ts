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
		
		await downloadDeck(deckId)
		
		deckData.downloaded = true
		
		writeFile(DECKS_PATH, JSON.stringify(decks))
	}
}

if (require.main === module)
	exports.default().catch(console.error)
