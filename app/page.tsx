'use client';

import VideoCreator from '@/components/VideoCreator';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-slate-300/90">
            Browser Studio
          </div>
          <h1 className="text-4xl font-bold text-white sm:text-5xl">
            Create a video right in your browser
          </h1>
          <p className="max-w-2xl text-base text-slate-300 sm:text-lg">
            Craft animated title cards with color gradients, motion, and audio.
            Render them to MP4 using FFmpeg WebAssembly—no uploads required.
          </p>
        </header>

        <VideoCreator />
      </div>
    </main>
  );
}
