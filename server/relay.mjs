#!/usr/bin/env node
/**
 * POSMerahPutih — Relay WebSocket LAN (Milestone 4)
 *
 * Server ringan tanpa dependensi (native `ws`-less, pakai modul `http` + upgrade
 * manual) untuk menyiarkan event real-time antar-perangkat dalam satu jaringan
 * lokal: Tablet Kasir <-> Kitchen Display <-> Self-Order <-> Monitor TV.
 *
 * Menggantikan BroadcastChannel (yang hanya sekelas origin/perangkat) agar
 * sinkronisasi berjalan lintas-perangkat di LAN — tetap 100% offline dari internet.
 *
 * Jalankan:  node server/relay.mjs   (atau `npm run relay`)
 * Default:   ws://0.0.0.0:7071
 */
import http from 'node:http'
import crypto from 'node:crypto'

const PORT = Number(process.env.RELAY_PORT ?? 7071)
const HOST = process.env.RELAY_HOST ?? '0.0.0.0'
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

/** @type {Set<import('node:net').Socket>} */
const clients = new Set()

function send(socket, data) {
  const payload = Buffer.from(data)
  const len = payload.length
  let header
  if (len < 126) {
    header = Buffer.from([0x81, len])
  } else if (len < 65536) {
    header = Buffer.alloc(4)
    header[0] = 0x81
    header[1] = 126
    header.writeUInt16BE(len, 2)
  } else {
    header = Buffer.alloc(10)
    header[0] = 0x81
    header[1] = 127
    header.writeBigUInt64BE(BigInt(len), 2)
  }
  socket.write(Buffer.concat([header, payload]))
}

/** Decode satu frame teks WebSocket (client selalu mengirim frame ter-mask). */
function decodeFrame(buf) {
  if (buf.length < 2) return null
  const len = buf[1] & 0x7f
  let offset = 2
  let payloadLen = len
  if (len === 126) {
    payloadLen = buf.readUInt16BE(2)
    offset = 4
  } else if (len === 127) {
    payloadLen = Number(buf.readBigUInt64BE(2))
    offset = 10
  }
  const mask = buf.slice(offset, offset + 4)
  offset += 4
  const data = buf.slice(offset, offset + payloadLen)
  const out = Buffer.alloc(payloadLen)
  for (let i = 0; i < payloadLen; i++) out[i] = data[i] ^ mask[i % 4]
  return out.toString('utf8')
}

const server = http.createServer((req, res) => {
  // Health check sederhana.
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ service: 'posmerahputih-relay', clients: clients.size }))
})

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key']
  if (!key) {
    socket.destroy()
    return
  }
  const accept = crypto.createHash('sha1').update(key + WS_MAGIC).digest('base64')
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  )

  clients.add(socket)
  console.log(`[relay] client terhubung (total ${clients.size})`)

  socket.on('data', (buf) => {
    const msg = decodeFrame(buf)
    if (msg == null) return
    // Rebroadcast ke SEMUA klien lain dalam LAN.
    for (const c of clients) {
      if (c !== socket && !c.destroyed) send(c, msg)
    }
  })

  const cleanup = () => {
    clients.delete(socket)
    console.log(`[relay] client terputus (total ${clients.size})`)
  }
  socket.on('close', cleanup)
  socket.on('error', cleanup)
})

server.listen(PORT, HOST, () => {
  console.log(`[relay] POSMerahPutih relay aktif di ws://${HOST}:${PORT}`)
})
