import type { AggEvent } from './dailyAggregator';

export interface ProgressEvent {
  type: 'progress';
  parsed: number;
  percent: number;
}

export interface WorkoutItem {
  activityType: string;
  source: string;
  startDate: string;
  endDate: string;
  duration?: number;
  durationUnit?: string;
  totalDistance?: number;
  totalDistanceUnit?: string;
  totalEnergyBurned?: number;
  totalEnergyBurnedUnit?: string;
}

export interface WorkoutsEvent {
  type: 'workouts';
  items: WorkoutItem[];
}

export interface DoneEvent {
  type: 'done';
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type NdjsonEvent = ProgressEvent | AggEvent | WorkoutsEvent | DoneEvent | ErrorEvent;
