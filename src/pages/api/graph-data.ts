import type { APIRoute } from 'astro'
import { PathMapper } from '../../utils/path-mapper/path-mapper'

export const prerender = false

function normalizePermalink(permalink: string): string {
  const trimmed = permalink.trim()
  if (trimmed === '' || trimmed === '/') return '/'
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash
}

export const GET: APIRoute = async () => {
  try {
    console.log('[Graph API] Building data...')
    const mapper = await PathMapper.getInstance({ contentDir: 'src/content/blog' })
    const allFiles = mapper.getAllFiles()
    console.log('[Graph API] Got', allFiles.length, 'files')

    const nodes: Array<{
      id: string
      text: string
      visited: boolean
    }> = []

    for (const file of allFiles) {
      if (file.permalink !== undefined && file.permalink !== null) {
        const id = normalizePermalink(file.permalink)
        nodes.push({
          id,
          text: file.title || id || 'Home',
          visited: false,
        })
        if (nodes.length <= 10) {
          console.log('[Graph API] Node:', nodes.length, '- id:', file.permalink, '- title:', file.title)
        }
      }
    }
    console.log('[Graph API] Total nodes:', nodes.length)

    const links: Array<{ source: string; target: string }> = []
    const permalinkToTitle = new Map(nodes.map((n) => [n.id, n.text]))

    for (const file of allFiles) {
      if (file.permalink === undefined || file.permalink === null) continue

      const source = normalizePermalink(file.permalink)

      for (const targetPermalink of file.forwardLinks) {
        const target = normalizePermalink(targetPermalink)
        if (permalinkToTitle.has(target)) {
          links.push({
            source,
            target,
          })
        }
      }
    }

    return new Response(
      JSON.stringify({ nodes, links }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      },
    )
  } catch (error) {
    console.error('[Graph API] Error generating graph data:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to generate graph data',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
