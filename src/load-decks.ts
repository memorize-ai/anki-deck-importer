import { writeFileSync as writeFile } from 'fs'

import { TOPICS_PATH, DECKS_PATH } from './constants'
import { request } from './helpers'

const decks: Record<string, {
	downloaded: boolean
	imported: boolean
	topics: string[]
}> = require(DECKS_PATH)

export default async (topics: Record<string, string[]> = loadTopics(require(TOPICS_PATH))) => {
	const topicEntries = Object.entries(topics)
	const numberOfTopics = topicEntries.length
	let i = 0
	
	for (const [name, topicIds] of topicEntries) {
		const { body } = await request(`https://ankiweb.net/shared/decks/${name}`)
		const match = body?.match(/shared\.files\s=\s(\[.*\]?);/)
		
		if (!match) {
			console.error(`Unable to load decks for topic "${name}" (${++i}/${numberOfTopics})`)
			continue
		}
		
		const deckIds: string[] = JSON.parse(match[1])
			.map(([deckId]: [number]) => deckId.toString())
		
		for (const deckId of deckIds)
			addDeck(deckId, topicIds)
		
		delete topics[name]
		
		console.log(`Loaded decks for topic "${name}" (${++i}/${numberOfTopics})`)
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
			topics: [...new Set(topicIds)]
		}
	
	writeFile(DECKS_PATH, JSON.stringify(decks))
}

if (require.main === module) {
	const input = process.argv.length === 3
		? undefined
		: process.argv[2]
	
	exports.default(input && JSON.parse(input))
		.then((topics: Record<string, string[]>) =>
			console.log(JSON.stringify(topics))
		)
		.catch(console.error)
}
