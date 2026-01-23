import type { APIRoute } from 'astro'
import { PathMapper } from '../../utils/path-mapper/path-mapper'

export const prerender = false

function normalizePermalink(permalink: string): string {
  const trimmed = permalink.trim()
  if (trimmed === '' || trimmed === '/') return '/'
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

export const GET: APIRoute = async () => {
  try {

    const mapper = await PathMapper.getInstance({ contentDir: 'src/content/blog' })
    const allFiles = mapper.getAllFiles()




    const nodes: Array<{
      id: string
      text: string
      visited: boolean
      nodeType: 'article' | 'tag'
      tags?: string[]
    }> = []

    const tagSet = new Set<string>()

    // 1. Create Article Nodes
    for (const file of allFiles) {
      if (file.permalink !== undefined && file.permalink !== null) {
        const id = normalizePermalink(file.permalink)
        const tags = file.tags || []

        nodes.push({
          id,
          text: file.title || id || 'Home',
          visited: false,
          nodeType: 'article',
          tags
        })

        tags.forEach(tag => tagSet.add(tag))


      }
    }

    // 2. Create Tag Nodes
    for (const tag of tagSet) {
      nodes.push({
        id: `/tags/${tag}/`, // Use pseudo-path for ID
        text: `#${tag}`,
        visited: false,
        nodeType: 'tag'
      })
    }



    const links: Array<{
      source: string;
      target: string;
      linkType: 'reference' | 'tag'
    }> = []

    // Map for quick lookup to ensure link targets exist
    const nodeIdSet = new Set(nodes.map(n => n.id))

    for (const file of allFiles) {
      if (file.permalink === undefined || file.permalink === null) continue

      const source = normalizePermalink(file.permalink)

      // 3. Article Reference Links
      for (const targetPermalink of file.forwardLinks) {
        const target = normalizePermalink(targetPermalink)
        if (nodeIdSet.has(target)) {
          links.push({
            source,
            target,
            linkType: 'reference'
          })
        }
      }

      // 4. Tag Links
      const tags = file.tags || []
      for (const tag of tags) {
        const target = `/tags/${tag}/`
        if (nodeIdSet.has(target)) {
          links.push({
            source,
            target,
            linkType: 'tag'
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
