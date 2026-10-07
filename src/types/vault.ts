// Модели хранилища документов и GPS-меток

import type { TimestampedDoc, DocumentCategory } from './common';

export interface StoredDocument extends TimestampedDoc {
  id: string;
  familyId: string;
  uploadedBy: string;
  name: string;
  category: DocumentCategory;
  /** Путь файла в Cloud Storage */
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}

/** GPS-метка места (Leaflet: lat/lng) */
export interface LocationMark extends TimestampedDoc {
  id: string;
  familyId: string;
  createdBy: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  emoji: string;
}
