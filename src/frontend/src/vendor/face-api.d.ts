// Type declarations for the locally bundled @vladmandic/face-api
export const nets: {
  tinyFaceDetector: { loadFromUri: (url: string) => Promise<void> };
  ssdMobilenetv1: { loadFromUri: (url: string) => Promise<void> };
  faceRecognitionNet: { loadFromUri: (url: string) => Promise<void> };
  faceLandmark68Net: { loadFromUri: (url: string) => Promise<void> };
};

export class TinyFaceDetectorOptions {
  constructor(options?: { inputSize?: number; scoreThreshold?: number });
}

export class SsdMobilenetv1Options {
  constructor(options?: { minConfidence?: number; maxResults?: number });
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

export function detectSingleFace(
  input: HTMLVideoElement | HTMLImageElement,
  options?: TinyFaceDetectorOptions | SsdMobilenetv1Options,
): {
  withFaceLandmarks(): {
    withFaceDescriptor(): Promise<{
      descriptor: Float32Array;
    } | null>;
  };
};
