export interface Bucket {
  sum: number;
  min: number;
  max: number;
  count: number;
}

export interface AggEvent extends Bucket {
  type: 'agg';
  granularity: 'day';
  metric: string;
  source: string;
  date: string;
}

const KEY_SEPARATOR = '|';

/**
 * Day is the atomic unit — week/month rollups and cumulative-vs-sampled
 * interpretation of sum/count are left to the client. The server only
 * ever emits raw {sum,min,max,count} per metric/source/day.
 */
export class DailyAggregator {
  private readonly buckets = new Map<string, Bucket>();

  add(metric: string, source: string, date: string, value: number): void {
    const key = `${metric}${KEY_SEPARATOR}${source}${KEY_SEPARATOR}${date}`;
    const bucket = this.buckets.get(key);
    if (bucket) {
      bucket.sum += value;
      bucket.count += 1;
      if (value < bucket.min) bucket.min = value;
      if (value > bucket.max) bucket.max = value;
    } else {
      this.buckets.set(key, { sum: value, min: value, max: value, count: 1 });
    }
  }

  *events(): Generator<AggEvent> {
    for (const [key, bucket] of this.buckets) {
      const parts = key.split(KEY_SEPARATOR);
      const metric = parts[0] as string;
      const source = parts[1] as string;
      const date = parts[2] as string;
      yield { type: 'agg', granularity: 'day', metric, source, date, ...bucket };
    }
  }
}
