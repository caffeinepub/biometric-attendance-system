import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Camera,
  Loader2,
  RefreshCw,
  ScanFace,
  SwitchCamera,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface FaceCaptureModalProps {
  open: boolean;
  studentName?: string;
  onCapture: (faceImage: string) => void;
  onClose: () => void;
}

export default function FaceCaptureModal({
  open,
  studentName,
  onCapture,
  onClose,
}: FaceCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [captured, setCaptured] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">(
    "user",
  );

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(
    async (facing: "user" | "environment" = "user") => {
      setStarting(true);
      setCameraError(null);
      setCaptured(null);
      try {
        let stream: MediaStream;
        if (facing === "environment") {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { exact: "environment" } },
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
          });
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Camera access denied";
        setCameraError(
          msg.includes("Permission")
            ? "Camera permission denied. Please allow camera access."
            : `Could not access camera: ${msg}`,
        );
      } finally {
        setStarting(false);
      }
    },
    [],
  );

  const handleFlipCamera = useCallback(() => {
    const newFacing = cameraFacing === "user" ? "environment" : "user";
    setCameraFacing(newFacing);
    stopCamera();
    startCamera(newFacing);
  }, [cameraFacing, stopCamera, startCamera]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional open-only trigger
  useEffect(() => {
    if (open) {
      startCamera(cameraFacing);
    } else {
      stopCamera();
      setCaptured(null);
      setCameraError(null);
    }
    return () => {
      stopCamera();
    };
  }, [open]);

  function captureFrame() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror horizontally for front camera so the saved image is not flipped
    if (cameraFacing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCaptured(dataUrl);
    stopCamera();
  }

  function retake() {
    setCaptured(null);
    startCamera(cameraFacing);
  }

  function handleConfirm() {
    if (captured) {
      onCapture(captured);
    }
  }

  function handleClose() {
    stopCamera();
    setCaptured(null);
    setCameraError(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="max-w-sm"
        style={{
          background: "#1B1E25",
          borderColor: "#2A2E38",
          color: "#EDEFF4",
        }}
        data-ocid="face_capture.dialog"
      >
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2"
            style={{ color: "#EDEFF4" }}
          >
            <ScanFace className="h-5 w-5" style={{ color: "#F2C94C" }} />
            {studentName ? `Capture Face — ${studentName}` : "Face Scan"}
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {/* Camera / preview area */}
          <div
            className="relative w-full overflow-hidden rounded-xl"
            style={{
              background: "#0E1014",
              border: "2px solid #2A2E38",
              aspectRatio: "4/3",
            }}
          >
            {cameraError ? (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center"
                data-ocid="face_capture.error_state"
              >
                <Camera className="h-10 w-10" style={{ color: "#F87171" }} />
                <p className="text-sm" style={{ color: "#F87171" }}>
                  {cameraError}
                </p>
                <Button
                  size="sm"
                  style={{ background: "#2A2E38", color: "#EDEFF4" }}
                  onClick={() => startCamera(cameraFacing)}
                  data-ocid="face_capture.retry.button"
                >
                  Retry
                </Button>
              </div>
            ) : captured ? (
              <img
                src={captured}
                alt="Captured face"
                className="w-full h-full object-cover"
              />
            ) : (
              <>
                {starting && (
                  <div
                    className="absolute inset-0 flex items-center justify-center z-10"
                    data-ocid="face_capture.loading_state"
                  >
                    <Loader2
                      className="h-8 w-8 animate-spin"
                      style={{ color: "#F2C94C" }}
                    />
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{
                    transform: cameraFacing === "user" ? "scaleX(-1)" : "none",
                  }}
                />
                {/* Face guide overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className="rounded-full"
                    style={{
                      width: "55%",
                      paddingBottom: "55%",
                      border: "2px dashed rgba(242,201,76,0.5)",
                      position: "relative",
                    }}
                  />
                </div>

                {/* Camera flip button — overlay bottom-right */}
                {!captured && !cameraError && (
                  <button
                    type="button"
                    className="absolute bottom-2 right-2 z-20 flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90"
                    style={{
                      background: "rgba(10,12,16,0.75)",
                      color: "#EDEFF4",
                      backdropFilter: "blur(4px)",
                    }}
                    onClick={handleFlipCamera}
                    title="Switch camera"
                    data-ocid="face_capture.camera.toggle"
                  >
                    <SwitchCamera className="h-3.5 w-3.5" />
                    {cameraFacing === "user" ? "Front" : "Back"}
                  </button>
                )}
              </>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* Hint text */}
          {!captured && !cameraError && (
            <p
              className="text-xs text-center mt-2"
              style={{ color: "#A7AFBD" }}
            >
              Position face inside the circle and press Capture
            </p>
          )}
          {captured && (
            <p
              className="text-xs text-center mt-2"
              style={{ color: "#4ADE80" }}
            >
              Face captured! Confirm to save or retake.
            </p>
          )}
        </div>

        <DialogFooter className="flex gap-2 flex-row justify-end">
          <Button
            variant="ghost"
            onClick={handleClose}
            style={{ color: "#A7AFBD" }}
            data-ocid="face_capture.cancel_button"
          >
            Cancel
          </Button>

          {captured ? (
            <>
              <Button
                variant="outline"
                className="gap-1.5"
                style={{
                  borderColor: "#2A2E38",
                  color: "#EDEFF4",
                  background: "transparent",
                }}
                onClick={retake}
                data-ocid="face_capture.retake.button"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retake
              </Button>
              <Button
                className="gap-1.5"
                style={{ background: "#F2C94C", color: "#0E1014" }}
                onClick={handleConfirm}
                data-ocid="face_capture.confirm_button"
              >
                <ScanFace className="h-4 w-4" /> Use This
              </Button>
            </>
          ) : (
            <Button
              className="gap-2"
              style={{
                background: cameraError ? "#2A2E38" : "#F2C94C",
                color: cameraError ? "#A7AFBD" : "#0E1014",
              }}
              onClick={captureFrame}
              disabled={!!cameraError || starting}
              data-ocid="face_capture.capture.button"
            >
              <Camera className="h-4 w-4" /> Capture Face
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
