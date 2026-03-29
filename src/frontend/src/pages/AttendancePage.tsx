import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Radio,
  ScanFace,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { AttendanceRecord, Student } from "../backend";
import FaceCaptureModal from "../components/FaceCaptureModal";
import LiveSessionModal from "../components/LiveSessionModal";
import { useActor } from "../hooks/useActor";

const TODAY = new Date().toISOString().split("T")[0];

export default function AttendancePage() {
  const { actor, isFetching } = useActor();
  const qc = useQueryClient();

  const [date, setDate] = useState(TODAY);
  const [scanStatus, setScanStatus] = useState<"IN" | "OUT">("IN");
  const [faceCaptureOpen, setFaceCaptureOpen] = useState(false);
  const [studentSelectOpen, setStudentSelectOpen] = useState(false);
  const [liveSessionOpen, setLiveSessionOpen] = useState(false);

  // Manual attendance
  const [manualStudentId, setManualStudentId] = useState("");
  const [manualStatus, setManualStatus] = useState<"IN" | "OUT">("IN");

  const { data: todayRecords = [], isLoading: loadingRecords } = useQuery<
    AttendanceRecord[]
  >({
    queryKey: ["attendanceByDate", date],
    queryFn: async () => {
      if (!actor) return [];
      const all = await actor.getAllAttendanceRecords();
      return all.filter((r) => r.date === date);
    },
    enabled: !!actor && !isFetching,
  });

  const { data: unmarkedStudents = [] } = useQuery<Student[]>({
    queryKey: ["unmarkedStudents", date],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getUnmarkedStudents(date);
    },
    enabled: !!actor && !isFetching,
  });

  const { data: enrolledStudents = [] } = useQuery<
    (Student & { faceImage?: string })[]
  >({
    queryKey: ["enrolledStudents"],
    queryFn: async () => {
      if (!actor) return [];
      const [all, faces] = await Promise.all([
        actor.getAllStudents(),
        actor.getAllFaces(),
      ]);
      const faceMap = new Map(faces.map((f) => [f.studentId, f.faceImage]));
      return all
        .filter((s) => faceMap.has(s.id))
        .map((s) => ({ ...s, faceImage: faceMap.get(s.id) }));
    },
    enabled: !!actor && !isFetching,
  });

  const markMutation = useMutation({
    mutationFn: async (record: AttendanceRecord) => {
      if (!actor) throw new Error("Not connected");
      await actor.markAttendance(record);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendanceByDate"] });
      qc.invalidateQueries({ queryKey: ["attendanceRecords"] });
      qc.invalidateQueries({ queryKey: ["todayStats"] });
      qc.invalidateQueries({ queryKey: ["unmarkedStudents"] });
      toast.success("Attendance marked successfully");
    },
    onError: () => toast.error("Failed to mark attendance"),
  });

  function handleFaceCaptured(_faceImage: string) {
    setFaceCaptureOpen(false);
    setStudentSelectOpen(true);
  }

  function confirmStudentMark(student: Student) {
    const now = new Date();
    markMutation.mutate({
      studentId: student.id,
      studentName: student.name,
      course: student.course,
      date,
      time: now.toTimeString().slice(0, 5),
      status: scanStatus,
      timestamp: BigInt(now.getTime()),
    });
    setStudentSelectOpen(false);
  }

  function submitManual() {
    if (!manualStudentId) {
      toast.error("Please select a student");
      return;
    }
    const student = unmarkedStudents.find((s) => s.id === manualStudentId);
    if (!student) {
      toast.error("Student not found");
      return;
    }
    const now = new Date();
    markMutation.mutate({
      studentId: student.id,
      studentName: student.name,
      course: student.course,
      date,
      time: now.toTimeString().slice(0, 5),
      status: manualStatus,
      timestamp: BigInt(now.getTime()),
    });
    setManualStudentId("");
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-sm mt-0.5 text-muted-foreground">
            Mark student attendance via face scan or manually
          </p>
        </div>

        {/* Live Session Button */}
        <Button
          className="gap-2.5 h-11 px-5 font-semibold rounded-lg text-sm flex-shrink-0 bg-primary text-white hover:bg-primary/90"
          onClick={() => setLiveSessionOpen(true)}
          data-ocid="attendance.live_session.open_modal_button"
        >
          <Radio className="h-4 w-4" />
          Open Live Session
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Face scan card */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-card">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Face Scan
          </h2>

          {/* Date + Status */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <Label className="text-xs mb-1.5 block text-muted-foreground">
                Date
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-white"
                data-ocid="attendance.date.input"
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block text-muted-foreground">
                Status
              </Label>
              <div className="flex rounded-lg overflow-hidden border border-border">
                {(["IN", "OUT"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="flex-1 py-2 text-sm font-semibold transition-colors"
                    style={
                      scanStatus === s
                        ? {
                            background: "oklch(var(--primary))",
                            color: "white",
                          }
                        : {
                            background: "white",
                            color: "oklch(var(--muted-foreground))",
                          }
                    }
                    onClick={() => setScanStatus(s)}
                    data-ocid={`attendance.status.${s.toLowerCase()}.toggle`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            className="w-full h-14 text-base font-semibold gap-3 rounded-xl bg-primary text-white hover:bg-primary/90"
            onClick={() => setFaceCaptureOpen(true)}
            data-ocid="attendance.scan.primary_button"
          >
            <Camera className="h-5 w-5" /> Open Camera
          </Button>

          <p className="text-xs text-center mt-3 text-muted-foreground">
            <ScanFace className="inline h-3.5 w-3.5 mr-1" />
            Uses back camera for face recognition
          </p>
        </div>

        {/* Manual attendance */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-card">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Manual Attendance
          </h2>
          <p className="text-xs mb-4 text-muted-foreground">
            Use this for students without enrolled faces
          </p>

          <div className="space-y-3 mb-4">
            <div>
              <Label className="text-xs mb-1.5 block text-muted-foreground">
                Student (Unmarked)
              </Label>
              <Select
                value={manualStudentId}
                onValueChange={setManualStudentId}
              >
                <SelectTrigger
                  className="bg-white"
                  data-ocid="attendance.manual.student.select"
                >
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {unmarkedStudents.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      All students marked
                    </SelectItem>
                  ) : (
                    unmarkedStudents.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} – {s.course}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block text-muted-foreground">
                Status
              </Label>
              <Select
                value={manualStatus}
                onValueChange={(v) => setManualStatus(v as "IN" | "OUT")}
              >
                <SelectTrigger
                  className="bg-white"
                  data-ocid="attendance.manual.status.select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">IN</SelectItem>
                  <SelectItem value="OUT">OUT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="w-full h-11 font-semibold gap-2 bg-primary text-white hover:bg-primary/90"
            onClick={submitManual}
            disabled={markMutation.isPending || !manualStudentId}
            data-ocid="attendance.manual.submit_button"
          >
            {markMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Mark Attendance
          </Button>
        </div>
      </div>

      {/* Today's attendance table */}
      <div className="rounded-xl border border-border bg-white overflow-hidden shadow-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted">
          <h2 className="text-sm font-semibold text-foreground">
            Attendance for {date}
          </h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
            {todayRecords.length} records
          </span>
        </div>

        {loadingRecords ? (
          <div
            className="flex justify-center py-10"
            data-ocid="attendance.records.loading_state"
          >
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : todayRecords.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 text-center"
            data-ocid="attendance.records.empty_state"
          >
            <ScanFace className="h-8 w-8 mb-2 text-muted" />
            <p className="text-sm text-muted-foreground">
              No attendance records for this date
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted border-b border-border">
                  {["Student Name", "Course", "Time", "Status"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayRecords.map((r, i) => (
                  <tr
                    key={`${r.studentId}-${r.timestamp}`}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                    data-ocid={`attendance.records.item.${i + 1}`}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {r.studentName}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {r.course}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {r.time}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-semibold"
                        style={
                          r.status === "IN"
                            ? { background: "#DCFCE7", color: "#16A34A" }
                            : { background: "#FEE2E2", color: "#DC2626" }
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Face Capture Modal */}
      <FaceCaptureModal
        open={faceCaptureOpen}
        onCapture={handleFaceCaptured}
        onClose={() => setFaceCaptureOpen(false)}
      />

      {/* Live Session Modal */}
      <LiveSessionModal
        open={liveSessionOpen}
        date={date}
        initialScanStatus={scanStatus}
        onClose={() => setLiveSessionOpen(false)}
      />

      {/* Student selector after face scan */}
      <Dialog open={studentSelectOpen} onOpenChange={setStudentSelectOpen}>
        <DialogContent data-ocid="attendance.student_select.dialog">
          <DialogHeader>
            <DialogTitle>Select Student</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm mb-4 text-muted-foreground">
              Face captured! Select the student to mark{" "}
              <strong className="text-primary">{scanStatus}</strong> for {date}.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {enrolledStudents.length === 0 ? (
                <p className="text-sm text-center py-4 text-muted-foreground">
                  No enrolled students found. Enroll student faces first.
                </p>
              ) : (
                enrolledStudents.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors bg-muted hover:bg-accent"
                    onClick={() => confirmStudentMark(s)}
                    data-ocid="attendance.student_select.button"
                  >
                    {s.faceImage ? (
                      <img
                        src={s.faceImage}
                        alt={s.name}
                        className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold flex-shrink-0 bg-primary text-white">
                        {s.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {s.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.course}
                      </p>
                    </div>
                    <ChevronDown className="ml-auto h-4 w-4 rotate-[-90deg] text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setStudentSelectOpen(false)}
              data-ocid="attendance.student_select.cancel_button"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
