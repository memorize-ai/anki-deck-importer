export const matchAll = (string: string, regex: RegExp) =>
	(string.match(new RegExp(regex, `g${regex.ignoreCase ? 'i' : ''}${regex.multiline ? 'm' : ''}`)) ?? [])
		.map(match => ({
			match,
			captures: match.match(regex)?.slice(1)!
		}))
		.filter(({ captures }) => captures)
