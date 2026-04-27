export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface ParkingLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  totalSlots: number;
  levels?: string[];
  adminId: string;
  createdAt: string;
}

export interface ParkingSlot {
  id: string;
  locationId: string;
  slotNumber: string;
  level?: string;
  section?: string;
  isAvailable: boolean;
  type: 'standard' | 'ev' | 'disabled';
}

export interface Booking {
  id: string;
  userId: string;
  locationId: string;
  slotId: string;
  startTime: string; 
  endTime: string;
  status: 'active' | 'completed' | 'cancelled';
  scannedInAt?: string;
  scannedOutAt?: string;
  qrData: string;
  createdAt: string;
}
