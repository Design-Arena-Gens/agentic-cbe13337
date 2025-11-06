export type VideoConfig = {
  width: number;
  height: number;
  duration: number;
  fps: number;
  title: string;
  subtitle: string;
  background: 'gradient' | 'solid';
  gradientStart: string;
  gradientEnd: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  fontSize: number;
  subtitleSize: number;
  animation: 'slide' | 'scale' | 'fade';
};
