import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  query 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { CeligoErrorRecord, JiraTicket } from '../types/celigo';

export interface PersistentJiraLink {
  errorId: string;
  jiraTicketKey: string;
  jiraTicketUrl?: string;
  summary?: string;
  status?: string;
  assigneeName?: string;
  flowId?: string;
  flowName?: string;
  integrationName?: string;
  createdAt?: string;
  linkedBy?: string;
}

const COLLECTION_NAME = 'celigo_jira_links';

// In-memory cache for instant synchronous lookups
const inMemoryJiraLinks = new Map<string, PersistentJiraLink>();

// Sanitize error ID to safe Firestore doc path key
export function sanitizeDocId(rawId: string): string {
  return String(rawId || '').replace(/[\/\s#?\[\]]/g, '_').slice(0, 128);
}

/**
 * Save or update a Jira ticket association in Firestore
 */
export async function savePersistentJiraLink(link: PersistentJiraLink): Promise<void> {
  const docId = sanitizeDocId(link.errorId);
  if (!docId) return;

  const payload: PersistentJiraLink = {
    errorId: link.errorId,
    jiraTicketKey: link.jiraTicketKey,
    jiraTicketUrl: link.jiraTicketUrl || `https://gappify.atlassian.net/browse/${link.jiraTicketKey}`,
    summary: link.summary || `Celigo Error ${link.errorId}`,
    status: link.status || 'To Do',
    assigneeName: link.assigneeName || 'Gappify Customer Support',
    flowId: link.flowId || '',
    flowName: link.flowName || '',
    integrationName: link.integrationName || '',
    createdAt: link.createdAt || new Date().toISOString(),
    linkedBy: link.linkedBy || 'system',
  };

  inMemoryJiraLinks.set(link.errorId, payload);
  // Also backup in localStorage for offline cache
  try {
    const rawLocal = localStorage.getItem('celigo_cached_jira_links');
    const localMap = rawLocal ? JSON.parse(rawLocal) : {};
    localMap[link.errorId] = payload;
    localStorage.setItem('celigo_cached_jira_links', JSON.stringify(localMap));
  } catch {}

  try {
    const docRef = doc(db, COLLECTION_NAME, docId);
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTION_NAME}/${docId}`);
  }
}

/**
 * Fetch all persistent Jira ticket links from Firestore
 */
export async function fetchAllPersistentJiraLinks(): Promise<Map<string, PersistentJiraLink>> {
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const snap = await getDocs(colRef);
    snap.forEach(docSnap => {
      const data = docSnap.data() as PersistentJiraLink;
      if (data && data.errorId) {
        inMemoryJiraLinks.set(data.errorId, data);
      }
    });

    // Backup to local storage
    const obj: Record<string, PersistentJiraLink> = {};
    inMemoryJiraLinks.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem('celigo_cached_jira_links', JSON.stringify(obj));

    return inMemoryJiraLinks;
  } catch (err) {
    console.warn('Could not fetch Jira links from Firestore, using cached data:', err);
    // Fallback to localStorage
    try {
      const rawLocal = localStorage.getItem('celigo_cached_jira_links');
      if (rawLocal) {
        const localMap = JSON.parse(rawLocal);
        Object.keys(localMap).forEach(k => inMemoryJiraLinks.set(k, localMap[k]));
      }
    } catch {}
    return inMemoryJiraLinks;
  }
}

/**
 * Subscribe to real-time Jira ticket link updates
 */
export function subscribeToJiraLinks(onUpdate: (links: Map<string, PersistentJiraLink>) => void): () => void {
  const colRef = collection(db, COLLECTION_NAME);
  return onSnapshot(
    colRef,
    (snapshot) => {
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as PersistentJiraLink;
        if (data && data.errorId) {
          inMemoryJiraLinks.set(data.errorId, data);
        }
      });
      onUpdate(new Map(inMemoryJiraLinks));
    },
    (error) => {
      console.warn('Jira link onSnapshot listener notice:', error);
    }
  );
}

/**
 * Merge persistent Jira links into a list of freshly synced Celigo error records
 * This guarantees that manual sync or auto-sync NEVER wipes out linked Jira tickets!
 */
export function enrichErrorsWithPersistentJiraLinks(
  errors: CeligoErrorRecord[],
  linksMap?: Map<string, PersistentJiraLink>
): CeligoErrorRecord[] {
  const links = linksMap || inMemoryJiraLinks;

  // Also check local cache if map is empty
  if (links.size === 0) {
    try {
      const rawLocal = localStorage.getItem('celigo_cached_jira_links');
      if (rawLocal) {
        const localMap = JSON.parse(rawLocal);
        Object.keys(localMap).forEach(k => inMemoryJiraLinks.set(k, localMap[k]));
      }
    } catch {}
  }

  return errors.map(err => {
    // Check direct ID match, composite match, or flow error code match
    const linked = links.get(err.id) || 
      (err.rawError && err.rawError._id ? links.get(err.rawError._id) : undefined);

    if (linked) {
      return {
        ...err,
        jiraTicketId: linked.jiraTicketKey,
        jiraTicketUrl: linked.jiraTicketUrl || `https://gappify.atlassian.net/browse/${linked.jiraTicketKey}`,
      };
    }
    return err;
  });
}
