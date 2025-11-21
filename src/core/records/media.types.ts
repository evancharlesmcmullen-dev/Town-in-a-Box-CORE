// src/core/records/media.types.ts

/**
 * A source of media, such as a camera/NVR.
 */
export interface MediaSource {
  id: string;
  tenantId: string;

  name: string;
  description?: string;

  locationDescription?: string;
}

/**
 * A recording window from a media source.
 */
export interface MediaRecording {
  id: string;
  tenantId: string;

  sourceId: string;
  startTime: Date;
  endTime: Date;

  storageRefId?: string;   // link to where the clip/file is stored
}

/**
 * A specific clip cut from a recording.
 */
export interface MediaClip {
  id: string;
  tenantId: string;

  recordingId: string;
  clipStart: Date;
  clipEnd: Date;

  storageRefId?: string;
}