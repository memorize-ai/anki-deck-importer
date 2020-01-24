import downloadDeck from './download-deck'
import importDeck from './import-deck'

;(async () => {
	const deckId = '162733352'
	
	await downloadDeck(deckId)
	await importDeck(deckId, [])
})().then(console.log).catch(console.error)
