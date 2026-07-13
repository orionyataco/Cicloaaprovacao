import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const FIRESTORE_IN_LIMIT = 10;

export async function fetchDocsByIds<T>(
  collectionName: string,
  fieldName: string,
  ids: string[]
): Promise<T[]> {
  if (ids.length === 0) return [];

  const batches: T[] = [];

  for (let i = 0; i < ids.length; i += FIRESTORE_IN_LIMIT) {
    const batch = ids.slice(i, i + FIRESTORE_IN_LIMIT);
    const q = query(collection(db, collectionName), where(fieldName, 'in', batch));
    const snap = await getDocs(q);
    batches.push(...snap.docs.map(doc => doc.data() as T));
  }

  return batches;
}
