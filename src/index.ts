import importDeck from './import-deck'

importDeck('abcdef', [])
	.then(console.log)
	.catch(console.error)
