import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' })
  }

  const { type, message, email, metadata } = request.body

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN
  let GITHUB_REPO = process.env.GITHUB_REPO // e.g. "enoch-prince/VoxSpend"

  if (GITHUB_REPO?.includes('github.com/')) {
    GITHUB_REPO = GITHUB_REPO.split('github.com/')[1].replace('.git', '')
  }

  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    console.error('Missing GitHub configuration environment variables')
    return response.status(500).json({ message: 'Server configuration error' })
  }

  // Map types to labels
  const labelMap: Record<string, string> = {
    bug: 'bug',
    feature: 'enhancement',
    improvement: 'improvement',
    general: 'feedback'
  }

  const label = labelMap[type] || 'feedback'

  const body = `
## Feedback Details
**Category:** ${type}
**User Email:** ${email || 'Not provided'}

### Message
${message}

---
### Metadata
- **App Version:** ${metadata.version}
- **User Agent:** ${metadata.userAgent}
- **Screen Size:** ${metadata.screenSize}
- **Timestamp:** ${metadata.timestamp}
`

  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'VoxSpend-App'
      },
      body: JSON.stringify({
        title: `[Feedback] ${type.toUpperCase()}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
        body,
        labels: [label]
      })
    })

    if (!res.ok) {
      const errorData = await res.json()
      console.error('GitHub API error:', errorData)
      return response.status(res.status).json({ message: 'GitHub API error', details: errorData })
    }

    const data = await res.json()
    return response.status(201).json({ message: 'Feedback submitted successfully', url: data.html_url })
  } catch (error) {
    console.error('Error creating GitHub issue:', error)
    return response.status(500).json({ message: 'Internal Server Error' })
  }
}
