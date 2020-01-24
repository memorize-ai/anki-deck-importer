# memorize.ai Anki deck importer

**[memorize.ai](https://memorize.ai)**

## Load topics

```zsh
npm run load-topics
```

## Load decks

```zsh
npm run load-decks
```

## Download decks

```zsh
npm run download-decks
```

## Import decks

```zsh
npm run import-decks
```

## `products/decks.json`

```json
{
	"DECK_ID": {
		"downloaded": true,
		"imported": true,
		"topics": [
			"TOPIC_ID"
		]
	}
}

```

## `products/topics.json`

```json
{
	"TOPIC_ID": [
		"TOPIC_NAME"
	]
}
```

## `products/decks/{DECK_ID}`

```
main.apkg
```
