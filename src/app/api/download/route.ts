import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

/**
 * GET /api/download — download the pre-built source ZIP.
 * This serves the call-source-hostinger.zip file from the project root.
 */
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'call-source-hostinger.zip')
    const data = await readFile(filePath)
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="call-source-hostinger.zip"',
        'Content-Length': String(data.length),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
