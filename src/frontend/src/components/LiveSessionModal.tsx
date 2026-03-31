import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Loader2,
  Radio,
  ScanFace,
  SwitchCamera,
  UserX,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AttendanceRecord, FaceData, Student } from "../backend";
import { useActor } from "../hooks/useActor";
import * as faceapi from "../vendor/face-api.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SessionEntry {
  studentName: string;
  course: string;
  status: "IN" | "OUT";
  time: string;
}

type ScanStatus = "idle" | "scanning" | "detected" | "matched" | "no_match";

type FaceMatcher = {
  findBestMatch: (d: Float32Array) => { label: string; distance: number };
};

const MODEL_URL = "/models";
let modelsLoaded = false;

async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

function imgFromDataUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface LiveSessionModalProps {
  open: boolean;
  date: string;
  initialScanStatus?: "IN" | "OUT";
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function LiveSessionModal({
  open,
  date,
  initialScanStatus = "IN",
  onClose,
}: LiveSessionModalProps) {
  const { actor, isFetching } = useActor();
  const qc = useQueryClient();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceMatcherRef = useRef<FaceMatcher | null>(null);
  const studentsMapRef = useRef<Map<string, Student>>(new Map());
  const recentlyMarkedRef = useRef<Map<string, number>>(new Map());
  const isProcessingRef = useRef(false);
  // stable ref so detection loop never recreates due to mutation state changes
  const markMutationRef = useRef<
    ((record: AttendanceRecord) => Promise<void>) | null
  >(null);

  const [scanStatus, setScanStatus] = useState<"IN" | "OUT">(initialScanStatus);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">(
    "environment",
  );
  const [modelStatus, setModelStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [currentScanStatus, setCurrentScanStatus] =
    useState<ScanStatus>("idle");
  const [lastRecognized, setLastRecognized] = useState<{
    name: string;
    status: string;
    time: string;
  } | null>(null);
  const [sessionLog, setSessionLog] = useState<SessionEntry[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceMatcherReady, setFaceMatcherReady] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch data
  // -------------------------------------------------------------------------
  const { data: faceData = [], isLoading: loadingFaces } = useQuery<FaceData[]>(
    {
      queryKey: ["allFaces"],
      queryFn: async () => {
        if (!actor) return [];
        return actor.getAllFaces();
      },
      enabled: !!actor && !isFetching && open,
    },
  );

  const { data: allStudents = [], isLoading: loadingStudents } = useQuery<
    Student[]
  >({
    queryKey: ["allStudents"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllStudents();
    },
    enabled: !!actor && !isFetching && open,
  });

  // -------------------------------------------------------------------------
  // Mark attendance mutation
  // -------------------------------------------------------------------------
  const markMutation = useMutation({
    mutationFn: async (record: AttendanceRecord) => {
      if (!actor) throw new Error("Not connected");
      await actor.markAttendance(record);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendanceByDate"] });
      qc.invalidateQueries({ queryKey: ["todayStats"] });
      qc.invalidateQueries({ queryKey: ["unmarkedStudents"] });
    },
  });

  // Keep a stable ref so the detection loop doesn't need markMutation as dependency
  useEffect(() => {
    markMutationRef.current = markMutation.mutateAsync;
  });

  // -------------------------------------------------------------------------
  // Camera
  // -------------------------------------------------------------------------
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(
    async (facing: "user" | "environment" = "environment") => {
      setCameraError(null);
      try {
        let stream: MediaStream;
        if (facing === "environment") {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { exact: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            });
          }
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setCameraError(
          "Camera access denied. Please allow camera permissions.",
        );
      }
    },
    [],
  );

  const handleFlipCamera = useCallback(() => {
    const newFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(newFacing);
    stopCamera();
    startCamera(newFacing);
  }, [cameraFacing, stopCamera, startCamera]);

  // -------------------------------------------------------------------------
  // Build face matcher from stored faces
  // Use Tiny Face Detector for consistent model usage
  // -------------------------------------------------------------------------
  const buildFaceMatcher = useCallback(
    async (faces: FaceData[], students: Student[]) => {
      if (faces.length === 0) {
        setFaceMatcherReady(true);
        return;
      }
      try {
        const sMap = new Map<string, Student>();
        for (const s of students) sMap.set(s.id, s);
        studentsMapRef.current = sMap;

        const labeled: faceapi.LabeledFaceDescriptors[] = [];
        for (const faceRecord of faces) {
          try {
            const img = await imgFromDataUrl(faceRecord.faceImage);
            const detection = await faceapi
              .detectSingleFace(
                img,
                new faceapi.TinyFaceDetectorOptions({
                  inputSize: 224,
                  scoreThreshold: 0.4,
                }),
              )
              .withFaceLandmarks()
              .withFaceDescriptor();
            if (detection) {
              labeled.push(
                new faceapi.LabeledFaceDescriptors(faceRecord.studentId, [
                  detection.descriptor,
                ]),
              );
            }
          } catch {
            // Skip unprocessable faces
          }
        }

        if (labeled.length > 0) {
          faceMatcherRef.current = new faceapi.FaceMatcher(labeled, 0.65);
        }
        setFaceMatcherReady(true);
      } catch (err) {
        console.error("Failed to build face matcher:", err);
        setFaceMatcherReady(true);
      }
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Detection loop
  // -------------------------------------------------------------------------
  const scanStatusRef = useRef(scanStatus);
  useEffect(() => {
    scanStatusRef.current = scanStatus;
  }, [scanStatus]);

  const startDetectionLoop = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    scanIntervalRef.current = setInterval(async () => {
      if (isProcessingRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        setCurrentScanStatus("scanning");
        return;
      }

      try {
        isProcessingRef.current = true;
        setCurrentScanStatus("scanning");

        // Use Tiny Face Detector — matches the loaded models
        const detection = await faceapi
          .detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 224,
              scoreThreshold: 0.4,
            }),
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          setCurrentScanStatus("idle");
          isProcessingRef.current = false;
          return;
        }

        setCurrentScanStatus("detected");

        const matcher = faceMatcherRef.current;
        if (!matcher) {
          setCurrentScanStatus("no_match");
          isProcessingRef.current = false;
          return;
        }

        const match = matcher.findBestMatch(detection.descriptor);

        if (match.label === "unknown" || match.distance > 0.65) {
          setCurrentScanStatus("no_match");
          isProcessingRef.current = false;
          return;
        }

        const student = studentsMapRef.current.get(match.label);
        if (!student) {
          setCurrentScanStatus("no_match");
          isProcessingRef.current = false;
          return;
        }

        // Debounce: 5s cooldown per student for fast successive scans
        const lastMark = recentlyMarkedRef.current.get(match.label);
        if (lastMark && Date.now() - lastMark < 5000) {
          setCurrentScanStatus("matched");
          isProcessingRef.current = false;
          return;
        }

        const now = new Date();
        const timeStr = now.toTimeString().slice(0, 5);
        const currentStatus = scanStatusRef.current;

        const mutate = markMutationRef.current;
        if (!mutate) {
          isProcessingRef.current = false;
          return;
        }

        await mutate({
          studentId: student.id,
          studentName: student.name,
          course: student.course,
          date,
          time: timeStr,
          status: currentStatus,
          timestamp: BigInt(now.getTime()),
        });

        recentlyMarkedRef.current.set(match.label, Date.now());
        setCurrentScanStatus("matched");
        setLastRecognized({
          name: student.name,
          status: currentStatus,
          time: timeStr,
        });
        setSessionLog((prev) => [
          {
            studentName: student.name,
            course: student.course,
            status: currentStatus,
            time: timeStr,
          },
          ...prev,
        ]);
        toast.success(`✓ ${student.name} marked ${currentStatus}`, {
          duration: 2000,
        });
        setTimeout(() => setCurrentScanStatus("scanning"), 2000);
      } catch (err) {
        console.error("Detection error:", err);
      } finally {
        isProcessingRef.current = false;
      }
    }, 800);
  }, [date]);

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional open-only trigger
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function init() {
      setModelStatus("loading");
      try {
        await loadModels();
        if (!cancelled) setModelStatus("ready");
      } catch {
        if (!cancelled) setModelStatus("error");
      }
    }
    init();
    startCamera(cameraFacing);
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open]);

  useEffect(() => {
    if (!open || loadingFaces || loadingStudents) return;
    buildFaceMatcher(faceData, allStudents);
  }, [
    open,
    faceData,
    allStudents,
    loadingFaces,
    loadingStudents,
    buildFaceMatcher,
  ]);

  useEffect(() => {
    if (!open || modelStatus !== "ready" || !faceMatcherReady) return;
    startDetectionLoop();
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [open, modelStatus, faceMatcherReady, startDetectionLoop]);

  useEffect(() => {
    if (!open) {
      setCurrentScanStatus("idle");
      setLastRecognized(null);
      setFaceMatcherReady(false);
      faceMatcherRef.current = null;
      recentlyMarkedRef.current.clear();
    }
  }, [open]);

  if (!open) return null;

  // -------------------------------------------------------------------------
  // Status config
  // -------------------------------------------------------------------------
  const statusConfig: Record<ScanStatus, { label: string; color: string }> = {
    idle: { label: "Point camera at a face...", color: "#A7AFBD" },
    scanning: { label: "Scanning for face...", color: "#F2C94C" },
    detected: { label: "Face detected! Recognizing...", color: "#60A5FA" },
    matched: {
      label: lastRecognized
        ? `✓ ${lastRecognized.name} marked ${lastRecognized.status}`
        : "Match found!",
      color: "#4ADE80",
    },
    no_match: { label: "Face not recognized", color: "#F87171" },
  };

  const isReady = modelStatus === "ready" && faceMatcherReady;
  const showLoading =
    modelStatus === "loading" ||
    (modelStatus === "ready" && !faceMatcherReady && !cameraError);

  const borderColor =
    currentScanStatus === "matched"
      ? "#4ADE80"
      : currentScanStatus === "detected"
        ? "#60A5FA"
        : "#2A2E38";

  const glowShadow =
    currentScanStatus === "matched"
      ? "0 0 48px rgba(74,222,128,0.4)"
      : currentScanStatus === "scanning" || currentScanStatus === "detected"
        ? "0 0 48px rgba(242,201,76,0.25)"
        : "none";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "#0A0C10" }}
      data-ocid="live_session.modal"
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
        style={{ borderColor: "#1E2330" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center h-8 w-8 rounded-lg"
            style={{ background: "rgba(242,201,76,0.15)" }}
          >
            <Radio className="h-4 w-4" style={{ color: "#F2C94C" }} />
          </div>
          <div>
            <h2
              className="text-base font-bold leading-none"
              style={{
                color: "#EDEFF4",
                fontFamily: "BricolageGrotesque, Inter, sans-serif",
              }}
            >
              Live Session
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#A7AFBD" }}>
              {date} &bull; Auto face recognition
            </p>
          </div>
          {isReady && (
            <span
              className="ml-2 text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
              style={{
                background: "rgba(74,222,128,0.15)",
                color: "#4ADE80",
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              LIVE
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Camera flip button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleFlipCamera}
            className="h-8 w-8 p-0 rounded-lg"
            style={{ color: "#A7AFBD" }}
            title={
              cameraFacing === "environment"
                ? "Switch to front camera"
                : "Switch to back camera"
            }
            data-ocid="live_session.camera.toggle"
          >
            <SwitchCamera className="h-4 w-4" />
          </Button>

          <div
            className="flex rounded-lg overflow-hidden border"
            style={{ borderColor: "#2A2E38" }}
          >
            {(["IN", "OUT"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className="px-4 py-1.5 text-sm font-semibold transition-all"
                style={
                  scanStatus === s
                    ? { background: "#F2C94C", color: "#0E1014" }
                    : { background: "#1B1E25", color: "#A7AFBD" }
                }
                onClick={() => setScanStatus(s)}
                data-ocid={`live_session.status.${s.toLowerCase()}.toggle`}
              >
                {s}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-lg"
            style={{ color: "#A7AFBD" }}
            data-ocid="live_session.close_button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main content — camera fills available space on large screens */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Camera panel — fills full height on large screens */}
        <div className="flex-1 flex flex-col items-center justify-center p-3 lg:p-5 min-h-0">
          {/* Camera frame — uses full available height */}
          <div
            className="relative w-full overflow-hidden rounded-2xl"
            style={{
              background: "#0E1014",
              height: "calc(100% - 56px)",
              minHeight: 280,
              border: `2px solid ${borderColor}`,
              boxShadow: glowShadow,
              transition: "border-color 0.3s, box-shadow 0.3s",
            }}
          >
            {/* Loading overlay */}
            {showLoading && (
              <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4"
                style={{ background: "rgba(10,12,16,0.85)" }}
                data-ocid="live_session.loading_state"
              >
                <Loader2
                  className="h-10 w-10 animate-spin"
                  style={{ color: "#F2C94C" }}
                />
                <p className="text-sm font-medium" style={{ color: "#EDEFF4" }}>
                  {modelStatus === "loading"
                    ? "Loading face recognition models..."
                    : "Building face database..."}
                </p>
                <p className="text-xs" style={{ color: "#A7AFBD" }}>
                  This may take a moment on first use
                </p>
              </div>
            )}

            {/* Error overlay */}
            {(modelStatus === "error" || cameraError) && (
              <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 p-6 text-center"
                data-ocid="live_session.error_state"
              >
                <UserX className="h-12 w-12" style={{ color: "#F87171" }} />
                <p className="text-sm font-medium" style={{ color: "#F87171" }}>
                  {cameraError || "Failed to load face recognition models"}
                </p>
                <Button
                  size="sm"
                  style={{ background: "#2A2E38", color: "#EDEFF4" }}
                  onClick={() => {
                    setCameraError(null);
                    startCamera(cameraFacing);
                  }}
                  data-ocid="live_session.retry.button"
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Video feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full"
              style={{
                objectFit: "cover",
                transform: cameraFacing === "user" ? "scaleX(-1)" : "none",
              }}
            />

            {/* Camera facing indicator */}
            <div
              className="absolute top-3 left-3 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
              style={{ background: "rgba(10,12,16,0.7)", color: "#A7AFBD" }}
            >
              <SwitchCamera className="h-3 w-3" />
              {cameraFacing === "environment" ? "Back" : "Front"}
            </div>

            {/* Scanning overlays */}
            {isReady && !cameraError && (
              <>
                {/* Corner brackets */}
                {(
                  [
                    ["top-4 left-4", 0],
                    ["top-4 right-4", 1],
                    ["bottom-4 left-4", 2],
                    ["bottom-4 right-4", 3],
                  ] as [string, number][]
                ).map(([pos, i]) => (
                  <div
                    key={pos}
                    className={`absolute ${pos} h-10 w-10 pointer-events-none`}
                    style={{
                      borderColor: "#F2C94C",
                      borderStyle: "solid",
                      borderWidth: 0,
                      borderTopWidth: i < 2 ? 2 : 0,
                      borderBottomWidth: i >= 2 ? 2 : 0,
                      borderLeftWidth: i % 2 === 0 ? 2 : 0,
                      borderRightWidth: i % 2 === 1 ? 2 : 0,
                      opacity: 0.7,
                    }}
                  />
                ))}

                {/* Face guide oval */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    style={{
                      width: "40%",
                      height: "68%",
                      borderRadius: "50%",
                      border: `2px dashed ${
                        currentScanStatus === "matched"
                          ? "rgba(74,222,128,0.8)"
                          : currentScanStatus === "detected"
                            ? "rgba(96,165,250,0.8)"
                            : "rgba(242,201,76,0.45)"
                      }`,
                      transition: "border-color 0.2s",
                    }}
                  />
                </div>

                {/* Scan line */}
                {currentScanStatus === "scanning" && (
                  <div
                    className="absolute left-0 right-0 h-px pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, #F2C94C, transparent)",
                      animation: "lsScanLine 1.5s ease-in-out infinite",
                    }}
                  />
                )}

                {/* Match flash */}
                <AnimatePresence>
                  {currentScanStatus === "matched" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <div
                        className="flex flex-col items-center gap-3 p-6 rounded-3xl"
                        style={{ background: "rgba(10,12,16,0.82)" }}
                      >
                        <CheckCircle2
                          className="h-16 w-16"
                          style={{ color: "#4ADE80" }}
                        />
                        <p
                          className="text-xl font-bold"
                          style={{ color: "#4ADE80" }}
                        >
                          {lastRecognized?.name}
                        </p>
                        <span
                          className="text-sm px-3 py-1 rounded-full font-semibold"
                          style={{
                            background:
                              lastRecognized?.status === "IN"
                                ? "#1F6F3A"
                                : "#8B2D2D",
                            color:
                              lastRecognized?.status === "IN"
                                ? "#E8FFF0"
                                : "#FFECEC",
                          }}
                        >
                          {lastRecognized?.status}
                        </span>
                        <p className="text-xs" style={{ color: "#A7AFBD" }}>
                          {lastRecognized?.time}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          {/* Status bar */}
          <div
            className="mt-3 w-full flex items-center gap-2 px-4 py-2.5 rounded-xl flex-shrink-0"
            style={{ background: "#1B1E25", border: "1px solid #2A2E38" }}
          >
            {currentScanStatus === "scanning" && (
              <Loader2
                className="h-4 w-4 animate-spin flex-shrink-0"
                style={{ color: "#F2C94C" }}
              />
            )}
            {currentScanStatus === "matched" && (
              <CheckCircle2
                className="h-4 w-4 flex-shrink-0"
                style={{ color: "#4ADE80" }}
              />
            )}
            {currentScanStatus === "no_match" && (
              <UserX
                className="h-4 w-4 flex-shrink-0"
                style={{ color: "#F87171" }}
              />
            )}
            {(currentScanStatus === "idle" ||
              currentScanStatus === "detected") && (
              <ScanFace
                className="h-4 w-4 flex-shrink-0"
                style={{ color: statusConfig[currentScanStatus].color }}
              />
            )}
            <span
              className="text-sm font-medium"
              style={{ color: statusConfig[currentScanStatus].color }}
            >
              {showLoading
                ? "Initializing..."
                : statusConfig[currentScanStatus].label}
            </span>
          </div>
        </div>

        {/* Session log panel */}
        <div
          className="w-full lg:w-72 flex flex-col border-t lg:border-t-0 lg:border-l flex-shrink-0"
          style={{ borderColor: "#1E2330" }}
        >
          <div
            className="px-4 py-3 border-b flex-shrink-0"
            style={{ borderColor: "#1E2330" }}
          >
            <h3 className="text-sm font-semibold" style={{ color: "#EDEFF4" }}>
              Session Log
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "#A7AFBD" }}>
              {sessionLog.length} marked this session
            </p>
          </div>

          <ScrollArea className="flex-1">
            {sessionLog.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-12 px-4 text-center"
                data-ocid="live_session.log.empty_state"
              >
                <ScanFace
                  className="h-8 w-8 mb-2"
                  style={{ color: "#2A2E38" }}
                />
                <p className="text-xs" style={{ color: "#A7AFBD" }}>
                  No attendance marked yet
                </p>
                <p className="text-xs mt-1" style={{ color: "#4A5060" }}>
                  Students will appear here as they scan
                </p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {sessionLog.map((entry, i) => (
                  <motion.div
                    key={`${entry.studentName}-${entry.time}-${i}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 p-2.5 rounded-lg"
                    style={{ background: "#1B1E25" }}
                    data-ocid={`live_session.log.item.${i + 1}`}
                  >
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{
                        background: "rgba(242,201,76,0.15)",
                        color: "#F2C94C",
                      }}
                    >
                      {entry.studentName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: "#EDEFF4" }}
                      >
                        {entry.studentName}
                      </p>
                      <p
                        className="text-xs truncate"
                        style={{ color: "#A7AFBD" }}
                      >
                        {entry.course} &bull; {entry.time}
                      </p>
                    </div>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                      style={
                        entry.status === "IN"
                          ? { background: "#1F6F3A", color: "#E8FFF0" }
                          : { background: "#8B2D2D", color: "#FFECEC" }
                      }
                    >
                      {entry.status}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      <style>{`
        @keyframes lsScanLine {
          0%   { top: 18%; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 82%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
