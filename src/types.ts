export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface PatientData {
  name: string;
  gender: 'Laki-laki' | 'Perempuan' | '';
  age: string;
  address: string;
  phone: string;
}

export interface ScreeningData {
  hasCough: boolean;
  coughDuration: string;
  hasFever: boolean;
  hasNightSweat: boolean;
  hasWeightLoss: boolean;
  hasChestPain: boolean;
  hasHistoryContact: boolean;
}
