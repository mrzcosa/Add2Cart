const hopByHopHeaders = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host', 'content-length',
])

export default async function handler(req, res) {
  const origin = process.env.ADD2CART_API_ORIGIN?.replace(/\/$/, '')
  if (!origin) {
    res.status(500).json({ error: 'The Add2Cart API origin is not configured.' })
    return
  }

  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (!hopByHopHeaders.has(name.toLowerCase()) && value !== undefined) {
      headers.set(name, Array.isArray(value) ? value.join(', ') : value)
    }
  }

  try {
    const upstream = await fetch(`${origin}${req.url}`, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
      duplex: ['GET', 'HEAD'].includes(req.method) ? undefined : 'half',
      redirect: 'manual',
    })

    res.status(upstream.status)
    upstream.headers.forEach((value, name) => {
      if (name.toLowerCase() !== 'set-cookie' && !hopByHopHeaders.has(name.toLowerCase())) res.setHeader(name, value)
    })
    const cookies = upstream.headers.getSetCookie?.() || []
    if (cookies.length) res.setHeader('Set-Cookie', cookies)
    if (req.method === 'HEAD' || upstream.status === 204 || upstream.status === 304) res.end()
    else res.end(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) {
    console.error('Add2Cart API proxy failed:', error)
    res.status(502).json({ error: 'The Add2Cart service could not be reached. Please try again.' })
  }
}
