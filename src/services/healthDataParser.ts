import type { Response } from 'express';
import sax from 'sax';
import yauzl from 'yauzl';
import { localDate, minutesBetween } from '../lib/appleDate';
import { getCutoffDateString } from '../lib/cutoffDate';
import { DailyAggregator } from '../lib/dailyAggregator';
import type { NdjsonEvent, WorkoutItem } from '../lib/ndjsonEvents';

const PROGRESS_EVERY_N_RECORDS = 200_000;
const SLEEP_RECORD_TYPE = 'HKCategoryTypeIdentifierSleepAnalysis';

function writeEvent(res: Response, event: NdjsonEvent): void {
  res.write(`${JSON.stringify(event)}\n`);
}

function handleRecord(
  attrs: Record<string, string>,
  cutoff: string,
  aggregator: DailyAggregator,
): void {
  const { type, startDate, endDate, sourceName, value } = attrs;
  if (!type || !startDate || localDate(startDate) < cutoff) return;

  const source = sourceName ?? 'unknown';

  if (type === SLEEP_RECORD_TYPE) {
    // Categorical value (sleep stage), not numeric — never parseFloat this.
    // Sleep crosses midnight, so the night is attributed to endDate.
    if (!endDate || !value) return;
    const night = localDate(endDate);
    const minutes = minutesBetween(startDate, endDate);
    aggregator.add(`${SLEEP_RECORD_TYPE}:${value}`, source, night, minutes);
    return;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return;

  aggregator.add(type, source, localDate(startDate), numericValue);
}

function handleWorkout(
  attrs: Record<string, string>,
  cutoff: string,
  workouts: WorkoutItem[],
): void {
  const { workoutActivityType, startDate, endDate, sourceName } = attrs;
  if (!workoutActivityType || !startDate || !endDate || localDate(startDate) < cutoff) return;

  workouts.push({
    activityType: workoutActivityType,
    source: sourceName ?? 'unknown',
    startDate,
    endDate,
    duration: attrs.duration ? Number(attrs.duration) : undefined,
    durationUnit: attrs.durationUnit,
    totalDistance: attrs.totalDistance ? Number(attrs.totalDistance) : undefined,
    totalDistanceUnit: attrs.totalDistanceUnit,
    totalEnergyBurned: attrs.totalEnergyBurned ? Number(attrs.totalEnergyBurned) : undefined,
    totalEnergyBurnedUnit: attrs.totalEnergyBurnedUnit,
  });
}

function isExportXmlEntry(fileName: string): boolean {
  return /export\.xml$/i.test(fileName);
}

/**
 * Streams export.xml out of the zip through sax — never buffers the full
 * (0.5-3GB) XML in memory, never sends raw records to the caller.
 */
async function streamExportXml(
  zipPath: string,
  cutoff: string,
  aggregator: DailyAggregator,
  workouts: WorkoutItem[],
  onProgress: (parsed: number, percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (openErr, zipfile) => {
      if (openErr || !zipfile) {
        reject(openErr ?? new Error('Failed to open export.zip'));
        return;
      }

      let matched = false;
      let recordCount = 0;

      zipfile.on('error', reject);

      zipfile.on('entry', (entry: yauzl.Entry) => {
        if (matched || !isExportXmlEntry(entry.fileName)) {
          zipfile.readEntry();
          return;
        }
        matched = true;

        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            reject(streamErr ?? new Error('Failed to read export.xml from zip'));
            return;
          }

          const totalBytes = entry.uncompressedSize || 1;
          let bytesRead = 0;
          readStream.on('data', (chunk: Buffer) => {
            bytesRead += chunk.length;
          });

          const parser = sax.createStream(true, { trim: true });

          parser.on('opentag', (node) => {
            const attrs = node.attributes as Record<string, string>;
            if (node.name === 'Record') {
              recordCount += 1;
              handleRecord(attrs, cutoff, aggregator);
              if (recordCount % PROGRESS_EVERY_N_RECORDS === 0) {
                onProgress(recordCount, (bytesRead / totalBytes) * 100);
              }
            } else if (node.name === 'Workout') {
              handleWorkout(attrs, cutoff, workouts);
            }
          });

          parser.on('error', (parseErr) => {
            console.error('sax parse error, skipping malformed fragment:', parseErr.message);
            parser.resume();
          });

          parser.on('end', () => {
            onProgress(recordCount, 100);
            zipfile.close();
            resolve();
          });

          readStream.pipe(parser);
        });
      });

      zipfile.on('end', () => {
        if (!matched) reject(new Error('export.xml not found inside export.zip'));
      });

      zipfile.readEntry();
    });
  });
}

export async function parseHealthDataFile(zipPath: string, res: Response): Promise<void> {
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });

  const cutoff = getCutoffDateString();
  const aggregator = new DailyAggregator();
  const workouts: WorkoutItem[] = [];

  await streamExportXml(zipPath, cutoff, aggregator, workouts, (parsed, percent) => {
    writeEvent(res, { type: 'progress', parsed, percent: Number(percent.toFixed(1)) });
  });

  for (const aggEvent of aggregator.events()) {
    writeEvent(res, aggEvent);
  }

  writeEvent(res, { type: 'workouts', items: workouts });
  writeEvent(res, { type: 'done' });
  res.end();
}
