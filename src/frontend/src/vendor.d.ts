// Type shim for @vladmandic/face-api which is loaded at runtime
declare module "@vladmandic/face-api" {
  export const nets: {
    tinyFaceDetector: { loadFromUri: (url: string) => Promise<void> };
    faceRecognitionNet: { loadFromUri: (url: string) => Promise<void> };
    faceLandmark68Net: { loadFromUri: (url: string) => Promise<void> };
  };

  export class TinyFaceDetectorOptions {
    constructor(options?: { inputSize?: number; scoreThreshold?: number });
  }

  export class LabeledFaceDescriptors {
    constructor(label: string, descriptors: Float32Array[]);
  }

  export class FaceMatcher {
    constructor(
      descriptors: LabeledFaceDescriptors[],
      distanceThreshold?: number,
    );
    findBestMatch(descriptor: Float32Array): {
      label: string;
      distance: number;
    };
  }

  type WithFaceLandmarks<T> = T & { landmarks: unknown };
  type WithFaceDescriptor<T> = T & { descriptor: Float32Array };

  interface DetectionWithLandmarks {
    withFaceLandmarks(): DetectionWithLandmarksResult;
  }

  interface DetectionWithLandmarksResult {
    withFaceDescriptor(): Promise<{ descriptor: Float32Array } | null>;
  }

  export function detectSingleFace(
    input: HTMLVideoElement | HTMLImageElement,
    options?: TinyFaceDetectorOptions,
  ): {
    withFaceLandmarks(): {
      withFaceDescriptor(): Promise<{
        descriptor: Float32Array;
      } | null>;
    };
  };
}
