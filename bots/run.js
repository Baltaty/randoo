#!/usr/bin/env node
/**
 * Randoo bot runner — local
 *
 * Usage:
 *   node run.js [count] [url]
 *
 * Examples:
 *   node run.js          → 1 bot on https://randoo.fun/chat
 *   node run.js 3        → 3 bots
 *   node run.js 2 local  → 2 bots on http://localhost:3000/chat
 */

const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

// ── Config ───────────────────────────────────

const BOT_COUNT  = parseInt(process.argv[2] ?? '1', 10)
const TARGET_ARG = process.argv[3] ?? ''
const BASE_URL   = TARGET_ARG === 'local'
  ? 'http://localhost:3000'
  : 'https://randoo.fun'
const CHAT_URL   = `${BASE_URL}/chat?bot=1`

const VIDEOS_DIR = path.join(__dirname, 'videos')

// How long a bot stays in a match before pressing Next (ms)
const MIN_STAY = 20_000
const MAX_STAY = 60_000

// How long to wait for a match before reloading (ms)
const MATCH_TIMEOUT = 3 * 60_000

// ── Video helpers ─────────────────────────────

function listSourceVideos() {
  return fs.readdirSync(VIDEOS_DIR)
    .filter(f => /\.(mp4|mov|mkv)$/i.test(f))
    .map(f => path.join(VIDEOS_DIR, f))
}

/**
 * Convert a video to Y4M — the only format Chromium accepts for
 * --use-file-for-fake-video-capture. Y4M is uncompressed so files
 * are large; we cap clips at 30s and use 640x480 @ 15fps.
 */
function toY4m(inputPath) {
  const y4mPath = inputPath.replace(/\.[^.]+$/, '.y4m')
  if (fs.existsSync(y4mPath)) return y4mPath

  console.log(`  ▶ Converting ${path.basename(inputPath)} to Y4M…`)
  const result = spawnSync('ffmpeg', [
    '-y', '-i', inputPath,
    '-vf', 'scale=640:480',
    '-r', '15',
    '-t', '30',
    y4mPath,
  ], { stdio: 'inherit' })

  if (result.status !== 0) {
    throw new Error(`ffmpeg failed for ${inputPath}. Is ffmpeg installed? (brew install ffmpeg)`)
  }
  return y4mPath
}

// ── Bot logic ─────────────────────────────────

async function runBot(videoPath, id) {
  const tag = `[bot-${id}]`
  console.log(`${tag} Starting — video: ${path.basename(videoPath)}`)

  const profileDir = path.join(__dirname, `.profile-bot-${id}`)

  const ctx = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: [
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${videoPath}`,
      '--use-fake-ui-for-media-stream',   // auto-accept camera/mic prompts
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
    ],
    permissions: ['camera', 'microphone'],
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  })

  const page = ctx.pages()[0] ?? await ctx.newPage()

  // Initial navigation
  await page.goto(CHAT_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  console.log(`${tag} Page loaded — entering queue loop`)

  while (true) {
    try {
      console.log(`${tag} Waiting for match…`)

      // Remote video (unmuted) gets a srcObject when matched & streaming
      await page.waitForFunction(() => {
        const videos = [...document.querySelectorAll('video')]
        return videos.some(v => v.srcObject !== null && !v.muted)
      }, { timeout: MATCH_TIMEOUT })

      const stayMs = MIN_STAY + Math.random() * (MAX_STAY - MIN_STAY)
      console.log(`${tag} Matched! Staying ${Math.round(stayMs / 1000)}s`)
      await page.waitForTimeout(stayMs)

      // Escape = Next (rejoins queue without page reload)
      await page.keyboard.press('Escape')
      console.log(`${tag} → Next`)

      // Wait for remote video src to clear before looking for next match
      await page.waitForFunction(() => {
        const videos = [...document.querySelectorAll('video')]
        return videos.every(v => v.muted || v.srcObject === null)
      }, { timeout: 10_000 }).catch(() => {})

      await page.waitForTimeout(1000 + Math.random() * 1000)

    } catch (err) {
      console.warn(`${tag} ⚠ ${err.message} — reloading…`)
      await page.waitForTimeout(4000).catch(() => {})
      await page.goto(CHAT_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {})
    }
  }
}

// ── Entry point ───────────────────────────────

async function main() {
  // Check ffmpeg
  const ff = spawnSync('ffmpeg', ['-version'], { stdio: 'pipe' })
  if (ff.status !== 0) {
    console.error('ffmpeg not found. Install it with: brew install ffmpeg')
    process.exit(1)
  }

  const sources = listSourceVideos()
  if (!sources.length) {
    console.error(`No video files found in bots/videos/\nAdd some MP4 files then re-run.`)
    process.exit(1)
  }

  console.log(`\n🎬 Found ${sources.length} video(s). Converting to Y4M if needed…`)
  const y4ms = sources.map(toY4m)

  console.log(`\n🤖 Launching ${BOT_COUNT} bot(s) → ${CHAT_URL}\n`)
  const tasks = Array.from({ length: BOT_COUNT }, (_, i) =>
    runBot(y4ms[i % y4ms.length], i + 1)
  )

  await Promise.all(tasks)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
