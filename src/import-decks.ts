import { writeFileSync as writeFile } from 'fs'
import * as chalk from 'chalk'

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
		
		console.log(chalk`{yellow Importing deck with ID} {yellow.bold ${deckId}}{yellow ...}`)
		
		try {
			await importDeck(deckId, deckData.topics)
		} catch (error) {
			console.error(error)
			continue
		}
		
		deckData.imported = true
		
		writeFile(DECKS_PATH, JSON.stringify(decks))
		
		console.log(chalk`{green Imported deck with ID} {green.bold ${deckId}}`)
	}
}

if (require.main === module)
	exports.default().catch(console.error)
