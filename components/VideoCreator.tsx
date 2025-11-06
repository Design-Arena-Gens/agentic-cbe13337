'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import useFFmpeg from '@/hooks/useFFmpeg';
import { generateFrames } from '@/lib/generateFrames';
import { fetchFile } from '@ffmpeg/util';
import { VideoConfig } from '@/types/video';

const defaultConfig: VideoConfig = {
  width: 1080,
  height: 1920,
  duration: 6,
  fps: 30,
  title: 'Dream Big',
  subtitle: 'Create high-impact clips without leaving your browser.',
  background: 'gradient',
  gradientStart: '#0f172a',
  gradientEnd: '#6366f1',
  backgroundColor: '#0f172a',
  textColor: '#f8fafc',
  accentColor: '#22d3ee',
  fontSize: 86,
  subtitleSize: 32,
  animation: 'slide'
};

const fieldClass =
  'flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 transition hover:border-slate-700 focus-within:border-slate-500 focus-within:bg-slate-900';

const labelClass = 'text-xs font-semibold uppercase tracking-wider text-slate-400';

const inputClass =
  'w-full border-0 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500';

export default function VideoCreator() {
  const [{ ffmpeg, ready, loading }, loadFFmpeg] = useFFmpeg();
  const [config, setConfig] = useState<VideoConfig>(defaultConfig);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryCount = useRef(0);

  useEffect(() => {
    void loadFFmpeg();
  }, [loadFFmpeg]);

  const onConfigChange = useCallback(
    <K extends keyof VideoConfig>(key: K, value: VideoConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const formattedSize = useMemo(() => {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(config.width, config.height);
    return `${Math.round(config.width / divisor)}:${Math.round(config.height / divisor)}`;
  }, [config.height, config.width]);

  const reset = useCallback(() => {
    setConfig(defaultConfig);
    setAudioFile(null);
    setPreviewUrl(null);
    setStatus('Idle');
    setProgress(null);
    setError(null);
    retryCount.current = 0;
  }, []);

  const generateVideo = useCallback(async () => {
    if (!ffmpeg) {
      setError('FFmpeg not ready yet. Please wait a second and try again.');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);
      setProgress(null);
      setStatus('Preparing workspace');

      const totalFrames = Math.floor(config.duration * config.fps);
      const padLength = 5;
      const framePattern = `frame_%0${padLength}d.png`;

      // Guard against stale files
      try {
        await ffmpeg.deleteFile('output.mp4');
      } catch {
        /* noop */
      }

      for (let i = 0; i < totalFrames; i += 1) {
        try {
          await ffmpeg.deleteFile(`frame_${String(i).padStart(padLength, '0')}.png`);
        } catch {
          /* noop */
        }
      }

      const audioInputName =
        audioFile !== null
          ? `audio_input${
              audioFile.name.includes('.') ? audioFile.name.slice(audioFile.name.lastIndexOf('.')) : '.mp3'
            }`
          : null;

      if (audioInputName) {
        try {
          await ffmpeg.deleteFile(audioInputName);
        } catch {
          /* noop */
        }
      }

      setStatus('Rendering frames');
      await generateFrames({
        config,
        totalFrames,
        padLength,
        onFrame: async (index, blob) => {
          const fileName = `frame_${String(index).padStart(padLength, '0')}.png`;
          const fileData = await fetchFile(blob);
          await ffmpeg.writeFile(fileName, fileData);
          setProgress(Math.round(((index + 1) / totalFrames) * 50));
        }
      });

      if (audioInputName && audioFile) {
        setStatus('Transcoding audio');
        const audioData = await fetchFile(audioFile);
        await ffmpeg.writeFile(audioInputName, audioData);
      }

      setStatus('Encoding video');

      const command = [
        '-y',
        '-framerate',
        `${config.fps}`,
        '-i',
        framePattern
      ];

      if (audioInputName) {
        command.push('-i', audioInputName, '-shortest');
      }

      command.push(
        '-c:v',
        'libx264',
        '-profile:v',
        'main',
        '-pix_fmt',
        'yuv420p',
        '-preset',
        'medium'
      );

      if (audioInputName) {
        command.push('-c:a', 'aac', '-b:a', '192k');
      }

      command.push('output.mp4');

      await ffmpeg.exec(command);
      setProgress(90);
      setStatus('Finalizing');

      const outputData = await ffmpeg.readFile('output.mp4');
      const byteArray =
        outputData instanceof Uint8Array ? outputData : new TextEncoder().encode(outputData);
      const copy = byteArray.slice();
      const videoBlob = new Blob([copy.buffer as ArrayBuffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(videoBlob);
      setPreviewUrl((oldUrl) => {
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        return url;
      });

      setProgress(100);
      setStatus('Done');
    } catch (err) {
      retryCount.current += 1;
      const message =
        err instanceof Error ? err.message : 'Unknown error while rendering video.';
      setError(message);
      setStatus('Failed');
    } finally {
      setIsGenerating(false);
    }
  }, [audioFile, config, ffmpeg]);

  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!ready || loading) return;
      void generateVideo();
    },
    [generateVideo, loading, ready]
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
      <section className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-8 shadow-xl shadow-slate-900/40 backdrop-blur">
        <form className="flex flex-col gap-6" onSubmit={onSubmit}>
          <div className="grid gap-6 md:grid-cols-2">
            <div className={fieldClass}>
              <span className={labelClass}>Duration (seconds)</span>
              <input
                className={inputClass}
                type="number"
                min={1}
                max={14}
                value={config.duration}
                onChange={(event) => onConfigChange('duration', Number(event.target.value))}
              />
            </div>
            <div className={fieldClass}>
              <span className={labelClass}>Frame Rate</span>
              <input
                className={inputClass}
                type="number"
                min={15}
                max={60}
                value={config.fps}
                onChange={(event) => onConfigChange('fps', Number(event.target.value))}
              />
            </div>
            <div className={fieldClass}>
              <span className={labelClass}>Width</span>
              <input
                className={inputClass}
                type="number"
                min={360}
                max={1920}
                step={10}
                value={config.width}
                onChange={(event) => onConfigChange('width', Number(event.target.value))}
              />
            </div>
            <div className={fieldClass}>
              <span className={labelClass}>Height</span>
              <input
                className={inputClass}
                type="number"
                min={640}
                max={2160}
                step={10}
                value={config.height}
                onChange={(event) => onConfigChange('height', Number(event.target.value))}
              />
            </div>
          </div>

          <div className={fieldClass}>
            <span className={labelClass}>Title</span>
            <input
              className={inputClass}
              type="text"
              value={config.title}
              maxLength={90}
              onChange={(event) => onConfigChange('title', event.target.value)}
            />
          </div>

          <div className={fieldClass}>
            <span className={labelClass}>Subtitle</span>
            <textarea
              className={clsx(inputClass, 'min-h-[80px] resize-none leading-relaxed')}
              value={config.subtitle}
              maxLength={160}
              onChange={(event) => onConfigChange('subtitle', event.target.value)}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className={fieldClass}>
              <span className={labelClass}>Animation</span>
              <select
                className={clsx(inputClass, 'bg-transparent')}
                value={config.animation}
                onChange={(event) =>
                  onConfigChange('animation', event.target.value as VideoConfig['animation'])
                }
              >
                <option value="slide">Slide Up</option>
                <option value="scale">Zoom In</option>
                <option value="fade">Fade In</option>
              </select>
            </div>

            <div className={fieldClass}>
              <span className={labelClass}>Color Mode</span>
              <select
                className={clsx(inputClass, 'bg-transparent')}
                value={config.background}
                onChange={(event) =>
                  onConfigChange('background', event.target.value as VideoConfig['background'])
                }
              >
                <option value="gradient">Dynamic Gradient</option>
                <option value="solid">Solid Color</option>
              </select>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {config.background === 'gradient' ? (
              <>
                <div className={fieldClass}>
                  <span className={labelClass}>Gradient Start</span>
                  <input
                    className="h-9 w-full cursor-pointer rounded-md border border-slate-800 bg-slate-950"
                    type="color"
                    value={config.gradientStart}
                    onChange={(event) => onConfigChange('gradientStart', event.target.value)}
                  />
                </div>
                <div className={fieldClass}>
                  <span className={labelClass}>Gradient End</span>
                  <input
                    className="h-9 w-full cursor-pointer rounded-md border border-slate-800 bg-slate-950"
                    type="color"
                    value={config.gradientEnd}
                    onChange={(event) => onConfigChange('gradientEnd', event.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className={fieldClass}>
                <span className={labelClass}>Background Color</span>
                <input
                  className="h-9 w-full cursor-pointer rounded-md border border-slate-800 bg-slate-950"
                  type="color"
                  value={config.backgroundColor}
                  onChange={(event) => onConfigChange('backgroundColor', event.target.value)}
                />
              </div>
            )}

            <div className={fieldClass}>
              <span className={labelClass}>Primary Text Color</span>
              <input
                className="h-9 w-full cursor-pointer rounded-md border border-slate-800 bg-slate-950"
                type="color"
                value={config.textColor}
                onChange={(event) => onConfigChange('textColor', event.target.value)}
              />
            </div>

            <div className={fieldClass}>
              <span className={labelClass}>Accent Color</span>
              <input
                className="h-9 w-full cursor-pointer rounded-md border border-slate-800 bg-slate-950"
                type="color"
                value={config.accentColor}
                onChange={(event) => onConfigChange('accentColor', event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className={fieldClass}>
              <span className={labelClass}>Title Size</span>
              <input
                className={inputClass}
                type="number"
                min={24}
                max={140}
                value={config.fontSize}
                onChange={(event) => onConfigChange('fontSize', Number(event.target.value))}
              />
            </div>
            <div className={fieldClass}>
              <span className={labelClass}>Subtitle Size</span>
              <input
                className={inputClass}
                type="number"
                min={12}
                max={72}
                value={config.subtitleSize}
                onChange={(event) => onConfigChange('subtitleSize', Number(event.target.value))}
              />
            </div>
          </div>

          <div className={fieldClass}>
            <span className={labelClass}>Background Audio (optional)</span>
            <input
              className={inputClass}
              type="file"
              accept="audio/*"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                setAudioFile(file);
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={!ready || loading || isGenerating}
              className={clsx(
                'inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition',
                isGenerating
                  ? 'bg-slate-700 text-slate-400'
                  : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
              )}
            >
              {isGenerating ? 'Rendering…' : 'Generate video'}
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-900"
              onClick={reset}
              disabled={isGenerating}
            >
              Reset
            </button>
            <span className="text-xs text-slate-500">
              Aspect ratio preview {formattedSize} ({config.width}×{config.height})
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
            <div className="flex items-center justify-between gap-4">
              <span className="font-semibold text-slate-200">Status:</span>
              <span className="text-xs uppercase tracking-widest text-cyan-300">{status}</span>
            </div>
            {progress !== null && (
              <div className="mt-3 h-2 rounded-full bg-slate-800">
                <div
                  className="h-2 rounded-full bg-cyan-500 transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            )}
            {error && (
              <p className="mt-3 text-xs text-rose-300">
                Something went wrong: {error} — try refreshing if the issue persists.
              </p>
            )}
          </div>
        </form>
      </section>

      <aside className="flex flex-col gap-6">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/60 p-6 shadow-lg shadow-slate-900/30 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Preview</h2>
            <span className="text-xs uppercase tracking-widest text-slate-500">
              Rendered output
            </span>
          </div>
          <div className="mt-4 aspect-[9/16] w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            {previewUrl ? (
              <video
                key={previewUrl}
                className="h-full w-full object-cover"
                src={previewUrl}
                controls
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
                No render yet. Configure your shot and press Generate.
              </div>
            )}
          </div>
          {previewUrl && (
            <a
              href={previewUrl}
              download="agentic-video.mp4"
              className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white"
            >
              Download MP4
            </a>
          )}
        </div>

        <div className="rounded-3xl border border-slate-800/60 bg-slate-950/40 p-6 text-sm text-slate-300">
          <h3 className="text-base font-semibold text-white">How it works</h3>
          <ol className="mt-3 space-y-2 text-xs leading-relaxed text-slate-400">
            <li>1. Configure colors, typography, motion, and size.</li>
            <li>2. Drop in optional audio to score your clip.</li>
            <li>3. Click generate to build the animation frame-by-frame.</li>
            <li>4. Download the MP4 rendered entirely in your browser.</li>
          </ol>
        </div>
      </aside>
    </div>
  );
}
