import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AudioSettingsContextType {
  silenceThreshold: number;
  setSilenceThreshold: (val: number) => void;
  silenceDurationMs: number;
  setSilenceDurationMs: (val: number) => void;
}

const AudioSettingsContext = createContext<AudioSettingsContextType | undefined>(undefined);

export function AudioSettingsProvider({ children }: { children: ReactNode }) {
  const [silenceThreshold, setSilenceThreshold] = useState(0.03);
  const [silenceDurationMs, setSilenceDurationMs] = useState(1000);

  return (
    <AudioSettingsContext.Provider value={{
      silenceThreshold,
      setSilenceThreshold,
      silenceDurationMs,
      setSilenceDurationMs
    }}>
      {children}
    </AudioSettingsContext.Provider>
  );
}

export function useAudioSettings() {
  const context = useContext(AudioSettingsContext);
  if (context === undefined) {
    throw new Error('useAudioSettings must be used within an AudioSettingsProvider');
  }
  return context;
}
