import React, { createContext, useContext, useState, ReactNode } from 'react';
import { TERMINOLOGY_LENSES, TerminologyPack, DatabaseKey } from '../types/terminology';

interface TerminologyContextProps {
  currentLens: TerminologyPack;
  setLens: (id: string) => void;
  getLabel: (key: DatabaseKey, variant?: 'primary' | 'descriptive') => string;
}

const TerminologyContext = createContext<TerminologyContextProps | undefined>(undefined);

export const TerminologyProvider = ({ children }: { children: ReactNode }) => {
  const [currentLens, setCurrentLens] = useState<TerminologyPack>(TERMINOLOGY_LENSES.general_challenge);

  const setLens = (id: string) => {
    if (TERMINOLOGY_LENSES[id]) {
      setCurrentLens(TERMINOLOGY_LENSES[id]);
    }
  };

  const getLabel = (key: DatabaseKey, variant: 'primary' | 'descriptive' = 'primary'): string => {
    return currentLens.labels[key][variant];
  };

  return (
    <TerminologyContext.Provider value={{ currentLens, setLens, getLabel }}>
      {children}
    </TerminologyContext.Provider>
  );
};

export const useTerminology = () => {
  const context = useContext(TerminologyContext);
  if (!context) {
    throw new Error('useTerminology must be used within a valid TerminologyProvider wrapper.');
  }
  return context;
};
