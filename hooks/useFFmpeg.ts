'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const CORE_VERSION = '0.12.6';

export default function useFFmpeg() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (ready || loading) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    setLoading(true);
    if (!ffmpegRef.current) {
      ffmpegRef.current = new FFmpeg();
    }
    const ffmpeg = ffmpegRef.current;
    const baseUrl = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist`;
    await ffmpeg!.load({
      coreURL: await toBlobURL(`${baseUrl}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseUrl}/ffmpeg-core.wasm`, 'application/wasm'),
      workerURL: await toBlobURL(`${baseUrl}/ffmpeg-core.worker.js`, 'text/javascript')
    });
    setReady(true);
    setLoading(false);
  }, [loading, ready]);

  const result = useMemo(
    () => ({
      ffmpeg: ffmpegRef.current,
      ready,
      loading
    }),
    [loading, ready]
  );

  return [result, load] as const;
}
