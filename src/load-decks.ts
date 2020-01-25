import { writeFileSync as writeFile } from 'fs'
import fetch from 'node-fetch'

import { TOPICS_PATH, DECKS_PATH } from './constants'

const decks: Record<string, {
	downloaded: boolean
	imported: boolean
	topics: string[]
}> = require(DECKS_PATH)

export default async (topics: Record<string, string[]> = loadTopics(require(TOPICS_PATH))) => {	
	for (const [name, topicIds] of Object.entries(topics)) {
		const match = (await (await fetch(`https://ankiweb.net/shared/decks/${name}`)).text())
			.match(/shared\.files\s=\s(\[.*\]?);/)
		
		if (!match) {
			console.error(`Unable to load decks for topic ${name}`)
			continue
		}
		
		const deckIds: string[] = JSON.parse(match[1])
			.map(([deckId]: [number]) => deckId.toString())
		
		for (const deckId of deckIds)
			addDeck(deckId, topicIds)
		
		delete topics[name]
	}
	
	return topics
}

const loadTopics = (topics: Record<string, string[]>) => {
	const acc: Record<string, string[]> = {}
	
	for (const name of ([] as string[]).concat(...Object.values(topics)))
		for (const [topicId, names] of Object.entries(topics))
			if (names.includes(name))
				acc[name] = [...acc[name] ?? [], topicId]
	
	return acc
}

const addDeck = (deckId: string, topicIds: string[]) => {
	const existingDeck = decks[deckId]
	
	existingDeck
		? existingDeck.topics = [...new Set([...existingDeck.topics, ...topicIds])]
		: decks[deckId] = {
			downloaded: false,
			imported: false,
			topics: topicIds
		}
	
	writeFile(DECKS_PATH, JSON.stringify(decks))
}

if (require.main === module)
	exports.default().then(console.log).catch(console.error)
